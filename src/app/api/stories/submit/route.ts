import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, createSupabaseAdminClient } from '@/lib/supabase/server';
import { analyzeStory, embedText } from '@/lib/gemini';
import { getReferenceImage } from '@/lib/referenceImages';
import { checkPostLimit } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stories/submit
 * Body: { text, location_name, lat?, lng?, media_url?, media_type?, captured_at? }
 *
 * 1. Authenticate the caller (RLS user session).
 * 2. Gemini: 60-word EN/BN/HI summaries + completeness + AI-fake score + category.
 * 3. Gemini: 768-d embedding.
 * 4. ingest_story RPC (service role): dedup → merge-timeline OR create-primary.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }

    // Daily post-limit guard — read with service role so it never races the
    // caller's RLS view of their own profile (edge case: a new row that
    // hasn't yet replicated to the user's session).
    const limitClient = createSupabaseAdminClient();
    const limitDecision = await checkPostLimit(limitClient, user.id);
    if (!limitDecision.allowed) {
      const { reason, state } = limitDecision;
      const human =
        reason === 'POST_FORBIDDEN'
          ? state.dailyLimit === 0 && state.remaining === 0
            ? 'Your account is suspended or set to Reader. Appeal via support if this is a mistake.'
            : 'Your account tier (Reader) can’t post. Upgrade to Citizen Reporter or above.'
          : reason === 'JOURNALIST_PENDING_LIMIT_REACHED'
            ? `You’ve used ${state.postsLast24h}/${state.dailyLimit} posts while your press credentials are under review. Try again tomorrow.`
            : reason === 'SUBSCRIPTION_EXPIRED'
              ? 'Your Pro subscription has lapsed. You’ve been dropped to the free limit for now.'
              : `Daily post limit reached (${state.postsLast24h}/${state.dailyLimit}). Try again in 24h or upgrade.`;
      return NextResponse.json(
        { error: reason, message: human, state },
        { status: 429 },
      );
    }

    const body = await req.json();
    const text: string = (body.text ?? '').toString().trim();
    if (text.length < 20) {
      return NextResponse.json({ error: 'REPORT_TOO_SHORT' }, { status: 400 });
    }

    const locationName: string = (body.location_name ?? 'Unknown').toString();
    const lat = body.lat != null ? Number(body.lat) : null;
    const lng = body.lng != null ? Number(body.lng) : null;
    const mediaType: string = body.media_type === 'video' ? 'video' : 'image';

    // Media must live in the caller's own folder of the evidence bucket
    // (uploaded by the client via Storage RLS) — arbitrary URLs are dropped.
    const ownPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidence/${user.id}/`;
    const mediaUrl: string | null =
      typeof body.media_url === 'string' && body.media_url.startsWith(ownPrefix) ? body.media_url : null;

    // Capture provenance is decided here, not by the client flag: in-app
    // camera capture into the user's evidence folder, with a GPS lock and a
    // capture timestamp no older than 15 minutes.
    // TODO: replace with full C2PA manifest validation (c2pa-node) once the
    // native capture plugin signs manifests.
    const capturedAt = Date.parse(body.captured_at ?? '');
    const c2pa =
      mediaUrl !== null &&
      lat !== null &&
      lng !== null &&
      Number.isFinite(capturedAt) &&
      Date.now() - capturedAt < 15 * 60 * 1000;

    // ── Gemini analysis, then embed the English summary ──
    const analysis = await analyzeStory(text);
    const embedSource = `${analysis.titles.en}. ${analysis.summaries.en}`;
    const embedding = await embedText(embedSource);

    const finalMediaUrl = mediaUrl || getReferenceImage(analysis.category);

    // ── Atomic ingest with dedup (service role bypasses RLS deliberately) ──
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('ingest_story', {
      p_author: user.id,
      p_category: analysis.category,
      p_location_name: locationName,
      p_lat: lat,
      p_lng: lng,
      p_titles: analysis.titles,
      p_summaries: analysis.summaries,
      p_media_url: finalMediaUrl,
      p_media_type: mediaType,
      p_c2pa: c2pa,
      p_ai_prob: analysis.ai_probability_score,
      p_completeness: analysis.completeness_score,
      p_embedding: embedding,
      p_source: 'citizen',
    });

    if (error) {
      return NextResponse.json({ error: 'INGEST_FAILED', detail: error.message }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    // If merged into an existing story: add older news into timeline and promote latest news as primary
    if (result?.action === 'merged_timeline' && result?.story_id) {
      const { data: oldStory } = await admin
        .from('stories')
        .select('*')
        .eq('id', result.story_id)
        .single();

      if (oldStory) {
        // Add the older news into the timeline of the latest news
        await admin.from('story_timeline').insert({
          story_id: result.story_id,
          contributor_id: oldStory.author_id,
          update_text: {
            titles: oldStory.titles,
            summaries: oldStory.summaries,
            headline: oldStory.titles?.en || 'Earlier Dispatch',
            summary: oldStory.summaries?.en || '',
            en: oldStory.summaries?.en || '',
            bn: oldStory.summaries?.bn || '',
            hi: oldStory.summaries?.hi || '',
          },
          media_url: oldStory.media_url || finalMediaUrl,
          created_at: oldStory.updated_at || oldStory.created_at,
        });

        // Promote the latest news as the primary card and refresh timestamp
        await admin
          .from('stories')
          .update({
            titles: analysis.titles,
            summaries: analysis.summaries,
            embedding,
            media_url: finalMediaUrl,
            completeness_score: Math.max(analysis.completeness_score, oldStory.completeness_score || 50),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.story_id);
      }
    }

    return NextResponse.json({
      story_id: result?.story_id,
      action: result?.action, // 'created_primary' | 'merged_timeline'
      analysis: {
        titles: analysis.titles,
        completeness_score: analysis.completeness_score,
        ai_probability_score: analysis.ai_probability_score,
        category: analysis.category,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return NextResponse.json({ error: 'SERVER_ERROR', detail: msg }, { status: 500 });
  }
}
