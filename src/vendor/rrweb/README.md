# rrweb 本地集成指南

## 文件说明

```
src/vendor/rrweb/
├── rrweb.js      # ESM 模块 (主文件)
├── rrweb.d.ts    # TypeScript 类型定义
└── style.css     # 回放器样式
```

## 使用方式

### 1. 导入模块

```ts
// 在你的 TypeScript/JavaScript 文件中
import { record, Replayer } from '@/vendor/rrweb/rrweb.js';
```

### 2. 录制页面

```ts
import { record } from '@/vendor/rrweb/rrweb.js';
import type { eventWithTime } from '@rrweb/types';

const events: eventWithTime[] = [];

const stopFn = record({
  emit(event) {
    events.push(event);
  },
  // 可选配置
  // maskAllInputs: true,           // 遮盖所有输入内容
  // blockClass: 'rr-block',        // 阻止录制的元素 class
  // ignoreClass: 'rr-ignore',      // 忽略的元素 class
  // maskTextClass: 'rr-mask',      // 遮盖文本的元素 class
  // recordCanvas: true,            // 录制 canvas
  // collectFonts: true,            // 收集字体
  // inlineImages: true,            // 内联图片
});

// 停止录制
// stopFn();
```

### 3. 回放录制

```ts
import { Replayer } from '@/vendor/rrweb/rrweb.js';
import '@/vendor/rrweb/style.css';

const replayer = new Replayer(events, {
  root: document.getElementById('player-container')!,
  // 可选配置
  // speed: 1,                      // 播放速度
  // skipInactive: true,            // 跳过无活动时段
  // showWarning: false,            // 显示警告
  // showDebug: false,              // 显示调试信息
  // blockClass: 'rr-block',        // 阻止回放的元素 class
  // liveMode: false,               // 直播模式
  // triggerFocus: true,            // 触发焦点事件
  // mouseTail: true,               // 显示鼠标轨迹
});

// 播放控制
replayer.play();                    // 开始播放
replayer.play(3000);                // 从第 3 秒开始播放
replayer.pause();                   // 暂停
replayer.pause(5000);               // 暂停在第 5 秒
replayer.resume();                  // 继续播放

// 获取信息
const metadata = replayer.getMetaData();  // { startTime, endTime, totalTime }
const currentTime = replayer.getCurrentTime();

// 事件监听
replayer.on('start', () => console.log('开始播放'));
replayer.on('pause', () => console.log('暂停'));
replayer.on('finish', () => console.log('播放完成'));

// 销毁
replayer.destroy();
```

### 4. 常用类型

类型从 `@rrweb/types` 包导入：

```ts
import type { eventWithTime } from '@rrweb/types';
```

## 注意事项

1. 回放时必须引入 `style.css`，否则回放器样式会异常
2. 录制的 events 数据可能很大，建议压缩存储或分片上传
3. 跨域 iframe 需要设置 `recordCrossOriginIframes: true`
4. Canvas 录制需要设置 `recordCanvas: true`

## 来源

本地文件来自 rrweb 项目构建产物：
- 仓库: https://github.com/rrweb-io/rrweb
- 版本: 2.0.0-alpha.20
