# Page Agent 入口视觉增强设计

**日期**: 2026-03-16  
**状态**: 已批准  
**设计者**: AI Agent

## 概述

增强 Page Agent 入口按钮的视觉表现力,使其更加夺目且具有科技感,同时保持与现有 UI 的和谐统一。

## 问题陈述

当前 Page Agent 入口按钮存在以下问题:

1. **视觉层级弱** - 与其他工具按钮同等权重,用户容易忽略
2. **缺少品牌识别** - 普通 Bot 图标无法传达 "AI Agent" 的概念
3. **无科技感** - 简洁但平淡,缺乏吸引力和未来感
4. **无视觉引导** - 没有突出这是一个重要的、强大的功能入口

## 设计目标

通过以下视觉增强手段提升入口的辨识度和科技感:

- ✅ 发光/渐变效果 - 赛博朋克风格的霓虹光晕
- ✅ 动态交互 - 持续的呼吸动画
- ✅ 独特品牌符号 - 专属 AI Agent 图标设计

**不需要**: 醒目位置/尺寸调整 - 保持现有位置,仅增强视觉效果

## 设计决策

### 方案选择

经过多方案对比,选择了 **方案 B: 边框光晕 + 图标渐变**

**选择理由**:

- 渐变边框提供足够的视觉辨识度
- 图标本身的渐变色增加品牌识别
- 相对内敛,不过分张扬,适合日常使用
- 与赛博朋克配色完美契合

### 配色方案

采用赛博朋克三色渐变:

