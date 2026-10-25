/**
 * Dual-output configuration.
 *
 *  - Default (Vercel / Node server): full SSR + API routes.
 *  - MOBILE_EXPORT=1 (Capacitor builds): static export to ./out so the
 *    Android/iOS shells ship a self-contained web bundle. API routes are
 *    NOT bundled into the mobile app; the native shell calls the deployed
 *    web origin (NEXT_PUBLIC_API_ORIGIN) instead.
 */
const isMobileExport = process.env.MOBILE_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export only for the native wrapper build.
  ...(isMobileExport
    ? {
        output: 'export',
        distDir: 'out',
        images: { unoptimized: true },
      }
    : {}),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    ...(isMobileExport ? { unoptimized: true } : {}),
  },
  env: {
    NEXT_PUBLIC_IS_MOBILE_BUILD: isMobileExport ? '1' : '0',
  },
};

export default nextConfig;
