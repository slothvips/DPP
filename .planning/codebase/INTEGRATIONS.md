# External Integrations

**Analysis Date:** 2026-03-27

## APIs & External Services

**AI Model Providers:**

- **Ollama** - Local AI model inference
  - Endpoint: `http://localhost:11434` (configurable)
  - Default model: `llama3.2`
  - Implementation: `src/lib/ai/ollama.ts`

- **Anthropic** - Claude API access
  - Endpoint: `https://api.anthropic.com` (native) or OpenAI-compatible
  - API key: Stored in settings (`api_key`)
  - Implementation: `src/lib/ai/provider.ts`

- **OpenAI-Compatible** - Third-party OpenAI-compatible APIs
  - Configurable base URL and API key
  - Implementation: `src/lib/ai/provider.ts`

- **WebLLM** - Browser-based local LLM (mentioned in docs)
  - No explicit implementation found

**Jenkins CI/CD:**

- **Jenkins** - CI server integration
  - Authentication: Basic Auth (username:token)
  - Implementation: `src/features/jenkins/api/client.ts`
  - Configuration: Stored in IndexedDB settings

**Hot News Feed:**

- **GitHub Pages News API** - Daily hot news aggregation
  - Endpoint: `https://slothvips.github.io/daily-hot-news/archives/daily_hot_{date}.md`
  - Implementation: `src/features/hotNews/api/index.ts`
  - Cache: 24 hours, max 7 days

## Data Storage

**Local Database:**

- **IndexedDB (via Dexie.js)**
  - Database name: `DPPDB`
  - Tables: links, jobs, settings, tags, jobTags, linkTags, linkStats, myBuilds, othersBuilds, hotNews, recordings, blackboard, operations, syncMetadata, deferred_ops, aiSessions, aiMessages, remoteActivityLog
  - Location: Browser's IndexedDB
  - Schema: `src/db/index.ts`

**Sync Server:**

- **Custom E2EE Sync Server** - End-to-end encrypted data sync
  - Endpoint: Configurable via `custom_server_url` setting
  - Default: `http://localhost:3000`
  - Authentication: `X-Access-Token` header
  - Implementation: `src/db/index.ts` (defaultSyncProvider)
  - Blind storage model: Server only sees encrypted blobs

## Authentication & Identity

**Extension Settings Auth:**

- **Sync Access Token** - Stored in IndexedDB (`sync_access_token`)
- **Custom Server URL** - Stored in IndexedDB (`custom_server_url`)

**Jenkins Auth:**

- **Basic Authentication** - Username and API token
  - Stored in IndexedDB (per-environment credentials)
  - Credentials object: `{ baseUrl, user, token }`
  - Implementation: `src/features/jenkins/api/client.ts`

**AI Provider Auth:**

- **API Keys** - Stored in IndexedDB settings
  - Anthropic: `api_key` setting
  - Custom providers: `ai_api_key` setting

## Encryption & Security

**End-to-End Encryption (E2EE):**

- **Web Crypto API** - AES-256-GCM encryption
  - Algorithm: AES-GCM, 256-bit key
  - Key storage: IndexedDB (via Dexie settings)
  - Key derivation: Direct key import/export (no passphrase)
  - Implementation: `src/lib/crypto/encryption.ts`

- **Sync Encryption** - Encrypted sync operations
  - Each operation encrypted before upload
  - Key hash for identification: SHA-256 (first 8 bytes)
  - Implementation: `src/lib/sync/crypto-helpers.ts`

## Monitoring & Observability

**Error Tracking:**
- Custom logger utility
- Implementation: `src/utils/logger.ts`
- No external error tracking service detected

**Logging:**
- Console logging via custom logger
- Debug mode available via `debug` flag in HTTP options

## CI/CD & Deployment

**Extension Distribution:**
- Chrome Web Store (via WXT zip)
- Firefox Add-ons (via WXT zip)

**Cloudflare Worker:**
- `packages/cf-worker-googlesheet` - Google Sheets integration worker
  - Uses hono 4.11.7 framework
  - Google Auth Library for OAuth
  - google-spreadsheet for Sheet operations
  - jose for JWT handling

**Node Server:**
- `packages/node-server` - Local sync server
  - Hono framework with @hono/node-server
  - better-sqlite3 for persistence
  - Zod for validation

## Environment Configuration

**Stored in IndexedDB (via settings table):**

- `custom_server_url` - Sync server URL
- `sync_access_token` - Sync authentication token
- `sync_encryption_key` - E2EE key (Base64 encoded)
- `api_key` - Anthropic API key
- `ai_api_key` - Custom/other AI provider key
- `ai_provider_type` - Provider selection (ollama/anthropic/custom)
- `ollama_base_url` - Ollama server URL
- `ollama_model` - Ollama model name
- Jenkins credentials per environment

**Chrome Extension Permissions:**

- `storage` - Extension storage
- `sidePanel` - Side panel UI
- `alarms` - Scheduled tasks
- `activeTab` - Current tab access
- `scripting` - Content script injection
- `tabs` - Tab management
- `<all_urls>` - Host permission for web requests

## Webhooks & Callbacks

**Background Message Handling:**
- Strategy pattern for message routing
- Handler modules in `src/entrypoints/background/handlers/`
- Message type prefixes: `JENKINS_*`, `RECORDER_*`, `SYNC_*`, `PROXY_*`
- Implementation: `src/entrypoints/background.ts`

**Page Agent:**
- Content script injection on demand via `PAGE_AGENT_INJECT` message
- Handler: `src/entrypoints/background/handlers/pageAgent.ts`
- Implementation: `src/entrypoints/pageAgent.content.ts`

**Network Interception:**
- `src/entrypoints/network-interceptor.ts` - Fetch/XHR override for recording

---

*Integration audit: 2026-03-27*
