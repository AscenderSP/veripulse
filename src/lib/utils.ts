import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Lang, StoryStage } from './types';

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const LANGS: { code: Lang; short: string; label: string }[] = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'bn', short: 'বাং', label: 'বাংলা' },
  { code: 'hi', short: 'हिं', label: 'हिंदी' },
];

/** Haversine distance in km between two lat/lng points. */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

/** 10 VPcoins = 1 INR */
export const VPCOINS_PER_INR = 10;

export function inrToVPCoins(inr: number): number {
  return Math.round(inr * VPCOINS_PER_INR);
}

export function vpCoinsToINR(coins: number): number {
  return +(coins / VPCOINS_PER_INR).toFixed(2);
}

export function formatVPCoins(coins: number): string {
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(coins))} VP`;
}

export function stageMeta(stage: StoryStage): {
  label: string;
  color: string;
  bg: string;
} {
  switch (stage) {
    case 'public':
      return { label: 'Verified', color: 'var(--brand-emerald)', bg: 'var(--brand-emerald-glow)' };
    case 'tier_2':
      return { label: 'In Review', color: 'var(--brand-sky)', bg: 'rgba(14,165,233,0.12)' };
    case 'tier_1':
      return { label: 'Sentinel Canary', color: 'var(--brand-amber)', bg: 'rgba(245,158,11,0.12)' };
    case 'quarantined':
      return { label: 'Quarantined', color: 'var(--brand-rose)', bg: 'rgba(244,63,94,0.12)' };
  }
}

/** Build the sub-id tracking parameter for affiliate links. */
export function buildSubId(productId: string, reviewerId: string): string {
  return `vp_${productId}_${reviewerId}_${Date.now()}`;
}

/** Relative time like "3m", "2h", "4d". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
