import { NextResponse } from 'next/server';
import type { LiveNewsItem } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/demoData';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getReferenceImage } from '@/lib/referenceImages';
export type { LiveNewsItem };

const FALLBACK_NEWS: LiveNewsItem[] = [
  {
    id: 'live-1',
    title: 'Supreme Court upholds right to digital privacy in landmark Aadhaar ruling',
    description: 'The bench ruled that biometric data cannot be shared with private entities without explicit consent, strengthening India\'s data protection framework.',
    url: 'https://main.sci.gov.in',
    source: 'Supreme Court of India',
    image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    publishedAt: new Date(Date.now() - 1800000).toISOString(),
    category: 'politics',
  },
  {
    id: 'live-2',
    title: 'ISRO successfully tests reusable launch vehicle with autonomous landing',
    description: 'The RLV-TD completed its fifth experimental flight, landing autonomously on a runway at Sriharikota. Full orbital reusability targeted by 2028.',
    url: 'https://isro.gov.in',
    source: 'ISRO',
    image: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?auto=format&fit=crop&w=400&q=80',
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    category: 'science',
  },
  {
    id: 'live-3',
    title: 'Kolkata Metro completes first trial run on underwater tunnel stretch',
    description: 'East-West corridor\'s Howrah-Esplanade section under the Hooghly river sees maiden test run. Public operations expected by Q1 2027.',
    url: 'https://mtp.indianrailways.gov.in',
    source: 'Metro Railway Kolkata',
    image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=400&q=80',
    publishedAt: new Date(Date.now() - 5400000).toISOString(),
    category: 'infrastructure',
  },
  {
    id: 'live-4',
    title: 'RBI introduces UPI Lite X for offline payments up to ₹500',
    description: 'The new protocol uses NFC-based near-field communication, enabling UPI payments even without internet connectivity in rural areas.',
    url: 'https://rbi.org.in',
    source: 'Reserve Bank of India',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=400&q=80',
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    category: 'finance',
  },
  {
    id: 'live-5',
    title: 'Poco X7 Pro review: gaming performance drops 18% after 15 minutes',
    description: 'Community thermal test reveals sustained throttling under heavy load. Battery drains 22% in 30-minute gaming session at max brightness.',
    url: '#',
    source: 'VeriPulse Community',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
    publishedAt: new Date(Date.now() - 9000000).toISOString(),
    category: 'technology',
  },
];

export async function GET() {
  // 1. Try fetching directly from our live Supabase database
  if (isSupabaseConfigured()) {
    try {
      const sb = await createSupabaseServerClient();
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const { data } = await sb
        .from('stories')
        .select('*')
        .eq('rollout_stage', 'public')
        .gte('created_at', twelveHoursAgo)
        .order('created_at', { ascending: false })
        .limit(10);

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
        return NextResponse.json({ items, source: 'live' });
      }
    } catch {
      // fall through to external feeds
    }
  }
  try {
    const res = await fetch(
      'https://api.currentsapi.services/v1/latest-news?language=en&country=IN',
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.news?.length) {
        const items: LiveNewsItem[] = data.news.slice(0, 8).map((n: any, i: number) => ({
          id: `currents-${i}`,
          title: n.title,
          description: n.description?.slice(0, 200) || '',
          url: n.url,
          source: n.author || 'Currents',
          image: n.image !== 'None' ? n.image : null,
          publishedAt: n.published,
          category: (n.category?.[0] || 'general').toLowerCase(),
        }));
        return NextResponse.json({ items, source: 'currents' });
      }
    }
  } catch {
    // fall through to fallback
  }

  // Try GNews free tier (no API key, limited)
  try {
    const res = await fetch(
      'https://gnews.io/api/v4/top-headlines?lang=en&country=in&max=8',
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.articles?.length) {
        const items: LiveNewsItem[] = data.articles.slice(0, 8).map((a: any, i: number) => ({
          id: `gnews-${i}`,
          title: a.title,
          description: a.description?.slice(0, 200) || '',
          url: a.url,
          source: a.source?.name || 'GNews',
          image: a.image,
          publishedAt: a.publishedAt,
          category: 'general',
        }));
        return NextResponse.json({ items, source: 'gnews' });
      }
    }
  } catch {
    // fall through to fallback
  }

  // Fallback to curated demo data
  return NextResponse.json({ items: FALLBACK_NEWS, source: 'demo' });
}
