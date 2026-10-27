// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Reference Images & Expiry Utilities
//  Provides curated high-resolution reference images for news stories
//  when no eyewitness photo is submitted or verified.
//  Enforces the 12-hour news expiration rule across feeds.
// ════════════════════════════════════════════════════════════════════════

export const CATEGORY_REFERENCE_IMAGES: Record<string, string> = {
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
  other: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80',
};

/**
 * Returns a high-resolution curated reference image URL for a given category.
 */
export function getReferenceImage(category?: string | null): string {
  if (!category) return CATEGORY_REFERENCE_IMAGES.general;
  const key = category.toLowerCase().trim();
  for (const [k, url] of Object.entries(CATEGORY_REFERENCE_IMAGES)) {
    if (key.includes(k)) return url;
  }
  return CATEGORY_REFERENCE_IMAGES.general;
}

// Photo IDs of every curated category stock image above. The DB function
// `insert_or_merge_story` substitutes one of these into media_url at write
// time when the reporter / wire didn't attach a real photo, so client code
// can't tell "real" from "stock" by nullness alone — it has to match the id.
const STOCK_PHOTO_IDS = new Set([
  '1541872703-74c5e44368f9',
  '1474487548417-781cb71495f3',
  '1611974789855-9c2a0a7236a3',
  '1518770660439-4636190af475',
  '1584515979956-d9f6e5d09982',
  '1534088568595-a066f410bcda',
  '1589578527966-fdac0f44566c',
  '1549399542-7e3f8b79c341',
  '1531415074968-036ba1b575da',
  '1585829365295-ab7cd400c167',
]);

/**
 * True when the given URL is one of our curated category stock placeholders
 * (not a real eyewitness / wire photo). Used so the UI can fall through to a
 * subject-related Wikipedia image instead of showing the same stock photo for
 * every unverified story in a category.
 */
export function isStockImage(url: string | null | undefined): boolean {
  if (!url) return true;
  if (!url.includes('images.unsplash.com')) return false;
  for (const id of STOCK_PHOTO_IDS) {
    if (url.includes(id)) return true;
  }
  return false;
}

/**
 * News Expiration Threshold (12 Hours).
 * Any news story older than 12 hours expires from active real-time feeds.
 */
export const NEWS_EXPIRY_HOURS = 12;
export const NEWS_EXPIRY_MS = NEWS_EXPIRY_HOURS * 60 * 60 * 1000;

export function isNewsExpired(publishedAtOrCreatedAt: string | Date | number): boolean {
  const time = new Date(publishedAtOrCreatedAt).getTime();
  if (isNaN(time)) return false;
  return Date.now() - time > NEWS_EXPIRY_MS;
}

export function getExpiryCutoffDate(): Date {
  return new Date(Date.now() - NEWS_EXPIRY_MS);
}
