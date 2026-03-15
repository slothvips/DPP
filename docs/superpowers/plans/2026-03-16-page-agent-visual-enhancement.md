# Page Agent 入口视觉增强实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 Page Agent 入口按钮的视觉表现力，使其更加夺目且具有科技感

**Architecture:** 创建独立的 PageAgentButton 和 PageAgentIcon 组件，使用 CSS 渐变边框和 SVG 渐变图标实现赛博朋克风格的视觉效果

**Tech Stack:** React 19, TypeScript, UnoCSS, WXT, SVG

---

## 文件结构

```
src/
├── features/aiAssistant/components/
│   ├── PageAgentButton.tsx      # 新增: Page Agent 按钮组件
│   ├── PageAgentIcon.tsx        # 新增: Page Agent 图标组件
│   └── AIAssistantView.tsx      # 修改: 替换现有按钮
```

**设计决策:**

- 将新组件放在 `features/aiAssistant/components/` 而非通用 `components/`，因为这是 AI Assistant 特有的功能组件
- 使用独立的 Icon 组件以便复用和测试
- 样式直接写在组件中，使用 UnoCSS 类名

---

## Chunk 1: 创建基础组件和样式

### Task 1: 添加 CSS 变量和动画配置

**Files:**

- Modify: `uno.config.ts` (添加动画配置和 CSS 变量)

- [ ] **Step 1: 添加动画配置到 uno.config.ts**

在项目根目录的 `uno.config.ts` 文件中，添加以下内容到 theme 对象：

```ts
// uno.config.ts
export default defineConfig({
  theme: {
    // ... 其他配置
    animation: {
      'border-pulse': 'border-pulse 3s ease-in-out infinite',
      'border-pulse-fast': 'border-pulse-fast 1.5s ease-in-out infinite',
    },
    keyframes: {
      'border-pulse': {
        '0%, 100%': { opacity: '0.6' },
        '50%': { opacity: '1' },
      },
      'border-pulse-fast': {
        '0%, 100%': { opacity: '0.8' },
        '50%': { opacity: '1' },
      },
    },
  },
  // ... 其他配置
});
```

- [ ] **Step 2: 添加 CSS 变量到 uno.config.ts**

在 `uno.config.ts` 的 `preflights[0].getCSS()` 返回字符串中添加渐变色变量：

```ts
// uno.config.ts
// 在 :root 块中（约第 88 行 --radius 后）添加：
--gradient-start: #0891b2;
--gradient-middle: #db2777;
--gradient-end: #d97706;

// 在 .dark 块中（约第 116 行最后）添加：
--gradient-start: #22d3ee;
--gradient-middle: #f472b6;
--gradient-end: #fbbf24;
```

- [ ] **Step 3: Commit**

```bash
git add uno.config.ts
git commit -m "feat: add CSS variables and animations for Page Agent button"
```

---

### Task 2: 创建 PageAgentIcon 组件

**Files:**

- Create: `src/features/aiAssistant/components/PageAgentIcon.tsx`

- [ ] **Step 1: 创建 PageAgentIcon 组件文件**

创建 `src/features/aiAssistant/components/PageAgentIcon.tsx`:

```tsx
import { cn } from '@/utils/cn';

export interface PageAgentIconProps {
  className?: string;
}

export function PageAgentIcon({ className }: PageAgentIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#agent-gradient)"
      strokeWidth="2"
      className={cn('w-4 h-4', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="agent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--gradient-start)' }} />
          <stop offset="50%" style={{ stopColor: 'var(--gradient-middle)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--gradient-end)' }} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="8" cy="16" r="1" style={{ fill: 'var(--gradient-start)' }} />
      <circle cx="16" cy="16" r="1" style={{ fill: 'var(--gradient-middle)' }} />
    </svg>
  );
}
```

**关键设计决策：**

- 使用 CSS 变量 `--gradient-start`, `--gradient-middle`, `--gradient-end` 实现主题自动适配
- 移除 `variant` prop，通过 CSS 变量自动响应主题变化
- 渐变 ID 使用固定值 `agent-gradient`，避免重复生成

- [ ] **Step 2: 运行类型检查**

Run: `pnpm compile`
Expected: PASS - 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/features/aiAssistant/components/PageAgentIcon.tsx
git commit -m "feat: add PageAgentIcon component with gradient colors"
```

---

### Task 3: 创建 PageAgentButton 组件

**Files:**

- Create: `src/features/aiAssistant/components/PageAgentButton.tsx`

> **Note:** 动画配置已在 Task 1 中完成，此处直接使用。

- [ ] **Step 1: 创建 PageAgentButton 组件文件**

创建 `src/features/aiAssistant/components/PageAgentButton.tsx`:

```tsx
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/utils/cn';
import { PageAgentIcon } from './PageAgentIcon';

export interface PageAgentButtonProps {
  disabled?: boolean;
  className?: string;
}

