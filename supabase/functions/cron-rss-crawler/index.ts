// ════════════════════════════════════════════════════════════════════════
//  Supabase Edge Function — cron-rss-crawler
//  Runs every 30 minutes. Pulls regional + global wire RSS, pipes each item
//  through Gemini (60-word EN/BN/HI summaries + scores + 768-d embedding),
//  and ingests via the ingest_story RPC so dedup/merge is identical to the
//  citizen path.
//
//  Schedule (Supabase dashboard → Edge Functions → Cron, or via SQL):
//    select cron.schedule('rss-crawler','*/30 * * * *',
//      $$ select net.http_post(
//           url := 'https://<project>.functions.supabase.co/cron-rss-crawler',
//           headers := jsonb_build_object('Authorization','Bearer <anon-or-service>')
//         ); $$);
// ════════════════════════════════════════════════════════════════════════

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!;
const TEXT_MODEL = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-3.8-flash';
const EMBED_MODEL = Deno.env.get('GEMINI_EMBED_MODEL') ?? 'gemini-embedding-001';

// Regional + global wire coverage. Reuters and PTI no longer publish open
// RSS, so their wires are reached through Google News source filters.
const FEEDS: { name: string; url: string }[] = [
  { name: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Kolkata+OR+%22West+Bengal%22&hl=en-IN&gl=IN&ceid=IN:en' },
  { name: 'PTI wire', url: 'https://news.google.com/rss/search?q=PTI+India+when:1d&hl=en-IN&gl=IN&ceid=IN:en' },
  { name: 'Reuters India', url: 'https://news.google.com/rss/search?q=source:Reuters+India+when:1d&hl=en-IN&gl=IN&ceid=IN:en' },
  { name: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
];
const MAX_PER_RUN = 6;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── minimal RSS parse (title + description of first N items) ──
function parseRss(xml: string): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks) {
    const title = clean(match(b, /<title>([\s\S]*?)<\/title>/i));
    const desc = clean(match(b, /<description>([\s\S]*?)<\/description>/i));
    if (title) items.push({ title, description: desc });
  }
  return items;
}
function match(s: string, re: RegExp): string {
  const m = s.match(re);
  return m ? m[1] : '';
}
function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function gemini(prompt: string): Promise<string> {
  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY secret is not set in Supabase Edge Functions. Run: npx supabase secrets set GEMINI_API_KEY=...');
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

async function embed(text: string): Promise<number[]> {
  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY secret is not set in Supabase Edge Functions');
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: 768,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Embed error (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data?.embedding?.values ?? [];
}

function parseJson(raw: string): any {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : raw;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  return JSON.parse(body.slice(a, b + 1));
}

function clampWords(s: string, n = 60): string {
  const w = (s || '').trim().split(/\s+/).filter(Boolean);
  return w.length <= n ? (s || '').trim() : w.slice(0, n).join(' ');
}

Deno.serve(async () => {
  let ingested = 0;
  let merged = 0;
  const errors: string[] = [];
  const sources: { name: string; ok: boolean }[] = [];
  const startedAt = new Date().toISOString();

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
      const xml = await res.text();
      sources.push({ name: feed.name, ok: true });
      const items = parseRss(xml).slice(0, Math.ceil(MAX_PER_RUN / FEEDS.length));

      for (const it of items) {
        try {
          const raw = `${it.title}. ${it.description}`.slice(0, 4000);
          const prompt = `Summarise this wire item as STRICT JSON:
{"titles":{"en":"","bn":"","hi":""},"summaries":{"en":"","bn":"","hi":""},
"completeness_score":0-100,"ai_probability_score":0-100,
"category":"Civic|Crime|Politics|Weather|Electronics|Vehicle|Health|Other"}
Each summary <=60 words. Translate to English/Bengali/Hindi. No invented facts.
Item: """${raw}"""`;

          const rawAnalysis = parseJson(await gemini(prompt)) || {};
          const titles = {
            en: rawAnalysis.titles?.en || it.title || 'Breaking Wire Update',
            bn: rawAnalysis.titles?.bn || rawAnalysis.titles?.en || it.title || 'ব্রেকিং আপডেট',
            hi: rawAnalysis.titles?.hi || rawAnalysis.titles?.en || it.title || 'ब्रेकिंग अपडेट',
          };
          const summaries = {
            en: clampWords(rawAnalysis.summaries?.en || it.description || it.title || ''),
            bn: clampWords(rawAnalysis.summaries?.bn || rawAnalysis.summaries?.en || it.description || it.title || ''),
            hi: clampWords(rawAnalysis.summaries?.hi || rawAnalysis.summaries?.en || it.description || it.title || ''),
          };
          const vector = await embed(`${titles.en}. ${summaries.en}`);
          if (vector.length !== 768) continue;

          const { data, error } = await admin.rpc('ingest_story', {
            p_author: null,
            p_category: rawAnalysis.category ?? 'Other',
            p_location_name: 'Wire',
            p_lat: null,
            p_lng: null,
            p_titles: titles,
            p_summaries: summaries,
            p_media_url: null,
            p_media_type: 'image',
            p_c2pa: false,
            p_ai_prob: rawAnalysis.ai_probability_score ?? 0,
            p_completeness: rawAnalysis.completeness_score ?? 50,
            p_embedding: vector,
            p_source: 'rss',
          });
          if (error) {
            errors.push(error.message);
          } else {
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.action === 'merged_timeline') merged++;
            else ingested++;
          }
        } catch (e) {
          errors.push(`${feed.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      if (!sources.some((x) => x.name === feed.name)) sources.push({ name: feed.name, ok: false });
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Heartbeat for the right-rail crawler monitor (platform_stats()).
  await admin.from('crawler_runs').insert({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    ingested,
    merged,
    errors: errors.length,
    sources,
  });

  return new Response(
    JSON.stringify({ ingested, merged, errors: errors.slice(0, 5), at: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
