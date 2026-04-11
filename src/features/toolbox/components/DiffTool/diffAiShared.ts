import type * as monaco from 'monaco-editor';

export function getDiffEditorContent(
  editorRef: React.RefObject<monaco.editor.IStandaloneDiffEditor | null>
) {
  if (!editorRef.current) {
    return null;
  }

  const model = editorRef.current.getModel();
  if (!model) {
    return null;
  }

  return {
    originalValue: model.original.getValue(),
    modifiedValue: model.modified.getValue(),
  };
}

export function buildDiffSummaryPrompt(args: {
  originalValue: string;
  modifiedValue: string;
}): string {
  const { originalValue, modifiedValue } = args;

  return `请对比以下两段文本的差异，按以下格式输出：

### 统计
- 新增：X 行
- 删除：X 行
- 修改：X 处

### 主要变化
1. [具体变化1]
2. [具体变化2]
3. [具体变化3]

### 重点关注
- [需要特别注意的地方]

---

【原文】
${originalValue || '(空)'}

【修改后】
${modifiedValue || '(空)'}`;
}
