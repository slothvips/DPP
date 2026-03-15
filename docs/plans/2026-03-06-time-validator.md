# 时间检测机制实现计划

## 背景

用户要求设计一种机制：当检测到本地时间不准确时，禁止使用本应用。

## 需求

- **时间源**: 中国大陆可直连的 NTP 服务器（阿里云 time.pool.aliyun.com）
- **偏差阈值**: 1 分钟（60秒）
- **行为**: 警告 + 允许用户忽略继续使用

## 实现方案

### 1. 创建时间检测工具

**文件**: `src/lib/timeValidator.ts`

```typescript
interface TimeValidationResult {
  isValid: boolean;
  offset: number; // 本地时间与服务器时间的偏差（毫秒）
  serverTime: number;
  error?: string;
}

// 使用阿里云 NTP 服务器获取准确时间
async function getNetworkTime(): Promise<number>;

// 验证本地时间是否准确（偏差 < 60秒）
async function validateLocalTime(): Promise<TimeValidationResult>;
```

### 2. 创建时间警告组件

**文件**: `src/components/TimeWarning.tsx`

- 显示警告信息：本地时间与服务器时间偏差超过阈值
- 提供"忽略"按钮允许用户继续使用
- 提供"重新检查"按钮

### 3. 集成到应用入口

**修改文件**: `src/entrypoints/sidepanel/App.tsx`

在应用初始化时：

1. 调用 `validateLocalTime()` 检查时间
2. 如果时间不准确，显示警告组件覆盖整个界面
3. 用户可选择忽略（记录到 localStorage）继续使用

### 4. 可选：后台定期检查

- 在 background.ts 中定期检查时间
- 如果时间变得不准确，发送消息通知前端显示警告

## 关键文件

- `src/lib/timeValidator.ts` - 新建
- `src/components/TimeWarning.tsx` - 新建
- `src/entrypoints/sidepanel/App.tsx` - 修改

## 验证

1. 修改系统时间为过去/未来超过1分钟
2. 打开扩展应显示时间警告
3. 点击"忽略"后可以正常使用应用
4. 恢复正常时间后警告应消失