- **青色** (#22d3ee) - 科技感、未来感
- **粉色** (#f472b6) - 霓虹灯、活力
- **黄色** (#fbbf24) - 赛博朋克经典配色

### 动画策略

- **触发方式**: 持续动画 + Hover 增强
- **动画类型**: 边框脉冲 (opacity 渐变)
- **动画周期**: 普通状态 3s, Hover 状态 1.5s

### 发光强度

- **选择**: 微光点缀
- **原因**: 柔和的光晕,日常使用不刺眼,保持专业感

## 技术实现

### 1. 渐变边框

使用 CSS `background-clip` 技术实现渐变边框:

```css
.page-agent-button {
  padding: 10px;
  border: 2px solid transparent;
  background:
    linear-gradient(var(--bg-color), var(--bg-color)) padding-box,
    linear-gradient(135deg, #22d3ee, #f472b6, #fbbf24) border-box;
  border-radius: 10px;
  animation: border-pulse 3s ease-in-out infinite;
}

@keyframes border-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
```

### 2. 图标渐变

SVG 图标使用 `linearGradient` 实现渐变描边:

```tsx
<svg
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="url(#agent-gradient)"
  strokeWidth="2"
>
  <defs>
    <linearGradient id="agent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#22d3ee" />
      <stop offset="50%" stopColor="#f472b6" />
      <stop offset="100%" stopColor="#fbbf24" />
    </linearGradient>
  </defs>
  <circle cx="12" cy="5" r="2" />
  <path d="M12 7v4" />
  <rect x="3" y="11" width="18" height="10" rx="2" />
  <circle cx="8" cy="16" r="1" fill="#22d3ee" />
  <circle cx="16" cy="16" r="1" fill="#f472b6" />
</svg>
```

### 3. Hover 状态

Hover 时增强视觉效果:

```css
.page-agent-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(34, 211, 238, 0.3);
  animation: border-pulse-hover 1.5s ease-in-out infinite;
}

@keyframes border-pulse-hover {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}
```

### 4. 主题适配

#### 暗色主题 (Dark Mode)

- 背景色: `var(--background)` (深色)
- 边框渐变: #22d3ee → #f472b6 → #fbbf24 (鲜艳)
- 图标渐变: 同边框渐变

#### 亮色主题 (Light Mode)

- 背景色: `var(--background)` (浅色)
- 边框渐变: #0891b2 → #db2777 → #d97706 (加深)
- 图标渐变: 同边框渐变
- 额外效果: 添加微弱阴影 `box-shadow: 0 0 8px rgba(34, 211, 238, 0.2)`

### 5. Loading 状态

当 Page Agent 正在注入时:

- 停止边框脉冲动画
- 显示旋转的加载图标 (Loader2)
- 保持渐变边框样式

## 组件结构

```tsx
// 新增组件: PageAgentButton.tsx
export function PageAgentButton() {
  const [isInjecting, setIsInjecting] = useState(false);
  const { toast } = useToast();

  const handleInject = async () => {
    if (isInjecting) return;

    setIsInjecting(true);
    try {
      const response = await browser.runtime.sendMessage({ type: 'PAGE_AGENT_INJECT' });
      if (response.success) {
        toast('Page Agent 已启动，请在当前页面操作', 'success');
      } else {
        toast(response.error || '启动失败', 'error');
      }
    } catch (_error) {
      toast('启动失败', 'error');
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <button
      className="page-agent-button"
      onClick={handleInject}
      disabled={isInjecting}
      title="Page Agent - AI 操作当前页面"
      aria-label="启动 Page Agent"
    >
      {isInjecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PageAgentIcon />}
    </button>
  );
}
```

## 视觉规范

### 尺寸

- 按钮 padding: `10px` (比其他按钮略大)
- 边框宽度: `2px`
- 圆角半径: `10px`
- 图标尺寸: `16x16`

### 颜色

#### 暗色主题

| 元素     | 颜色值  | 说明     |
| -------- | ------- | -------- |
| 边框起点 | #22d3ee | 青色     |
| 边框中点 | #f472b6 | 粉色     |
| 边框终点 | #fbbf24 | 黄色     |
| 左眼     | #22d3ee | 青色点缀 |
| 右眼     | #f472b6 | 粉色点缀 |

#### 亮色主题

| 元素     | 颜色值  | 说明       |
| -------- | ------- | ---------- |
| 边框起点 | #0891b2 | 深青色     |
| 边框中点 | #db2777 | 深粉色     |
| 边框终点 | #d97706 | 深黄色     |
| 左眼     | #0891b2 | 深青色点缀 |
| 右眼     | #db2777 | 深粉色点缀 |

### 动画时序

| 状态    | 动画周期 | 动画类型    | Opacity 范围 |
| ------- | -------- | ----------- | ------------ |
| 普通    | 3s       | ease-in-out | 0.6 → 1.0    |
| Hover   | 1.5s     | ease-in-out | 0.8 → 1.0    |
| Loading | -        | 旋转        | -            |

## 文件变更

### 新增文件

- `src/components/PageAgentButton.tsx` - 独立的 Page Agent 按钮组件
- `src/components/PageAgentIcon.tsx` - Page Agent 图标组件
- `src/styles/page-agent.css` - Page Agent 相关样式 (可选,也可直接写在组件中)

### 修改文件

- `src/features/aiAssistant/components/AIAssistantView.tsx` - 替换现有的 Bot 图标按钮为新的 PageAgentButton 组件

## 测试要点

### 视觉测试

1. **暗色主题**
   - [ ] 边框渐变清晰可见
   - [ ] 脉冲动画流畅
   - [ ] Hover 效果正确

2. **亮色主题**
   - [ ] 边框颜色适配正确
   - [ ] 阴影效果自然
   - [ ] 对比度足够

3. **动画测试**
   - [ ] 脉冲动画周期正确 (3s)
   - [ ] Hover 动画加速正确 (1.5s)
   - [ ] Loading 状态显示正确
   - [ ] 动画不会导致性能问题

### 功能测试

1. **交互测试**
   - [ ] 点击按钮触发注入
   - [ ] Loading 状态显示正确
   - [ ] Toast 提示正确显示
   - [ ] 错误处理正常

2. **主题切换**
   - [ ] 主题切换时样式平滑过渡
   - [ ] 渐变色正确更新
   - [ ] 无闪烁

### 兼容性测试

1. **浏览器兼容**
   - [ ] Chrome - `background-clip: padding-box` 支持
   - [ ] Firefox - SVG 渐变支持
   - [ ] Edge - 动画性能

2. **响应式**
   - [ ] 不同分辨率下显示正常
   - [ ] 缩放比例不影响视觉效果

## 实现优先级

1. **P0 - 核心功能**
   - 渐变边框实现
   - 图标渐变
   - 基础动画
   - Hover 状态

2. **P1 - 主题适配**
   - 暗色主题
   - 亮色主题
   - 主题切换过渡

3. **P2 - 细节优化**
   - Loading 状态
   - 无障碍优化
   - 性能优化

## 后续优化建议

1. **可配置性**
   - 允许用户自定义配色方案
   - 可选择是否启用持续动画

2. **状态扩展**
   - Page Agent 激活状态的特殊视觉表现
   - 错误状态的视觉反馈

3. **微交互**
   - 点击时的涟漪效果
   - 成功注入时的庆祝动画

## 参考资料

- [CSS background-clip](https://developer.mozilla.org/en-US/docs/Web/CSS/background-clip)
- [SVG Linear Gradient](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient)
- [Cyberpunk Color Palette](https://www.color-hex.com/color-palette/101534)
- [WXT Documentation](https://wxt.dev/)

---

**批准者**: 用户  
**批准日期**: 2026-03-16  
**备注**: 设计方案 B 已通过用户审查