export function PageAgentButton({ disabled, className }: PageAgentButtonProps) {
  const [isInjecting, setIsInjecting] = useState(false);
  const { toast } = useToast();

  const handleInject = useCallback(async () => {
    if (isInjecting) return;

    setIsInjecting(true);
    try {
      const response = await browser.runtime.sendMessage({ type: 'PAGE_AGENT_INJECT' });
      if (response?.success) {
        toast('Page Agent 已启动，请在当前页面操作', 'success');
      } else {
        toast(response?.error || '启动失败', 'error');
      }
    } catch (_error) {
      toast('启动失败', 'error');
    } finally {
      setIsInjecting(false);
    }
  }, [isInjecting, toast]);

  return (
    <button
      className={cn(
        'relative p-[10px] rounded-[10px] cursor-pointer',
        'transition-all duration-200',
        'hover:scale-105 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]',
        'hover:animate-border-pulse-fast',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'animate-border-pulse',
        'border-2 border-transparent',
        'dark:shadow-[0_0_8px_rgba(34,211,238,0.2)]',
        'shadow-[0_0_8px_rgba(34,211,238,0.2)]',
        className
      )}
      style={{
        background:
          'linear-gradient(var(--background), var(--background)) padding-box, linear-gradient(135deg, var(--gradient-start), var(--gradient-middle), var(--gradient-end)) border-box',
      }}
      onClick={handleInject}
      disabled={disabled || isInjecting}
      title="Page Agent - AI 操作当前页面"
      aria-label="启动 Page Agent"
      data-testid="page-agent-button"
    >
      {isInjecting ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <PageAgentIcon />
      )}
    </button>
  );
}
```

**关键设计决策：**

- 使用 CSS 变量 `--gradient-start`, `--gradient-middle`, `--gradient-end` 实现主题适配
- 使用 `background-clip` 技术实现渐变边框（比 before 伪元素更可靠）
- PageAgentIcon 组件不需要 variant prop，通过 CSS 变量自动适配主题
- 添加 `animate-border-pulse-fast` 类用于 hover 状态

- [ ] **Step 2: 运行类型检查**

Run: `pnpm compile`
Expected: PASS - 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/features/aiAssistant/components/PageAgentButton.tsx
git commit -m "feat: add PageAgentButton component with gradient border and theme support"
```

---

## Chunk 2: 集成到现有 UI

### Task 4: 更新 AIAssistantView 使用新组件

**Files:**

- Modify: `src/features/aiAssistant/components/AIAssistantView.tsx`

> **Note:** 行号可能因代码变化而不同，请根据实际情况调整。

- [ ] **Step 1: 导入新组件**

在 `AIAssistantView.tsx` 顶部添加导入：

```tsx
import { PageAgentButton } from './PageAgentButton';
```

- [ ] **Step 2: 删除旧的 handlePageAgentInject 函数和相关状态**

删除 `AIAssistantView.tsx` 中的：

- `const [isInjecting, setIsInjecting] = useState(false);` 状态
- `handlePageAgentInject` 函数定义
- `Bot` 图标导入（不再需要）：`import { ArrowDown, Loader2, Scissors, Settings, Trash2 } from 'lucide-react';`

- [ ] **Step 3: 替换按钮组件**

找到原有的 Page Agent 按钮代码（通常在 header 工具栏中），替换为：

```tsx
<PageAgentButton disabled={status === 'loading' || status === 'streaming'} />
```

- [ ] **Step 4: Commit**

```bash
git add src/features/aiAssistant/components/AIAssistantView.tsx
git commit -m "feat: replace old Page Agent button with new PageAgentButton component"
```

---

## Chunk 3: 测试和验证

> **Note:** CSS 变量和动画已在 Task 1 中配置，主题适配通过 CSS 变量自动实现，无需额外代码。

### Task 5: 测试和修复

**Files:**

- All modified files

- [ ] **Step 1: 运行类型检查**

Run: `pnpm compile`
Expected: PASS - 无类型错误

- [ ] **Step 2: 运行 Lint 检查**

Run: `pnpm lint`
Expected: PASS - 无 lint 错误

如果有错误，运行 `pnpm lint:fix` 自动修复

- [ ] **Step 3: 运行生产构建**

Run: `pnpm build`
Expected: PASS - 构建成功

- [ ] **Step 4: 浏览器测试**

Run: `pnpm dev`

测试清单：

- [ ] 暗色主题下按钮显示正常
- [ ] 亮色主题下按钮显示正常
- [ ] 边框脉冲动画流畅
- [ ] Hover 状态放大和加速正常
- [ ] 点击按钮触发 Page Agent 注入
- [ ] Loading 状态显示旋转图标
- [ ] Toast 提示正常显示

- [ ] **Step 5: Commit 所有修改**

```bash
git add .
git commit -m "feat: complete Page Agent button visual enhancement"
```

---

## 实现总结

**文件变更:**

- ✅ 新增: `src/features/aiAssistant/components/PageAgentIcon.tsx`
- ✅ 新增: `src/features/aiAssistant/components/PageAgentButton.tsx`
- ✅ 修改: `src/features/aiAssistant/components/AIAssistantView.tsx`
- ✅ 修改: 全局样式文件（CSS 变量）

**功能实现:**

- ✅ 渐变边框 (赛博朋克三色)
- ✅ SVG 渐变图标
- ✅ 持续脉冲动画
- ✅ Hover 状态增强
- ✅ 亮暗主题适配
- ✅ Loading 状态

**下一步:**

- 用户体验测试
- 根据反馈微调动画参数
- 考虑添加可配置选项（如关闭动画）
