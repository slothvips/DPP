import type * as Monaco from 'monaco-editor';

// 缓存动态加载的 Monaco 模块,避免重复加载
let monacoPromise: Promise<typeof Monaco> | null = null;

/**
 * 动态加载 Monaco 编辑器及其 CSS/Worker
 *
 * 改造目的:避免静态 `import * as monaco from 'monaco-editor'` 把 ~5MB
 * 的 Monaco 打入 sidepanel 主 chunk,导致首屏加载缓慢。
 *
 * 通过仅在用户真正打开 JSON/Diff 工具时才加载 Monaco,
 * 并配合 `React.lazy(ToolboxView)`,实现 Toolbox 的完全懒加载。
 */
export async function loadMonaco(): Promise<typeof Monaco> {
  if (!monacoPromise) {
    monacoPromise = (async () => {
      // 并行动态加载 CSS 和 Monaco 主模块
      const [monaco] = await Promise.all([
        import('monaco-editor'),
        import('monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css'),
        import('monaco-editor/min/vs/editor/editor.main.css'),
      ]);
      // 设置 worker(幂等,内部有 flag 防重复)
      const { setupMonacoWorker } = await import('./worker');
      setupMonacoWorker();
      return monaco;
    })();
  }
  return monacoPromise;
}

export type MonacoAPI = typeof Monaco;
