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
const TEXT_MODEL = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-3.5-flash-lite';
const EMBED_MODEL = Deno.env.get('GEMINI_EMBED_MODEL') ?? 'gemini-embedding-001';

// Regional + global wire coverage. Reuters and PTI no longer publish open
// RSS, so their wires are reached through Google News source filters.
// Regional feeds include verified Bengali (বাংলা) and Hindi (हिन्दी) news wires.
interface WireFeed {
  name: string;
  url: string;
  lang: 'en' | 'bn' | 'hi';
  region?: string;
}

const EN_FEEDS: WireFeed[] = [
  { name: 'Google News India (EN)', url: 'https://news.google.com/rss/search?q=Kolkata+OR+%22West+Bengal%22&hl=en-IN&gl=IN&ceid=IN:en', lang: 'en', region: 'India' },
  { name: 'PTI wire (EN)', url: 'https://news.google.com/rss/search?q=PTI+India+when:1d&hl=en-IN&gl=IN&ceid=IN:en', lang: 'en', region: 'India' },
  { name: 'Reuters India (EN)', url: 'https://news.google.com/rss/search?q=source:Reuters+India+when:1d&hl=en-IN&gl=IN&ceid=IN:en', lang: 'en', region: 'India' },
  { name: 'The Hindu (EN)', url: 'https://www.thehindu.com/news/national/feeder/default.rss', lang: 'en', region: 'India' },
];

const REGIONAL_FEEDS: WireFeed[] = [
  // Bengali Regional (বাংলা)
  { name: 'BBC News বাংলা', url: 'https://feeds.bbci.co.uk/bengali/rss.xml', lang: 'bn', region: 'West Bengal / Regional' },
  { name: 'Google News বাংলা', url: 'https://news.google.com/rss?hl=bn&gl=IN&ceid=IN:bn', lang: 'bn', region: 'West Bengal' },
  { name: 'Anandabazar / WB Wire', url: 'https://news.google.com/rss/search?q=%E0%A6%AA%E0%A6%B6%E0%A7%8D%E0%A6%9A%E0%A6%BF%E0%A6%AE%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%97+when:1d&hl=bn&gl=IN&ceid=IN:bn', lang: 'bn', region: 'West Bengal' },
  // Hindi Regional (हिन्दी)
  { name: 'BBC News हिंदी', url: 'https://feeds.bbci.co.uk/hindi/rss.xml', lang: 'hi', region: 'India / Regional' },
  { name: 'Google News हिंदी', url: 'https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi', lang: 'hi', region: 'National / Hindi Belt' },
  { name: 'NDTV Khabar (हिन्दी)', url: 'https://feeds.feedburner.com/ndtvkhabar', lang: 'hi', region: 'National / Hindi Belt' },
];

const ALL_FEEDS: WireFeed[] = [...EN_FEEDS, ...REGIONAL_FEEDS];
const MAX_PER_RUN = 4;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── minimal RSS parse (title + description of first N items) ──
function parseRss(xml: string, limit = 1): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1, limit + 1);
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

Deno.serve(async (req: Request) => {
  let ingested = 0;
  let merged = 0;
  const errors: string[] = [];
  const sources: { name: string; ok: boolean }[] = [];
  const startedAt = new Date().toISOString();

  // Support manual triggers and query parameters (e.g. ?feed=bengali or ?feed=hindi or ?all=true)
  const url = new URL(req.url);
  const targetFilter = url.searchParams.get('feed')?.toLowerCase();
  const forceAll = url.searchParams.get('all') === 'true';

  let activeFeeds: WireFeed[] = [];
  if (targetFilter) {
    activeFeeds = ALL_FEEDS.filter(
      (f) => f.name.toLowerCase().includes(targetFilter) || f.lang === targetFilter,
    );
  } else if (forceAll) {
    activeFeeds = ALL_FEEDS.slice(0, MAX_PER_RUN);
  }

  if (activeFeeds.length === 0) {
    // Scheduled round-robin: Pair 1 English feed + 1 Regional feed (Bengali / Hindi) per run.
    // At 2 items per 30-min run, memory stays < 25MB and execution finishes in ~4-6 seconds,
    // well within Supabase Edge compute limits while giving balanced national and regional coverage.
    const slot = Math.floor(Date.now() / (30 * 60 * 1000));
    const enFeed = EN_FEEDS[slot % EN_FEEDS.length];
    const regionalFeed = REGIONAL_FEEDS[slot % REGIONAL_FEEDS.length];
    activeFeeds = [enFeed, regionalFeed];
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
      const items = parseRss(xml, 1);

      for (const it of items) {
        try {
          const raw = `${it.title}. ${it.description}`.slice(0, 4000);
          const prompt = `Summarise this news wire item as STRICT JSON:
{"titles":{"en":"","bn":"","hi":""},"summaries":{"en":"","bn":"","hi":""},
"location":"City or State or India or Wire",
"completeness_score":0-100,"ai_probability_score":0-100,
"category":"Civic|Crime|Politics|Weather|Electronics|Vehicle|Health|Other"}
Each summary <=60 words. Translate to English/Bengali/Hindi regardless of source language. No invented facts.
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

          const locationName = (rawAnalysis.location && rawAnalysis.location !== 'Wire')
            ? rawAnalysis.location
            : (feed.region || 'Wire');

          const { data, error } = await admin.rpc('ingest_story', {
            p_author: null,
            p_category: rawAnalysis.category ?? 'Other',
            p_location_name: locationName,
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
    JSON.stringify({
      ingested,
      merged,
      activeFeeds: activeFeeds.map((f) => f.name),
      errors: errors.slice(0, 5),
      at: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
