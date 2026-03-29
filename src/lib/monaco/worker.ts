/**
 * Monaco Editor Worker 配置
 * 用于在浏览器中正确加载 Monaco Editor 的 Web Workers
 */

/**
 * 初始化 Monaco Editor 环境
 * 配置 Worker 加载方式，支持 JSON、CSS、HTML、TypeScript 等语言
 */
export function setupMonacoWorker(): void {
  if (self.MonacoEnvironment) {
    return; // 已经初始化过
  }

  self.MonacoEnvironment = {
    getWorker: function (_moduleId: string, label: string) {
      const getWorkerModule = (moduleUrl: string, label: string) => {
        return new Worker(self.MonacoEnvironment!.getWorkerUrl!(moduleUrl, label), {
          name: label,
          type: 'module',
        });
      };
      switch (label) {
        case 'json':
        case 'css':
        case 'scss':
        case 'less':
        case 'html':
        case 'handlebars':
        case 'razor':
        case 'typescript':
        case 'javascript':
        default:
          return getWorkerModule('/monaco-editor/esm/vs/editor/editor.worker?worker', label);
      }
    },
  };
}
