import UnoCSS from 'unocss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [UnoCSS()],
    esbuild: {
      charset: 'ascii',
    },
  }),
  webExt: {
    disabled: true,
  },
  manifest: {
    permissions: ['storage', 'alarms', 'tabs', 'offscreen'],
    host_permissions: ['<all_urls>'],
    name: 'DPP',
    description: 'Team documentation & Jenkins deployment assistant with tech news',
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
    omnibox: { keyword: 'dpp' },
  },
});
