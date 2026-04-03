/**
 * Monaco Editor Worker 配置
 * 用于在浏览器中正确加载 Monaco Editor 的 Web Workers
 */

/**
 * 初始化 Monaco Editor 环境
 * 配置 Worker 加载方式，支持 JSON、CSS、HTML、TypeScript 等语言
 *
 * 注意：在扩展环境中 Worker 可能无法正常加载，这里使用回退方案
 */
export function setupMonacoWorker(): void {
  if (self.MonacoEnvironment) {
    return; // 已经初始化过
  }

  // 获取 Worker 的 URL
  const getWorkerUrl = (): string => {
    return `/monaco-editor/esm/vs/editor/editor.worker?worker`;
  };

  self.MonacoEnvironment = {
    getWorkerUrl: function (_moduleId: string, label: string) {
      // 对于 JSON 编辑器，直接返回空字符串禁用 worker
      // Monaco 会使用内置的语言服务，不依赖 worker
      if (label === 'json') {
        return '';
      }
      return getWorkerUrl();
    },
  };
}
