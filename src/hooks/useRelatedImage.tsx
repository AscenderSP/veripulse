'use client';

import { useEffect, useState } from 'react';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

const STOP_WORDS = new Set([
  'a','an','the','of','in','on','for','to','and','or','but','is','are','was','were',
  'be','been','being','as','by','at','with','from','about','into','over','after',
  'before','against','between','under','through','during','ends','ending','starts',
  'begins','new','says','said','will','may','can','its','his','her','their','our',
  'this','that','these','those','report','reports','news','update','updates',
]);

function buildQuery(title: string): string {
  const tokens = title
    .replace(/[^A-Za-z0-9\s'’-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const proper: string[] = [];
  const content: string[] = [];
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    if (/^[A-Z]/.test(tok)) proper.push(tok);
    else content.push(tok);
  }
  const picked = (proper.length ? proper : content).slice(0, 5);
  return picked.join(' ').trim();
}

async function fetchWikipediaThumb(query: string): Promise<string | null> {
  if (!query) return null;
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=800' +
    '&gsrsearch=' + encodeURIComponent(query);
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    for (const key of Object.keys(pages)) {
      const page = pages[key];
      const thumb = page?.thumbnail?.source;
      if (thumb) return thumb as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns a subject-related image URL fetched from Wikipedia based on the
 * article title, falling back to null (caller should then show its curated
 * category reference image). Only runs when `enabled` is true — pass
 * `!article.mediaUrl` so verified photos keep priority.
 */
export function useRelatedImage(title: string | undefined, enabled: boolean): string | null {
  const query = enabled && title ? buildQuery(title) : '';
  const [url, setUrl] = useState<string | null>(() => (query ? cache.get(query) ?? null : null));

  useEffect(() => {
    if (!query) {
      setUrl(null);
      return;
    }
    if (cache.has(query)) {
      setUrl(cache.get(query) ?? null);
      return;
    }
    let active = true;
    let p = inflight.get(query);
    if (!p) {
      p = fetchWikipediaThumb(query).then((result) => {
        cache.set(query, result);
        inflight.delete(query);
        return result;
      });
      inflight.set(query, p);
    }
    p.then((result) => {
      if (active) setUrl(result);
    });
    return () => {
      active = false;
    };
  }, [query]);

  return url;
}
