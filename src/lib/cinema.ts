// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Cinema Sentinel helpers
//
//  · ticketClaimHash — the SHA-256 fingerprint stored in movie_tickets
//    with a UNIQUE constraint, so one seat on one show == one review.
//  · haversineMeters — matches ST_DistanceSphere so the client can show
//    a live proximity readout without a round-trip.
//  · parseTicketText — pure-TS parse that extracts booking fields from
//    the OCR'd text of a BookMyShow / PVR / INOX ticket. Falls back to
//    structured fields when the shell shipped them.
// ════════════════════════════════════════════════════════════════════════

export interface ParsedTicket {
  movie_title?: string;
  cinema_name?: string;
  show_time_iso?: string;
  seat_no?: string;
  booking_id?: string;
}

/** SHA-256 of the five canonical ticket fields. Used server + client side. */
export async function ticketClaimHash(parts: {
  movie_id: string;
  cinema_id: string;
  show_time: string;
  seat_no: string;
  booking_id: string;
}): Promise<string> {
  const canonical = [
    parts.movie_id.trim().toLowerCase(),
    parts.cinema_id.trim().toLowerCase(),
    new Date(parts.show_time).toISOString(),
    parts.seat_no.trim().toUpperCase().replace(/\s+/g, ''),
    parts.booking_id.trim().toUpperCase(),
  ].join('|');
  const buf = new TextEncoder().encode(canonical);
  // Browser WebCrypto in client bundle; node has it on globalThis in modern runtimes.
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Spherical distance in metres between two WGS-84 coords. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Rough-and-ready parser for OCR'd ticket text. Covers the common BMS /
 * PVR / INOX layouts; anything the regex misses the user types in.
 */
export function parseTicketText(raw: string): ParsedTicket {
  const text = raw.replace(/ /g, ' ');
  const out: ParsedTicket = {};

  const bookingMatch =
    text.match(/booking\s*id[:\s]*([A-Z0-9]{6,})/i) ??
    text.match(/\bPNR[:\s]*([A-Z0-9]{6,})/i) ??
    text.match(/\b([A-Z]{2,}\d{6,})\b/);
  if (bookingMatch) out.booking_id = bookingMatch[1];

  const seatMatch =
    text.match(/seat[s]?[:\s]*([A-Z]-?\d{1,3}(?:\s*,\s*[A-Z]-?\d{1,3})*)/i) ??
    text.match(/\b([A-Z]{1,2}\s*-\s*\d{1,3})\b/);
  if (seatMatch) out.seat_no = seatMatch[1].replace(/\s+/g, '');

  // Showtime: date near a time.
  const dateMatch = text.match(
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
  );
  const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (dateMatch && timeMatch) {
    const dt = new Date(`${dateMatch[1]} ${timeMatch[1]}`);
    if (!Number.isNaN(dt.getTime())) out.show_time_iso = dt.toISOString();
  }

  // Cinema name: the chain word plus the next capitalised fragment.
  const chainMatch = text.match(
    /\b(PVR|INOX|Cinepolis|Carnival|MovieTime|Miraj|Multiplex|Imax)\b[^\n,]{0,60}/i,
  );
  if (chainMatch) out.cinema_name = chainMatch[0].trim();

  // Movie title: the title line typically sits above the showtime. We
  // skip common header noise. Users can override in the UI.
  const titleCandidate = text
    .split(/\n|\r/)
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length > 2 &&
        l.length < 60 &&
        !/booking|pnr|seat|audi|screen|total|gst|cgst|sgst|convenience/i.test(l),
    );
  if (titleCandidate) out.movie_title = titleCandidate;

  return out;
}

export type ReviewTier = 'fdfs' | 'day1' | 'standard';

/** Human-readable reward tier label for the pre-submit preview. */
export function tierFor(unlockAt: Date, now: Date = new Date()): ReviewTier | 'locked' {
  const minutes = (now.getTime() - unlockAt.getTime()) / 60_000;
  if (minutes < 0) return 'locked';
  if (minutes < 30) return 'fdfs';
  if (minutes < 120) return 'day1';
  return 'standard';
}

/** Dynamic VPcoin reward for the tier. Server duplicates this logic. */
export function rewardFor(tier: ReviewTier): number {
  if (tier === 'fdfs') return 50;
  if (tier === 'day1') return 30;
  return 15;
}
