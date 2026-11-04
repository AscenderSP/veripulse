// ════════════════════════════════════════════════════════════════════════
//  Supabase Edge Function — cron-rss-crawler
//
//  Fetches a rotating slice of our public-source RSS/Atom catalog, pipes
//  each item through Gemini for (1) a tri-lingual 60-word summary and
//  (2) an authenticity scoring pass, then ingests via the ingest_story
//  RPC with full source attribution.
//
//  Legal posture:
//    · We only store the title + a paraphrased Gemini-authored summary;
//      the original body is never republished.
//    · source_name + source_url are stored and displayed on every card so
//      the publisher gets attribution and readers can reach the original.
//    · source_license tags the terms (public_domain, cc_by_nd, fair_use,
//      wire_service) so downstream code can enforce display rules.
//
//  Schedule (every 30 min; or manual trigger with ?feed=<name|lang>):
//    select cron.schedule('rss-crawler','*/30 * * * *',
//      $$ select net.http_post(
//           url := 'https://<project>.functions.supabase.co/cron-rss-crawler',
//           headers := jsonb_build_object('Authorization','Bearer <service-key>')
//         ); $$);
// ════════════════════════════════════════════════════════════════════════

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!;
const TEXT_MODEL = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-2.5-flash';
const EMBED_MODEL = Deno.env.get('GEMINI_EMBED_MODEL') ?? 'gemini-embedding-001';

type Lang = 'en' | 'bn' | 'hi' | 'or' | 'kn' | 'ta' | 'te' | 'ml' | 'mr';
type License =
  | 'public_domain'
  | 'cc_by'
  | 'cc_by_nd'
  | 'cc_by_sa'
  | 'fair_use_summary'
  | 'press_release'
  | 'wire_service';

interface WireFeed {
  name: string;          // Publisher display name
  url: string;           // RSS/Atom endpoint
  lang: Lang;
  region?: string;
  license: License;
  // Keyword filters — when set, we only ingest items whose title/description
  // match at least one of these strings (case-insensitive). Used for
  // hyperlocal buckets like "Purulia from a West Bengal district feed".
  filters?: string[];
}

// ─── CATALOG ────────────────────────────────────────────────────────────
// Only sources with a clear public-source or paraphrase-friendly posture.
// Fair-use-summary = we paraphrase the headline + 60-word digest and link
// back; we never mirror the body.

const GLOBAL_EN: WireFeed[] = [
  { name: 'BBC News (World)',       url: 'https://feeds.bbci.co.uk/news/world/rss.xml',       lang: 'en', region: 'World',   license: 'fair_use_summary' },
  { name: 'BBC News (Top Stories)', url: 'https://feeds.bbci.co.uk/news/rss.xml',             lang: 'en', region: 'World',   license: 'fair_use_summary' },
  { name: 'The Guardian (World)',   url: 'https://www.theguardian.com/world/rss',             lang: 'en', region: 'World',   license: 'fair_use_summary' },
  { name: 'Al Jazeera (English)',   url: 'https://www.aljazeera.com/xml/rss/all.xml',         lang: 'en', region: 'World',   license: 'fair_use_summary' },
  { name: 'The Conversation (US)',  url: 'https://theconversation.com/us/articles.atom',      lang: 'en', region: 'Academia', license: 'cc_by_nd' },
];

