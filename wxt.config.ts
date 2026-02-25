import UnoCSS from 'unocss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    plugins: [UnoCSS()],
    esbuild: {
      charset: 'ascii',
    },
    build: {
      // 提高警告阈值，消除 "chunk too large" 警告
      // Web LLM 动态加载的 chunk 约 6MB，设置阈值为 7000KB
      chunkSizeWarningLimit: 7000,
    },
  }),
  webExt: {
    disabled: true,
  },
  hooks: {
    'build:manifestGenerated': async (_wxt, manifest) => {
      // Remove default_popup from action to allow onClicked handler
      if (manifest.action) {
        delete manifest.action.default_popup;
      }
    },
  },
  manifest: {
    permissions: ['storage', 'sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
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
    web_accessible_resources: [
      {
        resources: ['network-interceptor.js'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
