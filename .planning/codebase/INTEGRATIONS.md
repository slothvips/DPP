# External Integrations

**Analysis Date:** 2026-03-27

## APIs & External Services

**Jenkins CI/CD:**
- Jenkins API (self-hosted) - Build automation and job management
  - Auth: Basic Auth (username:token)
  - Client: Custom implementation in `src/features/jenkins/api/client.ts`
  - Endpoints: `/api/json` with tree queries

**AI Model Providers:**
- Ollama (local) - Local LLM inference
  - Default URL: `http://localhost:11434`
  - Default Model: `llama3.2`
  - Client: `src/lib/ai/ollama.ts`
- Anthropic API - Claude models
  - Base URL: `https://api.anthropic.com`
  - Auth: `x-api-key` header
  - Client: `src/lib/ai/provider.ts` (AnthropicProvider class)
- OpenAI-compatible APIs - Custom/third-party AI services
  - Base URL: Configurable
  - Auth: Bearer token
  - Client: `src/lib/ai/provider.ts` (OpenAICompatibleProvider class)

**Hot News Feed:**
- GitHub Pages hosted news aggregator
  - Base URL: `https://slothvips.github.io/daily-hot-news/archives`
  - Client: `src/features/hotNews/api/index.ts`
  - Format: Markdown files (`daily_hot_{date}.md`)

**Sync Backend:**
- Custom sync server (node-server or cf-worker-googlesheet)
  - Endpoints: `/api/sync/push`, `/api/sync/pull`, `/api/sync/pending`
  - Auth: `X-Access-Token` header
  - Client: `src/db/index.ts` (defaultSyncProvider)
  - Config: `custom_server_url` setting

## Data Storage

**Browser Extension:**
- IndexedDB (via Dexie.js) - Local storage
  - Database name: `DPPDB`
  - Tables: links, jobs, settings, tags, jobTags, linkTags, linkStats, myBuilds, othersBuilds, hotNews, recordings, blackboard, operations, syncMetadata, deferred_ops, aiSessions, aiMessages, remoteActivityLog
  - Client: `src/db/index.ts`

**Node Server (local dev):**
- SQLite (better-sqlite3) - Sync operations storage
  - Client: `packages/node-server/src/db.ts`
  - Tables: sync_operations (via dbOps module)

**Cloudflare Worker:**
- KV Namespace - Cursor storage
  - Key: `last_cursor`
  - Used for: Sync operation tracking

**Google Sheets (cf-worker-googlesheet):**
- Google Sheets API - Alternative sync storage
  - Auth: Google Service Account (JWT)
  - Scopes: `https://www.googleapis.com/auth/spreadsheets`
  - Client: `packages/cf-worker-googlesheet/src/lib/sheets.ts`

## Authentication & Identity

**Extension Auth:**
- Custom sync access token
  - Storage: IndexedDB `settings` table (`sync_access_token`)
  - Usage: `X-Access-Token` header for sync API calls

**Jenkins Auth:**
- Basic Auth (username + API token)
  - Storage: IndexedDB `settings` table (encrypted via Web Crypto)
  - Key: `jenkins_credentials`

**E2EE Sync Key:**
- AES-GCM 256-bit symmetric key
  - Storage: IndexedDB `settings` table (`sync_encryption_key`)
  - Generation: Web Crypto API (`crypto.subtle.generateKey`)
  - Export/Import: Base64 encoded

**Google Auth (Cloudflare Worker):**
- Service Account JWT
  - Env var: `GOOGLE_SERVICE_ACCOUNT` (JSON string)
  - Library: `google-auth-library`

## Monitoring & Observability

**Error Tracking:**
- Custom logger utility (`src/utils/logger.ts`)
- Prefix: `[DPP]`
- Dev-only debug: `if (level === 'debug' && !isDev) return;`
- Console method mapping: debug -> log, info/warn/error -> respective methods

**Extension Logging:**
- Browser console logging
- Service worker and background contexts use different logging transports

## CI/CD & Deployment

**Browser Extension:**
- WXT build system
- Commands: `pnpm build`, `pnpm zip`
- Output: `dist/` directory

**Node Server:**
- Hono framework
- Deployment: `packages/node-server/`
- Dev: `tsx watch src/index.ts`
- Production: `node dist/index.js`

**Cloudflare Worker:**
- Wrangler deployment
- Deployment: `packages/cf-worker-googlesheet/`
- Commands: `pnpm dev`, `pnpm deploy`

## Environment Configuration

**Required env vars (node-server):**
- `SYNC_ACCESS_TOKEN` - Sync authentication token (default: 'dev-token')

**Required env vars (cf-worker-googlesheet):**
- `GOOGLE_SERVICE_ACCOUNT` - Google service account JSON
- `SYNC_ACCESS_TOKEN` - Sync authentication token
- `GOOGLE_SPREADSHEET_ID` - Target spreadsheet ID

**Secrets location:**
- Extension: IndexedDB (encrypted)
- Node server: Environment variables
- Cloudflare Worker: Environment variables (wrangler secret)

## Webhooks & Callbacks

**Extension Message Routing:**
- Background script uses strategy pattern for message handling
- Handler modules in `src/entrypoints/background/handlers/`
- Message types prefixed: `JENKINS_*`, `RECORDER_*`, `SYNC_*`, `PROXY_*`, `PAGE_AGENT_*`

**Content Script Injection:**
- PageAgent injected on demand via `PAGE_AGENT_INJECT` message
- Interceptors: `network-interceptor.js`, `console-interceptor.js`

**Browser APIs:**
- Alarms API - Auto-sync timer
- Tabs API - Tab management
- ActiveTab API - Active tab access
- Scripting API - Content script injection
- SidePanel API - Side panel support

## External Libraries Used

**Core:**
- rrweb - Session recording
- page-agent - In-page automation
- Monaco Editor - Code editing

**UI:**
- Radix UI - Headless components
- lucide-react - Icons
- react-markdown - Markdown rendering

**Data:**
- lodash-es - Utility functions
- date-fns - Date manipulation
- diff - Diff algorithm

---

*Integration audit: 2026-03-27*
