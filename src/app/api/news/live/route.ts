import { NextResponse } from 'next/server';
import type { LiveNewsItem } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/demoData';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getReferenceImage, isNewsExpired } from '@/lib/referenceImages';
export type { LiveNewsItem };

// In-memory cache for ultra-fast < 5ms response
let cachedResponse: { items: LiveNewsItem[]; source: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getFreshFallbackNews(): LiveNewsItem[] {
  const now = Date.now();
  return [
    {
      id: 'live-1',
      title: 'Supreme Court upholds right to digital privacy in landmark Aadhaar ruling',
      description: 'The bench ruled that biometric data cannot be shared with private entities without explicit consent, strengthening India\'s data protection framework.',
      url: 'https://main.sci.gov.in',
      source: 'Supreme Court of India',
      image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
      publishedAt: new Date(now - 18 * 60 * 1000).toISOString(),
      category: 'politics',
    },
    {
      id: 'live-2',
      title: 'ISRO successfully tests reusable launch vehicle with autonomous landing',
      description: 'The RLV-TD completed its fifth experimental flight, landing autonomously on a runway at Sriharikota. Full orbital reusability targeted by 2028.',
      url: 'https://isro.gov.in',
      source: 'ISRO',
      image: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?auto=format&fit=crop&w=400&q=80',
      publishedAt: new Date(now - 45 * 60 * 1000).toISOString(),
      category: 'science',
    },
    {
      id: 'live-3',
      title: 'Kolkata Metro completes trial run on underwater Hooghly tunnel stretch',
      description: 'East-West corridor Howrah-Esplanade section under the Hooghly river sees maiden test run. Public operations underway with automated signaling.',
      url: 'https://mtp.indianrailways.gov.in',
      source: 'Metro Railway Kolkata',
      image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=400&q=80',
      publishedAt: new Date(now - 75 * 60 * 1000).toISOString(),
      category: 'infrastructure',
    },
    {
      id: 'live-4',
      title: 'RBI introduces UPI Lite X for offline payments up to ₹500',
      description: 'The new protocol uses NFC-based near-field communication, enabling UPI payments even without internet connectivity in transit and rural hubs.',
      url: 'https://rbi.org.in',
      source: 'Reserve Bank of India',
      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=400&q=80',
      publishedAt: new Date(now - 120 * 60 * 1000).toISOString(),
      category: 'finance',
    },
    {
      id: 'live-5',
      title: 'Poco X7 Pro review: gaming performance drops 18% after 15 minutes',
      description: 'Community thermal test reveals sustained throttling under heavy load. Battery drains 22% in 30-minute gaming session at max brightness.',
      url: '#',
      source: 'VeriPulse Community',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
      publishedAt: new Date(now - 180 * 60 * 1000).toISOString(),
      category: 'technology',
    },
  ];
}

export async function GET() {
  const now = Date.now();

  // Return fresh in-memory cache if valid
  if (cachedResponse && now - cachedResponse.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      { items: cachedResponse.items, source: cachedResponse.source },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  }

  // 1. Try fetching directly from our live Supabase database
  if (isSupabaseConfigured()) {
    try {
      const sb = await createSupabaseServerClient();
      const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000).toISOString();
      const { data } = await sb
        .from('stories')
        .select('*')
        .eq('rollout_stage', 'public')
        .gte('created_at', twelveHoursAgo)
        .order('created_at', { ascending: false })
        .limit(12);

      if (data && data.length > 0) {
        const items: LiveNewsItem[] = data.map((s: any) => ({
          id: s.id,
          title: typeof s.titles === 'object' ? (s.titles?.en || s.titles?.bn || s.titles?.hi) : s.titles,
          description: typeof s.summaries === 'object' ? (s.summaries?.en || s.summaries?.bn || s.summaries?.hi || '').slice(0, 200) : s.summaries,
          url: s.media_url || '#',
          source: s.source === 'rss' ? 'Wire Agency' : 'Verified Sentinel',
          image: s.media_url || getReferenceImage(s.category),
          publishedAt: s.created_at,
          category: (s.category || 'general').toLowerCase(),
        }));

        cachedResponse = { items, source: 'live', timestamp: now };
        return NextResponse.json(
          { items, source: 'live' },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
          },
        );
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback to instantly available curated news (avoiding blocking 5000ms timeouts)
  const fallback = getFreshFallbackNews();
  cachedResponse = { items: fallback, source: 'curated', timestamp: now };
  return NextResponse.json(
    { items: fallback, source: 'curated' },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
}
