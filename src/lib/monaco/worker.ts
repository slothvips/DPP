import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

export function setupMonacoWorker(): void {
  if (self.MonacoEnvironment) {
    return;
  }

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') {
        return new JsonWorker();
      }

      return new EditorWorker();
    },
  };
}
