# 更新日志页面设计

## 概述

创建一个独立的更新日志页面，从远程 URL 获取 Markdown 内容并渲染展示。

## 架构

- **入口**: `src/entrypoints/changelog/ChangelogApp.tsx`
- **路由**: 通过 `changelog.html` 访问
- **渲染**: 使用 `react-markdown` + `remark-gfm`

## 功能

1. **远程 Markdown 加载**
   - 从配置的远程 URL 获取 Markdown 内容
   - URL 在代码中预留（后续替换）

2. **页面展示**
   - 返回按钮导航回设置页面
   - Markdown 内容渲染
   - 加载状态和错误处理

3. **设置页集成**
   - 在 Options 页面添加"查看更新日志"链接

## 配置

- 远程 Markdown URL: 代码预留占位符

## 待办

- [ ] 创建 changelog 入口页面
- [ ] 实现远程 Markdown 加载和渲染
- [ ] 在设置页添加跳转链接
- [ ] 添加路由配置
