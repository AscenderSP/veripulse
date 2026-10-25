import { createHash } from 'crypto';

/** SHA-256 hex of a string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** SHA-256 hex of raw bytes (e.g. an uploaded image buffer). */
export function sha256Bytes(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Canonical ownership identity hash:
 *   SHA-256( docType + ':' + cleanId + ':' + uniqueSerial )
 * cleanId is upper-cased and stripped of spaces/dashes so the same RC photo
 * always yields the same hash regardless of OCR spacing.
 */
export function ownershipIdentityHash(
  docType: string,
  cleanId: string,
  uniqueSerial: string,
): string {
  const norm = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');
  return sha256(`${docType}:${norm(cleanId)}:${norm(uniqueSerial)}`);
}

/** Mask an identifier for display: keep first 2 and last 4, dot the rest. */
export function maskIdentifier(id: string): string {
  const clean = id.replace(/\s/g, '');
  if (clean.length <= 6) return '••••';
  return `${clean.slice(0, 2)}••••${clean.slice(-4)}`;
}

/** Deterministic webhook id for replay protection. */
export function webhookId(provider: string, externalId: string): string {
  return sha256(`${provider}:${externalId}`);
}
