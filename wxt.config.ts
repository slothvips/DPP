import UnoCSS from 'unocss/vite';
import babel from 'vite-plugin-babel';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    plugins: [
      UnoCSS(),
      babel({
        babelConfig: {
          presets: ['@babel/preset-typescript'],
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
        },
        filter: /\.[jt]sx?$/,
      }),
    ],
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
    'build:manifestGenerated': async (wxt, manifest) => {
      // Set DEV suffix and icons in development mode
      if (wxt.config.mode === 'development') {
        manifest.name = 'DPP(DEV)';
        manifest.icons = {
          16: '/icon-dev/16.png',
          32: '/icon-dev/32.png',
          48: '/icon-dev/48.png',
          96: '/icon-dev/96.png',
          128: '/icon-dev/128.png',
        };
      }
      // Remove default_popup from action to allow onClicked handler
      if (manifest.action) {
        delete manifest.action.default_popup;
      }
    },
  },
  manifest: {
    // storage: 存储扩展配置
    // sidePanel: 侧边面板功能
    // alarms: 定时任务
    // activeTab: 获取当前活动标签页信息（用于 Page Agent 注入）
    // scripting: 编程式注入脚本（用于 Page Agent 注入）
    permissions: ['storage', 'sidePanel', 'alarms', 'activeTab', 'scripting'],
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
        resources: [
          'network-interceptor.js',
          'console-interceptor.js',
          'content-scripts/pageAgent.js',
        ],
        matches: ['<all_urls>'],
      },
    ],
  },
});
