import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.veripulse.trustednews',
  appName: 'VeriPulse',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      // Permissions declared in AndroidManifest.xml / Info.plist
    },
    Geolocation: {},
    AdMob: {
      // Supply real IDs via native config / env at build time.
      // Test IDs are used automatically in development.
    },
  },
};

export default config;
