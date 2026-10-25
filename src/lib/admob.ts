'use client';

/**
 * AdMob controller for native builds. Shows an anchored adaptive banner
 * (BOTTOM_CENTER, offset above the 56px tab bar per §4.3) and an interstitial
 * that fires on every 4th deep story inspection. No-ops on web, where AdSense
 * handles monetization instead.
 */
import { isNative } from './nativeHardware';

let initialised = false;
let inspectionCount = 0;

const BANNER_ID = process.env.NEXT_PUBLIC_ADMOB_BANNER_ID;
const INTERSTITIAL_ID = process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID;

export async function initAdMob(): Promise<void> {
  if (!isNative() || initialised) return;
  const { AdMob } = await import('@capacitor-community/admob');
  await AdMob.initialize({ initializeForTesting: !BANNER_ID });
  initialised = true;
}

export async function showAnchoredBanner(): Promise<void> {
  if (!isNative()) return;
  await initAdMob();
  const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
  await AdMob.showBanner({
    adId: BANNER_ID ?? 'ca-app-pub-3940256099942544/6300978111', // Google test id
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 56, // clear the floating tab bar
  });
}

export async function maybeShowInterstitial(): Promise<void> {
  if (!isNative()) return;
  inspectionCount += 1;
  if (inspectionCount % 4 !== 0) return; // every 4th inspection
  await initAdMob();
  const { AdMob } = await import('@capacitor-community/admob');
  await AdMob.prepareInterstitial({
    adId: INTERSTITIAL_ID ?? 'ca-app-pub-3940256099942544/1033173712', // Google test id
  });
  await AdMob.showInterstitial();
}
