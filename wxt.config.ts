import UnoCSS from 'unocss/vite';
import babel from 'vite-plugin-babel';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    server: {
      port: 3001,
      strictPort: true,
    },
    plugins: [
      UnoCSS(),
      babel({
        babelConfig: {
          presets: ['@babel/preset-typescript'],
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
          // 抑制 Babel 对超过 500KB 的文件(react-dom、rrweb)的 deoptimised 警告
          // 这些是预编译的 production 文件,Babel 不需要优化其代码样式
          compact: true,
        },
        filter: /\.[jt]sx?$/,
      }),
    ],
    esbuild: {
      charset: 'ascii',
    },
    build: {
      // 警告阈值设为 4000KB:
      // - Monaco editor.main.js 约 3.77MB(已通过 React.lazy 懒加载,不影响首屏)
      // - 其他 chunk 均远低于 1500KB,提高阈值不会掩盖真正异常的 chunk
      // 注意:不能使用 manualChunks,因为 WXT 的 background service worker
      // 使用 inlineDynamicImports(无法动态加载 chunk),与 manualChunks 不兼容。
      // Monaco 等大型库的拆分通过 React.lazy + 动态 import 实现。
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        onwarn(warning, warn) {
          // 忽略 page-agent 依赖中的 eval 警告
          if (warning.code === 'EVAL' && warning.message.includes('@page-agent/page-controller')) {
            return;
          }
          // 忽略 Radix UI 的 "use client" 指令警告
          // Radix UI 为 React Server Components 标注 "use client",
          // 在浏览器扩展 bundling 中无意义,Rollup 会安全忽略
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
            warning.message.includes('"use client"')
          ) {
            return;
          }
          // 忽略 UnoCSS 的 "virtual:uno.css" 重复导入警告
          // WXT 多入口(7 个 HTML)各自注入 UnoCSS 虚拟模块,UnoCSS 已正确处理
          // (只用第一个出现),警告本身无害
          if (
            warning.message.includes('[unocss]') &&
            warning.message.includes('is being imported multiple times')
          ) {
            return;
          }
          warn(warning);
        },
      },
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
        manifest.content_security_policy = {
          extension_pages:
            "script-src 'self' 'wasm-unsafe-eval' http://localhost:3000 http://localhost:3001; object-src 'self';",
          sandbox:
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000 http://localhost:3001; sandbox allow-scripts allow-forms allow-popups allow-modals; child-src 'self';",
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