const NATIONAL_EN: WireFeed[] = [
  { name: 'PIB India (English)',    url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3', lang: 'en', region: 'India', license: 'public_domain' },
  { name: 'The Hindu (National)',   url: 'https://www.thehindu.com/news/national/?service=rss',     lang: 'en', region: 'India', license: 'fair_use_summary' },
  { name: 'The Hindu (Home)',       url: 'https://www.thehindu.com/?service=rss',                   lang: 'en', region: 'India', license: 'fair_use_summary' },
  { name: 'NDTV (Top Stories)',     url: 'https://feeds.feedburner.com/ndtvnews-top-stories',       lang: 'en', region: 'India', license: 'fair_use_summary' },
  { name: 'ABP Live (India)',       url: 'https://www.abplive.com/news/india/feed',                 lang: 'en', region: 'India', license: 'fair_use_summary' },
];

const TECH_SPORT: WireFeed[] = [
  { name: 'BBC Technology',       url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',          lang: 'en', region: 'Tech',    license: 'fair_use_summary' },
  { name: 'The Hindu (Sci-Tech)', url: 'https://www.thehindu.com/sci-tech/?service=rss',            lang: 'en', region: 'Tech',    license: 'fair_use_summary' },
  { name: 'Wired',                url: 'https://www.wired.com/feed/rss',                            lang: 'en', region: 'Tech',    license: 'fair_use_summary' },
  { name: 'Ars Technica',         url: 'http://feeds.arstechnica.com/arstechnica/index/',           lang: 'en', region: 'Tech',    license: 'fair_use_summary' },
  { name: 'Hacker News (Top)',    url: 'https://news.ycombinator.com/rss',                          lang: 'en', region: 'Tech',    license: 'fair_use_summary' },
  { name: 'BBC Sport',            url: 'https://feeds.bbci.co.uk/sport/rss.xml',                    lang: 'en', region: 'Sports',  license: 'fair_use_summary' },
  { name: 'BBC Football',         url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',           lang: 'en', region: 'Sports',  license: 'fair_use_summary' },
  { name: 'The Hindu (Sport)',    url: 'https://www.thehindu.com/sport/?service=rss',               lang: 'en', region: 'Sports',  license: 'fair_use_summary' },
  { name: 'ESPNcricinfo',         url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', lang: 'en', region: 'Cricket', license: 'fair_use_summary' },
];

const BENGALI: WireFeed[] = [
  { name: 'BBC News বাংলা',        url: 'https://feeds.bbci.co.uk/bengali/rss.xml',                       lang: 'bn', region: 'Bengal', license: 'fair_use_summary' },
  { name: 'ABP Ananda (District)', url: 'https://bengali.abplive.com/district/feed',                       lang: 'bn', region: 'Bengal', license: 'fair_use_summary' },
  { name: 'ABP Ananda (All)',      url: 'https://bengali.abplive.com/news/feed',                           lang: 'bn', region: 'Bengal', license: 'fair_use_summary' },
  { name: 'Sangbad Pratidin',      url: 'https://www.sangbadpratidin.in/feed/',                            lang: 'bn', region: 'Bengal', license: 'fair_use_summary' },
  // Purulia-only slice: keyword-filter the West-Bengal district feed.
  { name: 'ABP Purulia',           url: 'https://bengali.abplive.com/district/feed',                       lang: 'bn', region: 'Purulia', license: 'fair_use_summary', filters: ['purulia', 'পুরুলিয়া', 'বলরামপুর', 'মানবাজার'] },
];

const HINDI: WireFeed[] = [
  { name: 'BBC News हिंदी',        url: 'https://feeds.bbci.co.uk/hindi/rss.xml',                                 lang: 'hi', region: 'India',       license: 'fair_use_summary' },
  { name: 'NDTV Khabar (हिन्दी)',  url: 'https://feeds.feedburner.com/ndtvkhabar',                                 lang: 'hi', region: 'Hindi Belt',  license: 'fair_use_summary' },
  { name: 'Live Hindustan',        url: 'https://api.livehindustan.com/feeds/rss/national/national-news/rssfeed.xml', lang: 'hi', region: 'India',    license: 'fair_use_summary' },
  { name: 'Navbharat Times',       url: 'https://navbharattimes.indiatimes.com/rss',                               lang: 'hi', region: 'India',       license: 'fair_use_summary' },
  { name: 'Navjivan Hindi',        url: 'https://www.navjivanindia.com/stories.rss',                               lang: 'hi', region: 'India',       license: 'fair_use_summary' },
  { name: 'PIB India (Hindi)',     url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=3',                  lang: 'hi', region: 'India',       license: 'public_domain' },
];

const ODIA: WireFeed[] = [
  { name: 'Odisha Public Khabar',  url: 'https://odishapublickhabar.com/feed',                                    lang: 'or', region: 'Odisha',      license: 'fair_use_summary' },
  { name: 'Live Hindustan Odisha', url: 'https://api.livehindustan.com/feeds/rss/odisha/rssfeed.xml',             lang: 'or', region: 'Odisha',      license: 'fair_use_summary' },
];

const KANNADA: WireFeed[] = [
  { name: 'OneIndia Kannada',      url: 'https://kannada.oneindia.com/rss/kannada-news-fb.xml',                   lang: 'kn', region: 'Karnataka',   license: 'fair_use_summary' },
  { name: 'FilmiBeat Kannada',     url: 'https://kannada.filmibeat.com/rss/feeds/filmibeat-kannada-fb.xml',       lang: 'kn', region: 'Karnataka',   license: 'fair_use_summary' },
];

const TAMIL: WireFeed[] = [
  { name: 'OneIndia Tamil',        url: 'https://tamil.oneindia.com/rss/tamil-news-fb.xml',                        lang: 'ta', region: 'Tamil Nadu',  license: 'fair_use_summary' },
  { name: 'Dinamalar',             url: 'https://www.dinamalar.com/rss.asp',                                       lang: 'ta', region: 'Tamil Nadu',  license: 'fair_use_summary' },
];

const TELUGU: WireFeed[] = [
  { name: 'OneIndia Telugu',       url: 'https://telugu.oneindia.com/rss/telugu-news-fb.xml',                      lang: 'te', region: 'AP/Telangana', license: 'fair_use_summary' },
];

const MALAYALAM: WireFeed[] = [
  { name: 'OneIndia Malayalam',    url: 'https://malayalam.oneindia.com/rss/malayalam-news-fb.xml',                lang: 'ml', region: 'Kerala',      license: 'fair_use_summary' },
  { name: 'Mathrubhumi',           url: 'https://www.mathrubhumi.com/rss',                                         lang: 'ml', region: 'Kerala',      license: 'fair_use_summary' },
];

const MARATHI: WireFeed[] = [
  { name: 'Maharashtra Times',     url: 'https://maharashtratimes.com/rss',                                        lang: 'mr', region: 'Maharashtra', license: 'fair_use_summary' },
  { name: 'Lokmat',                url: 'https://www.lokmat.com/rss/',                                             lang: 'mr', region: 'Maharashtra', license: 'fair_use_summary' },
];

const ALL_FEEDS: WireFeed[] = [
  ...GLOBAL_EN,
  ...NATIONAL_EN,
  ...TECH_SPORT,
  ...BENGALI,
  ...HINDI,
  ...ODIA,
  ...KANNADA,
  ...TAMIL,
  ...TELUGU,
  ...MALAYALAM,
  ...MARATHI,
];

// Round-robin schedule buckets (one slice per 30-min run). Each bucket pulls
// ~1 item from ~4 feeds, keeping the function well under Edge compute caps.
const SCHEDULE: WireFeed[][] = [
  [GLOBAL_EN[0], NATIONAL_EN[0], BENGALI[0], HINDI[0]],
  [GLOBAL_EN[1], NATIONAL_EN[1], BENGALI[1], HINDI[1]],
  [GLOBAL_EN[2], NATIONAL_EN[2], BENGALI[2], HINDI[2]],
  [GLOBAL_EN[3], NATIONAL_EN[3], BENGALI[3], HINDI[3]],
  [GLOBAL_EN[4], NATIONAL_EN[4], BENGALI[4], HINDI[4]],
  [TECH_SPORT[0], TECH_SPORT[1], TECH_SPORT[5], HINDI[5]],
  [TECH_SPORT[2], TECH_SPORT[3], TECH_SPORT[6], ODIA[0]],
  [TECH_SPORT[4], TECH_SPORT[7], TECH_SPORT[8], ODIA[1]],
  [KANNADA[0], TAMIL[0], TELUGU[0], MALAYALAM[0]],
  [KANNADA[1], TAMIL[1], MALAYALAM[1], MARATHI[0]],
  [MARATHI[1], GLOBAL_EN[0], NATIONAL_EN[0], BENGALI[0]],
];
const MAX_ITEMS_PER_FEED = 1;

// ─── category → stock reference image fallback ──────────────────────────
const CATEGORY_REF_IMAGES: Record<string, string> = {
  politics: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
  civic: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80',
  business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  science: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  health: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
  weather: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80',
  environment: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80',
  crime: 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?auto=format&fit=crop&w=800&q=80',
  vehicle: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
  sports: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80',
  entertainment: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80',
  general: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80',
};
function refImage(category?: string | null): string {
  if (!category) return CATEGORY_REF_IMAGES.general;
  const key = category.toLowerCase().trim();
  for (const [k, u] of Object.entries(CATEGORY_REF_IMAGES)) if (key.includes(k)) return u;
  return CATEGORY_REF_IMAGES.general;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ─── RSS parsing (title + description + link) ───────────────────────────
interface ParsedItem {
  title: string;
  description: string;
  link: string;
}
function parseRss(xml: string, limit = 1): ParsedItem[] {
  const items: ParsedItem[] = [];
  // Try <item> (RSS) first, fall back to <entry> (Atom).
  const rssBlocks = xml.split(/<item[\s>]/i).slice(1);
  const atomBlocks = rssBlocks.length === 0 ? xml.split(/<entry[\s>]/i).slice(1) : [];
  const blocks = (rssBlocks.length ? rssBlocks : atomBlocks).slice(0, limit);
  for (const b of blocks) {
    const title = clean(match(b, /<title[^>]*>([\s\S]*?)<\/title>/i));
    const desc = clean(match(b, /<description[^>]*>([\s\S]*?)<\/description>/i)
                    || match(b, /<summary[^>]*>([\s\S]*?)<\/summary>/i)
                    || match(b, /<content[^>]*>([\s\S]*?)<\/content>/i));
    // RSS <link>…</link> or Atom <link href="…"/>
    const link =
      match(b, /<link[^>]*href=["']([^"']+)["']/i) ||
      match(b, /<link[^>]*>([^<]+)<\/link>/i) ||
      '';
    if (title) items.push({ title, description: desc, link: link.trim() });
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

// ─── Gemini helpers ─────────────────────────────────────────────────────
async function geminiJson(prompt: string): Promise<any> {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
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
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return parseJson(raw);
}

async function embed(text: string): Promise<number[]> {
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
  if (!res.ok) throw new Error(`Embed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.embedding?.values ?? [];
}

function parseJson(raw: string): any {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : raw;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a === -1 || b === -1) return {};
  try { return JSON.parse(body.slice(a, b + 1)); } catch { return {}; }
}

function clampWords(s: string, n = 60): string {
  const w = (s || '').trim().split(/\s+/).filter(Boolean);
  return w.length <= n ? (s || '').trim() : w.slice(0, n).join(' ');
}

// ─── Authenticity scoring ───────────────────────────────────────────────
interface AuthenticityResult {
  score: number;              // 0-100
  flags: string[];            // e.g. ["clickbait_headline", "unsourced_claim"]
  risk_level: 'low' | 'medium' | 'high';
}

async function scoreAuthenticity(
  title: string,
  description: string,
  sourceName: string,
  sourceLicense: License,
): Promise<AuthenticityResult> {
  try {
    const prompt = `You are a fact-checking triage model. Rate the authenticity of this news item.

Return STRICT JSON with this shape:
{
  "score": 0-100,
  "flags": ["..."],
  "risk_level": "low" | "medium" | "high"
}

Flag codes to use (pick any that apply, including positive signals):
- attributed            (claims point to named sources)
- well_sourced          (official body, major agency, or named witness)
- neutral_tone          (reporting voice, not editorial)
- clickbait_headline    (headline exaggerates relative to body)
- emotional_language    (loaded words, outrage framing)
- unsourced_claim       (strong claim, no attribution)
- numerical_mismatch    (numbers in headline don't match body)
- editorial             (opinion piece framed as reporting)
- satire_likely         (humour/parody)
- scraping_artefact     (truncated / broken OCR / template boilerplate)

Scoring rubric:
- 85-100 = official source or well-sourced reporting, neutral tone, no red flags
- 60-84  = routine reporting, minor issues (one soft flag)
- 40-59  = mixed signals, missing attribution OR obvious editorialising
- 0-39   = clickbait, unsourced, satire, or scraping artefact

Source publisher: "${sourceName}" (license: ${sourceLicense})
Headline: """${title.slice(0, 400)}"""
Body:    """${description.slice(0, 1500)}"""`;

    const r = await geminiJson(prompt);
    const score = typeof r.score === 'number' ? Math.max(0, Math.min(100, Math.round(r.score * 100) / 100)) : 70;
    const flags = Array.isArray(r.flags) ? r.flags.filter((x: unknown) => typeof x === 'string').slice(0, 10) : [];
    const risk = r.risk_level === 'high' || r.risk_level === 'medium' || r.risk_level === 'low' ? r.risk_level : 'medium';
    return { score, flags, risk_level: risk };
  } catch {
    // Any model-side failure is non-fatal; the story still ingests, just
    // without a score. The UI shows "Not scored" in that case.
    return { score: 70, flags: ['model_unavailable'], risk_level: 'medium' };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  let ingested = 0;
  let merged = 0;
  const errors: string[] = [];
  const sources: { name: string; ok: boolean }[] = [];
  const startedAt = new Date().toISOString();

  const url = new URL(req.url);
  const targetFilter = url.searchParams.get('feed')?.toLowerCase();
  const forceAll = url.searchParams.get('all') === 'true';

  let activeFeeds: WireFeed[] = [];
  if (targetFilter) {
    activeFeeds = ALL_FEEDS.filter(
      (f) =>
        f.name.toLowerCase().includes(targetFilter) ||
        f.lang === targetFilter ||
        (f.region ?? '').toLowerCase().includes(targetFilter),
    );
  } else if (forceAll) {
    activeFeeds = ALL_FEEDS;
  } else {
    // Round-robin schedule: one bucket per 30-min slot.
    const slot = Math.floor(Date.now() / (30 * 60 * 1000));
    activeFeeds = SCHEDULE[slot % SCHEDULE.length];
  }

  for (const feed of activeFeeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'VeriPulse-Crawler/1.0 (+https://veripulse.org)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
      const xml = await res.text();
      sources.push({ name: feed.name, ok: true });
      let items = parseRss(xml, MAX_ITEMS_PER_FEED + 4);
      // Keyword filter if the feed has one (Purulia slice from WB district feed)
      if (feed.filters && feed.filters.length) {
        const needles = feed.filters.map((s) => s.toLowerCase());
        items = items.filter((it) => {
          const hay = `${it.title} ${it.description}`.toLowerCase();
          return needles.some((n) => hay.includes(n));
        });
      }
      items = items.slice(0, MAX_ITEMS_PER_FEED);

      for (const it of items) {
        try {
          const raw = `${it.title}. ${it.description}`.slice(0, 4000);
          const summaryPrompt = `Summarise this news wire item as STRICT JSON:
{"titles":{"en":"","bn":"","hi":""},"summaries":{"en":"","bn":"","hi":""},
"location":"City or State or India or Wire",
"completeness_score":0-100,"ai_probability_score":0-100,
"category":"Civic|Crime|Politics|Weather|Electronics|Vehicle|Health|Sports|Tech|Entertainment|Other"}
Each summary <=60 words. Translate to English/Bengali/Hindi regardless of source language. No invented facts.
Item: """${raw}"""`;

          const analysis = await geminiJson(summaryPrompt);
          const titles = {
            en: analysis.titles?.en || it.title || 'Breaking Wire Update',
            bn: analysis.titles?.bn || analysis.titles?.en || it.title || 'ব্রেকিং আপডেট',
            hi: analysis.titles?.hi || analysis.titles?.en || it.title || 'ब्रेकिंग अपडेट',
          };
          const summaries = {
            en: clampWords(analysis.summaries?.en || it.description || it.title || ''),
            bn: clampWords(analysis.summaries?.bn || analysis.summaries?.en || it.description || it.title || ''),
            hi: clampWords(analysis.summaries?.hi || analysis.summaries?.en || it.description || it.title || ''),
          };

          // Authenticity pass (independent so a failure in one doesn't block the other).
          const authenticity = await scoreAuthenticity(it.title, it.description, feed.name, feed.license);

          const vector = await embed(`${titles.en}. ${summaries.en}`);
          if (vector.length !== 768) continue;

          const locationName =
            analysis.location && analysis.location !== 'Wire'
              ? analysis.location
              : feed.region || 'Wire';
          const image = refImage(analysis.category);

          // Dedup window: 12h cosine-similarity merge.
          const { data: dupData } = await admin.rpc('find_duplicate_story', {
            p_embedding: vector,
            p_threshold: 0.84,
            p_window_hours: 12,
          });
          const dup = Array.isArray(dupData) ? dupData[0] : dupData;

          if (dup?.story_id) {
            const { data: oldStory } = await admin
              .from('stories')
              .select('*')
              .eq('id', dup.story_id)
              .single();
            if (oldStory) {
              await admin.from('story_timeline').insert({
                story_id: dup.story_id,
                contributor_id: oldStory.author_id,
                update_text: {
                  titles: oldStory.titles,
                  summaries: oldStory.summaries,
                  headline: oldStory.titles?.en || 'Earlier Wire Update',
                  summary: oldStory.summaries?.en || '',
                  en: oldStory.summaries?.en || '',
                  bn: oldStory.summaries?.bn || '',
                  hi: oldStory.summaries?.hi || '',
                  source_name: (oldStory as any).source_name ?? null,
                  source_url: (oldStory as any).source_url ?? null,
                },
                media_url: oldStory.media_url || image,
                created_at: oldStory.updated_at || oldStory.created_at,
              });

              await admin
                .from('stories')
                .update({
                  titles,
                  summaries,
                  embedding: vector,
                  media_url: image,
                  location_name: locationName,
                  category: analysis.category ?? oldStory.category,
                  rollout_stage: 'public',
                  source_name: feed.name,
                  source_url: it.link || (oldStory as any).source_url || null,
                  source_license: feed.license,
                  authenticity_score: authenticity.score,
                  authenticity_flags: authenticity.flags,
                  authenticity_checked_at: new Date().toISOString(),
                  // Seed credibility from the AI authenticity score so the
                  // listing reflects the model's first read. Citizen votes
                  // shift it from there via consume_vote.
                  credibility_score: authenticity.score,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', dup.story_id);
              merged++;
            }
          } else {
            const { data, error } = await admin.rpc('ingest_story', {
              p_author: null,
              p_category: analysis.category ?? 'Other',
              p_location_name: locationName,
              p_lat: null,
              p_lng: null,
              p_titles: titles,
              p_summaries: summaries,
              p_media_url: image,
              p_media_type: 'image',
              p_c2pa: false,
              p_ai_prob: analysis.ai_probability_score ?? 0,
              p_completeness: analysis.completeness_score ?? 50,
              p_embedding: vector,
              p_source: 'rss',
            });
            if (error) {
              errors.push(error.message);
            } else {
              const row = Array.isArray(data) ? data[0] : data;
              if (row?.action === 'merged_timeline') {
                merged++;
              } else if (row?.story_id) {
                ingested++;
                // Stamp attribution + authenticity + public rollout on the fresh row.
                await admin
                  .from('stories')
                  .update({
                    rollout_stage: 'public',
                    media_url: image,
                    source_name: feed.name,
                    source_url: it.link || null,
                    source_license: feed.license,
                    authenticity_score: authenticity.score,
                    authenticity_flags: authenticity.flags,
                    authenticity_checked_at: new Date().toISOString(),
                    credibility_score: authenticity.score,
                  })
                  .eq('id', row.story_id);
              }
            }
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

  await admin.from('crawler_runs').insert({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    ingested,
    merged,
    errors: errors.length,
    sources,
  });

  return new Response(
    JSON.stringify({
      ingested,
      merged,
      activeFeeds: activeFeeds.map((f) => ({ name: f.name, lang: f.lang, license: f.license })),
      errors: errors.slice(0, 5),
      at: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
