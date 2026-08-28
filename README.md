# DPP

DPP 是基于 WXT、React 19 和 TypeScript 构建的浏览器扩展，用于团队链接、Jenkins 工作流、工具箱、会话录制和 AI 辅助操作。

## 数据安全

DPP 使用端到端加密同步：

- 参与同步的数据在浏览器内使用 Web Crypto 加密后才上传。
- 同步密钥和个人私钥不会上传到服务端。
- Cloudflare Worker 只保存密文、密文分片和同步元数据，无法解密业务内容。
- 团队数据与个人密钥域数据使用独立密钥。
- Jenkins 凭证、录屏和本地缓存等敏感或大体积数据不进入团队同步日志。

密钥丢失后服务端无法恢复明文，请自行安全备份。

## 同步架构

```text
Dexie operations
  -> SyncEngine
  -> 浏览器端 AES-GCM 加密
  -> POST /api/sync/push
  -> Cloudflare Worker
  -> Durable Object 串行化 push
  -> D1 operations 追加日志
```

拉取和待同步统计使用：

- `GET /api/sync/pull?cursor=N`
- `GET /api/sync/pending?cursor=N&clientId=...`

D1 保存自增 cursor、操作 fingerprint 和 `(clientId, operationId)` 唯一约束。大密文使用 `__sync_chunk__` 记录分片，重组和解密始终在客户端完成。

当前环境：

| 环境 | Worker | D1 | 地址 |
| --- | --- | --- | --- |
| 生产 | `dpp-sync-worker` | `dpp-sync` | `https://dpp-sync.586726.xyz` |
| 测试 | `dpp-sync-test` | `dpp-sync-test` | `https://dpp-sync-test.586726.xyz` |

完整部署、迁移、监控和回滚说明见 [Cloudflare Worker + D1 部署指南](./packages/DEPLOY.md)。

## 技术栈

- WXT + React 19
- TypeScript Strict Mode
- UnoCSS + Shadcn theme variables
- Dexie.js + dexie-react-hooks
- rrweb
- Cloudflare Workers + Durable Objects + D1
- pnpm workspace

## 项目结构

```text
src/
  entrypoints/                 WXT 扩展入口
  components/ui/               通用 UI primitive
  features/                    业务功能
  db/                          Dexie schema 和同步入口
  lib/sync/                    SyncEngine、加密同步和分片恢复
packages/
  cf-worker-googlesheet/       Cloudflare Worker（历史目录名）
    migrations/                D1 schema migration
    src/index.ts               D1-only 长期入口
    src/migration.ts           旧 Google Sheet 临时迁移入口
tests/                         Node test runner 测试
```

## 安装与开发

要求 Node.js 20+ 和 pnpm 10+。

```bash
pnpm install
pnpm dev
```

Firefox：

```bash
pnpm dev:firefox
```

## 质量检查

```bash
pnpm test
pnpm compile
pnpm lint
pnpm build
```

Worker 检查：

```bash
pnpm --filter dpp-worker types
pnpm --filter dpp-worker exec tsc --noEmit
pnpm --filter dpp-worker exec wrangler deploy --dry-run --env test
pnpm --filter dpp-worker exec wrangler deploy --dry-run --env ""
```

## 构建与发布

```bash
# Chrome 扩展
pnpm build
pnpm zip

# Firefox 扩展
pnpm build:firefox
pnpm zip:firefox

# 测试 Worker
pnpm release:worker:test

# 生产 Worker
pnpm release:worker

# Chrome 扩展 + 生产 Worker
pnpm release
```

发布远程 Worker 前，先按部署指南确认目标 D1、Secret 和 Wrangler environment。
