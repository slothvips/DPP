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
    // activeTab: 获取标签页信息
    // scripting: 编程式注入脚本（用于 Page Agent 注入，用户需先选择目标标签页）
    // tabs: 获取标签页列表信息
    permissions: ['storage', 'sidePanel', 'alarms', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    name: 'DPP',
    description:
      'DPP - 团队文档与 Jenkins 部署助手，支持 AI 智能问答、屏幕录制、链接管理与技术资讯聚合',
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
