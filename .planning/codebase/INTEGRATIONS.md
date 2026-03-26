# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**AI Model Providers:**
- **Ollama** (Local LLM)
  - Default URL: `http://localhost:11434`
  - Default Model: `llama3.2`
  - Implementation: `src/lib/ai/ollama.ts` (OllamaProvider class)

- **Anthropic API**
  - Base URL: `https://api.anthropic.com` (configurable)
  - Supports native Anthropic API and OpenAI-compatible endpoints
  - Implementation: `src/lib/ai/provider.ts` (AnthropicProvider class)
  - Config keys: `ai_anthropic_base_url`, `ai_anthropic_model`, `ai_anthropic_api_key`

- **OpenAI-Compatible APIs** (Custom provider)
  - Configurable base URL and API key
  - Supports streaming responses
  - Implementation: `src/lib/ai/provider.ts` (OpenAICompatibleProvider class)
  - Config keys: `ai_custom_base_url`, `ai_custom_model`, `ai_custom_api_key`

**Hot News Feed:**
- GitHub Pages hosted news archive
- URL: `https://slothvips.github.io/daily-hot-news/archives`
- Implementation: `src/features/hotNews/api/index.ts`
- Cached in IndexedDB (`hotNews` table)

**Sync Server:**
- Self-hosted sync server (custom implementation)
- Endpoints: `/api/sync/push`, `/api/sync/pull`, `/api/sync/pending`
- Config keys: `custom_server_url`, `sync_access_token`
- Implementation: `src/db/index.ts` (defaultSyncProvider)

**Jenkins Integration:**
- Multiple Jenkins environments supported
- Per-environment configuration: host, user, token
- Implementation: `src/lib/db/jenkins.ts`, `src/entrypoints/background/handlers/jenkins.ts`
- Config keys: `jenkins_environments`, `jenkins_current_env`

**Zentao (Project Management):**
- Fetch JSON via proxy handler
- Implementation: `src/entrypoints/zentao.content.tsx`
- Message type: `ZEN_FETCH_JSON`

## Data Storage

**Database:**
- **IndexedDB via Dexie**
  - Database name: `DPPDB`
  - Schema version: 3
  - Tables: links, jobs, settings, tags, jobTags, linkTags, linkStats, myBuilds, othersBuilds, hotNews, recordings, blackboard, operations, syncMetadata, deferred_ops, aiSessions, aiMessages, remoteActivityLog
  - Location: `src/db/index.ts`, `src/db/types.ts`

**Encryption:**
- **Web Crypto API** (AES-256-GCM)
  - E2EE for sync data
  - Key storage: IndexedDB settings table
  - Implementation: `src/lib/crypto/encryption.ts`

## Authentication & Identity

**Auth Provider:**
- Custom token-based authentication for sync server
- Access token passed via `X-Access-Token` header
- Config key: `sync_access_token`

**Jenkins Authentication:**
- Per-environment user/API token pairs
- Stored encrypted in settings

**AI API Authentication:**
- API keys stored encrypted in settings
- Decrypted on-demand via Web Crypto API

## Monitoring & Observability

**Logging:**
- Custom logger utility
- Implementation: `src/utils/logger.ts`
- Levels: debug, info, warn, error
- Browser console output

**Error Tracking:**
- Not detected (no Sentry, LogRocket, or similar)

**Session Recording:**
- rrweb for browser session recording
- Console/network event interception
- Implementation: `src/entrypoints/recorder.content.ts`, `src/lib/rrweb-plugins/`

## CI/CD & Deployment

**Build:**
- WXT built-in build commands
- Chrome and Firefox targets
- Output: `.output/` directory

**Distribution:**
- ZIP packaging via `wxt zip` / `wxt zip:firefox`

**Git Hooks:**
- pre-commit: lint-staged (eslint --fix, prettier --write)

## Environment Configuration

**Required settings (stored in IndexedDB):**
- `ai_provider_type` - AI provider selection
- `ai_*_base_url` - Provider API URL
- `ai_*_model` - Model name
- `ai_*_api_key` - Encrypted API key
- `custom_server_url` - Sync server URL
- `sync_access_token` - Sync server token
- `jenkins_environments` - Array of Jenkins env configs
- `theme` - UI theme preference
- Feature toggles: `feature_hotnews_enabled`, `feature_links_enabled`
- Sync settings: `auto_sync_enabled`, `auto_sync_interval`

## Webhooks & Callbacks

**Incoming:**
- Chrome Extension Messages (runtime.onMessage)
  - Types prefixed: `JENKINS_*`, `RECORDER_*`, `SYNC_*`, `PROXY_*`, `PAGE_AGENT_*`
  - Implementation: `src/entrypoints/background.ts`

**Outgoing:**
- None detected (extension does not send webhooks)

**Chrome Alarms:**
- Auto-sync alarm (`auto-sync-alarm`)
- Configurable interval (default 30 minutes)

---

*Integration audit: 2026-03-26*
