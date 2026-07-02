import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wallet.walle', // unchanged on purpose: changing appId orphans existing installs
  appName: 'Walter',
  webDir: 'dist'
};

export default config;
