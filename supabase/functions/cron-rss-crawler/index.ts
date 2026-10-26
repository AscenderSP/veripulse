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

// ── Reference Images for Categories (Fallback when unsubmitted/unverified) ──
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

function getReferenceImage(category?: string | null): string {
  if (!category) return CATEGORY_REF_IMAGES.general;
  const key = category.toLowerCase().trim();
  for (const [k, url] of Object.entries(CATEGORY_REF_IMAGES)) {
    if (key.includes(k)) return url;
  }
  return CATEGORY_REF_IMAGES.general;
}

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

          const refImage = getReferenceImage(rawAnalysis.category);

          // 12-Hour Dedup & Update Window: Check if related news exists
          const { data: dupData } = await admin.rpc('find_duplicate_story', {
            p_embedding: vector,
            p_threshold: 0.84,
            p_window_hours: 12,
          });

          const dup = Array.isArray(dupData) ? dupData[0] : dupData;

          if (dup?.story_id) {
            // An update on the same news has arrived:
            // 1. Fetch the OLDER news
            const { data: oldStory } = await admin
              .from('stories')
              .select('*')
              .eq('id', dup.story_id)
              .single();

            if (oldStory) {
              // 2. Add the OLDER news into the timeline of the latest news
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
                },
                media_url: oldStory.media_url || refImage,
                created_at: oldStory.updated_at || oldStory.created_at,
              });

              // 3. Promote the LATEST news as the primary card and refresh timestamp to now
              await admin
                .from('stories')
                .update({
                  titles,
                  summaries,
                  embedding: vector,
                  media_url: refImage,
                  location_name: locationName,
                  category: rawAnalysis.category ?? oldStory.category,
                  rollout_stage: 'public',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', dup.story_id);

              merged++;
            }
          } else {
            // Fresh primary story
            const { data, error } = await admin.rpc('ingest_story', {
              p_author: null,
              p_category: rawAnalysis.category ?? 'Other',
              p_location_name: locationName,
              p_lat: null,
              p_lng: null,
              p_titles: titles,
              p_summaries: summaries,
              p_media_url: refImage,
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
              else {
                ingested++;
                // Ensure wire stories are public for live feed display
                if (row?.story_id) {
                  await admin.from('stories').update({ rollout_stage: 'public', media_url: refImage }).eq('id', row.story_id);
                }
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
