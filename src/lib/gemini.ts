import type { GeminiStoryAnalysis, GeminiOcrResult, LocalizedText } from './types';

/**
 * Thin REST wrapper over the Google Generative Language API. We call the
 * REST endpoint directly (rather than an SDK) to keep the dependency
 * surface small and to run identically in Next.js route handlers and
 * Supabase Edge Functions (Deno).
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004';

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY is not set');
  return k;
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Hard-trim any summary to <= 60 words to guarantee the invariant. */
function clampSummary(s: string): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  return words.length <= 60 ? s.trim() : words.slice(0, 60).join(' ');
}

function enforceSixtyWords(t: LocalizedText): LocalizedText {
  return {
    en: clampSummary(t.en),
    bn: clampSummary(t.bn),
    hi: clampSummary(t.hi),
  };
}

/** Extract the first JSON object from a model response (handles code fences). */
function parseJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Gemini returned no JSON');
  return JSON.parse(body.slice(start, end + 1)) as T;
}

async function generateContent(prompt: string, imageB64?: string, mime?: string) {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (imageB64 && mime) {
    parts.push({ inline_data: { mime_type: mime, data: imageB64 } });
  }
  const res = await fetch(
    `${API_ROOT}/models/${TEXT_MODEL}:generateContent?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini generateContent ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
}

// ─────────────────────────────────────────────────────────────────────────
//  analyzeStory — fact-check + translate + score, strictly <= 60 words each.
// ─────────────────────────────────────────────────────────────────────────
export async function analyzeStory(rawText: string): Promise<GeminiStoryAnalysis> {
  const prompt = `You are VeriPulse's zero-hallucination news editor.
Given a raw report, produce STRICT JSON with this exact shape:
{
  "titles":    { "en": "...", "bn": "...", "hi": "..." },
  "summaries": { "en": "...", "bn": "...", "hi": "..." },
  "completeness_score": <0-100 integer: how complete/sourced the report is>,
  "ai_probability_score": <0-100 integer: likelihood the text is AI-fabricated>,
  "category": "<one of: Civic, Crime, Politics, Weather, Electronics, Vehicle, Health, Other>"
}
Rules:
- Each summary MUST be 60 words or fewer. Count words; do not exceed 60.
- Translate faithfully into English (en), Bengali (bn), Hindi (hi).
- Do NOT invent facts not present in the source. If a detail is missing, omit it.
- Titles must be under 12 words each.
Raw report:
"""${rawText.slice(0, 6000)}"""`;

  const out = await generateContent(prompt);
  const parsed = parseJson<GeminiStoryAnalysis>(out);
  parsed.summaries = enforceSixtyWords(parsed.summaries);

  // Defensive clamps
  parsed.completeness_score = Math.max(0, Math.min(100, Number(parsed.completeness_score) || 50));
  parsed.ai_probability_score = Math.max(0, Math.min(100, Number(parsed.ai_probability_score) || 0));
  parsed.category = parsed.category || 'Other';
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────
//  embedText — 768-d vector via text-embedding-004.
// ─────────────────────────────────────────────────────────────────────────
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `${API_ROOT}/models/${EMBED_MODEL}:embedContent?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini embedContent ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const values: number[] = data?.embedding?.values ?? [];
  if (values.length !== 768) {
    throw new Error(`Expected 768-d embedding, got ${values.length}`);
  }
  return values;
}

// ─────────────────────────────────────────────────────────────────────────
//  ocrDocument — Vision OCR + pixel-forensic tamper check for RC / GST.
// ─────────────────────────────────────────────────────────────────────────
export async function ocrDocument(
  imageB64: string,
  mime: string,
): Promise<GeminiOcrResult> {
  const prompt = `You are VeriPulse's document forensics engine. Inspect the
attached image of an Indian Vehicle Registration Certificate (RC) or a GST
tax invoice. Return STRICT JSON:
{
  "doc_type": "vehicle_rc" | "gst_invoice",
  "registration_or_invoice_no": "...",
  "chassis_or_gstin": "...",
  "make": "...",
  "model": "...",
  "purchase_date": "YYYY-MM-DD or null",
  "product_category": "<e.g. Vehicle, Electronics, Appliance>",
  "tamper_check_passed": true | false,
  "tamper_notes": "<short reason if failed, else empty>",
  "ocr_confidence": <0-100 integer>
}
Forensic rules:
- Flag tamper_check_passed=false if you detect font mismatch within a field,
  misaligned baselines, cloned pixels, inconsistent compression artifacts
  around numbers, or edited registration/invoice identifiers.
- If the image is not a recognisable RC or invoice, set ocr_confidence low
  and tamper_check_passed=false.`;

  const out = await generateContent(prompt, imageB64, mime);
  const parsed = parseJson<GeminiOcrResult>(out);
  parsed.ocr_confidence = Math.max(0, Math.min(100, Number(parsed.ocr_confidence) || 0));
  parsed.tamper_check_passed = Boolean(parsed.tamper_check_passed);
  return parsed;
}

export { wordCount, clampSummary, enforceSixtyWords };
