# DPP 同步服务器部署指南

## 最短路径

以下命令都在仓库根目录执行。日常发布只需要选择对应的一条命令：

```bash
# 只打包 Chrome 扩展，产物在 .output/ 下
pnpm release:extension

# 部署生产 Worker（使用 wrangler.toml 顶层的 KV）
pnpm release:worker

# 部署测试 Worker（使用 env.test 的独立 KV）
pnpm release:worker:test

# 两者都执行
pnpm release

# 打包扩展并部署测试 Worker
pnpm release:test
```

### 首次部署 Cloudflare Worker

先完成一次登录和 Secret 配置，之后每次只执行 `pnpm release:worker`：

```bash
pnpm install
pnpm --filter dpp-worker exec wrangler login

# 生成访问令牌，并将它保存下来，稍后填入扩展设置
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
pnpm --filter dpp-worker exec wrangler secret put SYNC_ACCESS_TOKEN
pnpm --filter dpp-worker exec wrangler secret put GOOGLE_SERVICE_ACCOUNT
pnpm --filter dpp-worker exec wrangler secret put GOOGLE_SPREADSHEET_ID

pnpm release:worker
curl https://你的域名/health
```

`GOOGLE_SERVICE_ACCOUNT` 需要粘贴完整的 Service Account JSON，
`GOOGLE_SPREADSHEET_ID` 是 Google Sheets URL 中 `/d/` 和 `/edit` 之间的值。
当前 `wrangler.toml` 已使用 `KV` 绑定和 Durable Object 配置，不需要重复创建 KV。

### 切换生产和测试环境

生产环境使用 `dpp-sync-worker`、`dpp-sync.586726.xyz` 和生产 KV；测试环境使用
`env.test` 下的 `dpp-sync-worker-test`、`dpp-sync-test.586726.xyz` 和独立 KV。
首次启用测试环境时执行：

```bash
# 确认生产和测试 KV 都存在
pnpm --filter dpp-worker exec wrangler kv namespace list

# 新建测试 Google Sheet，并创建或复用已授权的 Service Account
# 将测试 Sheet 的 ID 和 Service Account JSON 只配置到 env.test

# 为测试环境单独设置三个 Secret
pnpm --filter dpp-worker exec wrangler secret put SYNC_ACCESS_TOKEN --env test
pnpm --filter dpp-worker exec wrangler secret put GOOGLE_SERVICE_ACCOUNT --env test
pnpm --filter dpp-worker exec wrangler secret put GOOGLE_SPREADSHEET_ID --env test

pnpm release:worker:test
```

之后切换目标只需执行 `pnpm release:worker`（生产）或 `pnpm release:worker:test`（测试）。
测试环境地址为 `https://dpp-sync-test.586726.xyz`，需要确保该域名由 Cloudflare 托管。

### 环境隔离清单

| 项目                | 生产                  | 测试                       | 是否必须不同 |
| ------------------- | --------------------- | -------------------------- | ------------ |
| Worker              | `dpp-sync-worker`     | `dpp-sync-worker-test`     | 是           |
| 域名                | `dpp-sync.586726.xyz` | `dpp-sync-test.586726.xyz` | 是           |
| KV                  | 顶层 `KV`             | `env.test.KV`              | 是           |
| Durable Object      | 顶层绑定              | `env.test` 绑定            | 是           |
| 访问令牌            | 生产 Secret           | 测试 Secret                | 是           |
| Google Spreadsheet  | 生产表                | 测试表                     | 是           |
| Service Account     | 生产 Secret           | 测试 Secret                | 建议不同     |
| 扩展服务器地址      | `dpp-sync.586726.xyz` | `dpp-sync-test.586726.xyz` | 是           |
| 扩展访问令牌        | 生产 Token            | 测试 Token                 | 是           |
| 扩展同步密钥        | 生产密钥              | 测试密钥                   | 建议不同     |
| Worker 入口和兼容性 | 相同                  | 相同                       | 否           |

测试表需要单独创建，并准备同样的 `Operations` 表头。Service Account 可以暂时复用，
但必须在测试环境单独执行 `secret put`；访问令牌和 Spreadsheet ID 不能复用。
扩展切换环境时要同时修改服务器地址和访问令牌；推荐使用独立的浏览器配置文件和同步密钥，
避免本地待同步操作或游标状态混入另一套环境。

部署完成后，在扩展选项页填写：

- 服务器地址：Worker 地址，不要追加 `/api/sync`
- 访问令牌：上面生成的 `SYNC_ACCESS_TOKEN`
- 加密密钥：在扩展中生成并备份

### 只发布扩展

```bash
pnpm release:extension
```

将 `.output/` 下生成的 Chrome zip 文件上传到 Chrome Web Store，或在浏览器的扩展管理页开启开发者模式后加载 `.output/chrome-mv3/`。

## 方案对比

| 方案               | 成本      | 部署时间 | 特点               |
| ------------------ | --------- | -------- | ------------------ |
| Cloudflare Workers | 免费      | 15分钟   | 全球 CDN，零运维   |
| Node.js VPS        | ¥30-50/月 | 15分钟   | 完全掌控，无限请求 |

---

## 方案一: Cloudflare Workers (推荐)

### 前置要求

- Cloudflare 账号 (https://dash.cloudflare.com/sign-up)
- Node.js 18+

### 部署步骤

#### 1. 登录 Wrangler

```bash
pnpm --filter dpp-worker exec wrangler login  # 浏览器授权
```

#### 2. 确认 Wrangler 可用

```bash
pnpm --filter dpp-worker exec wrangler --version
```

#### 3. 生成并配置访问令牌

```bash
# 生成令牌 (保存好，配置扩展时需要)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 配置 Secret
pnpm --filter dpp-worker exec wrangler secret put SYNC_ACCESS_TOKEN
# 粘贴上面生成的令牌
```

#### 4. KV Namespace

当前仓库的 `wrangler.toml` 已配置生产 KV Namespace，正常部署无需额外操作。
只有在更换 Cloudflare 账号或 KV 时，才需要重新创建 Namespace 并更新其中的 `id`。

#### 5. 配置 Google Sheets 备份

**创建 Service Account**

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目 → 启用 Google Sheets API
3. APIs & Services → Credentials → Create Credentials → Service Account
4. 下载 JSON 密钥文件

**创建 Google Sheets**

1. 新建表格，命名 `DPP Sync Backup`
2. 重命名 Sheet1 为 `Operations`
3. 导入表头：
   - 方式一：文件 → 导入 → 上传 `google-sheets-template.csv`
   - 方式二：手动输入第一行：`id,table,type,key,payload,timestamp,serverTimestamp`
4. 分享给 Service Account：
   - 在 JSON 密钥中找到 `client_email`
   - 点击 Share，粘贴邮箱，权限选 Editor
5. 复制 Spreadsheet ID (URL 中 `/d/[ID]/edit` 部分)

**配置 Secrets**

```bash
# Google Service Account
pnpm --filter dpp-worker exec wrangler secret put GOOGLE_SERVICE_ACCOUNT
# 粘贴整个 JSON 文件内容

# Spreadsheet ID
pnpm --filter dpp-worker exec wrangler secret put GOOGLE_SPREADSHEET_ID
# 粘贴刚才复制的 ID
```

#### 6. 部署

```bash
pnpm release:worker
```

成功后会显示 Worker URL：`https://dpp-sync-xxx.workers.dev`

#### 7. 测试

```bash
curl https://your-worker-url.workers.dev/health
# 返回: {"status":"ok"}
```

### 扩展配置

打开浏览器扩展选项页：

- **服务器地址**: `https://your-worker-url.workers.dev`
- **访问令牌**: 步骤3生成的令牌
- **加密密钥**: 点击生成并立即备份

保存后，在扩展中添加一个链接，打开 Google Sheets 检查 `Operations` 工作表是否有新记录。

---

### 可选：绑定自定义域名

前提：域名 DNS 托管在 Cloudflare

1. Cloudflare Dashboard → Workers & Pages → 选择 Worker
2. Triggers → Custom Domains → Add Custom Domain
3. 输入 `sync.yourdomain.com`，自动配置 DNS 和 HTTPS

---

### 维护命令

```bash
# 查看日志
pnpm --filter dpp-worker exec wrangler tail

# 重新部署
pnpm release:worker

# 管理 Secrets
pnpm --filter dpp-worker exec wrangler secret list
pnpm --filter dpp-worker exec wrangler secret put SECRET_NAME
pnpm --filter dpp-worker exec wrangler secret delete SECRET_NAME

# 管理 KV (调试用)
pnpm --filter dpp-worker exec wrangler kv namespace list
pnpm --filter dpp-worker exec wrangler kv key get "last_cursor" --namespace-id=YOUR_KV_ID
pnpm --filter dpp-worker exec wrangler kv key put "last_cursor" "0" --namespace-id=YOUR_KV_ID
```

### 故障排查

| 问题                | 解决方案                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ |
| 401 Unauthorized    | `pnpm --filter dpp-worker exec wrangler secret put SYNC_ACCESS_TOKEN` 重新设置令牌         |
| 部署失败            | `pnpm --filter dpp-worker exec wrangler logout` 后重新执行 login                           |
| KV Namespace 未绑定 | 检查 `wrangler.toml` 中的 `id` 是否正确                                                    |
| Sheets 备份失败     | 确认 Service Account 已分享 Editor 权限，检查 JSON 和 ID 配置                              |
| 同步游标异常        | `pnpm --filter dpp-worker exec wrangler kv key get "last_cursor" --namespace-id=ID` 查看值 |

---

## 方案二: Node.js VPS

Node.js 方案当前默认只有一个实例：数据库为 `sync.db`、端口为 `8889`、PM2 名称为
`dpp-sync`。生产和测试不能直接共用这三个值；如果要同时运行两套 Node 服务，必须另外准备
独立目录和数据库，并在代码中参数化端口、数据库路径和 PM2 名称。本文的快速切换命令只覆盖
Cloudflare Workers 的生产/测试环境。

### 前置要求

- VPS 服务器 (Ubuntu 20.04+, 1核1GB)
- 域名 (HTTPS 需要)

### 部署步骤

#### 1. 服务器环境准备

```bash
# SSH 登录
ssh root@your-server-ip

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2（pnpm 已按项目要求使用）
pnpm add --global pm2

# 验证
node -v  # v18.x.x
pnpm -v  # 8.x.x
```

#### 2. 部署代码

**本地构建并上传**

```bash
# 本地执行
pnpm install
pnpm --filter dpp-server build
tar -czf dpp-server.tar.gz -C packages/node-server dist package.json pnpm-lock.yaml
scp dpp-server.tar.gz root@your-server-ip:~/
```

**服务器解压**

```bash
mkdir -p ~/dpp-sync && cd ~/dpp-sync
tar -xzf ~/dpp-server.tar.gz
pnpm install --prod
```

或直接 Git 克隆：

```bash
git clone https://github.com/your-username/DPPV5.git
cd DPPV5
pnpm install
pnpm --filter dpp-server build
```

#### 3. 启动服务

```bash
SYNC_ACCESS_TOKEN=替换为真实令牌 pm2 start packages/node-server/dist/index.js --name dpp-sync
pm2 save
pm2 startup  # 复制输出的命令并执行

# 测试
curl http://localhost:8889/health
```

#### 4. 配置 Nginx 反向代理

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/dpp-sync
```

粘贴配置 (修改域名)：

```nginx
server {
    listen 80;
    server_name sync.yourdomain.com;

    location / {
        proxy_pass http://localhost:8889;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/dpp-sync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. 配置 HTTPS

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d sync.yourdomain.com
sudo certbot renew --dry-run  # 测试自动续期
```

#### 6. 配置防火墙

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### 扩展配置

- **服务器地址**: `https://sync.yourdomain.com`
- **访问令牌**: 启动服务时设置的 `SYNC_ACCESS_TOKEN`
- **加密密钥**: 生成并备份

### 维护命令

```bash
# 服务管理
pm2 status
pm2 logs dpp-sync
pm2 restart dpp-sync
pm2 stop dpp-sync

# 数据库备份
cp sync.db sync-backup-$(date +%Y%m%d).db

# 更新代码
git pull && pnpm install --prod && pnpm --filter dpp-server build && pm2 restart dpp-sync
```

### 故障排查

| 问题           | 解决方案                             |
| -------------- | ------------------------------------ |
| 服务无法启动   | `pm2 logs dpp-sync` 查看错误日志     |
| 端口占用       | `lsof -i :8889` 查找占用进程         |
| Nginx 502      | 确认 PM2 服务运行: `pm2 status`      |
| HTTPS 证书失败 | 检查域名 DNS 是否正确解析到服务器 IP |
| 无法连接       | `sudo ufw status` 检查防火墙         |

---

## 资源清单

### Cloudflare Workers

**必需 Secrets:**

| 名称                     | 获取方式                                   |
| ------------------------ | ------------------------------------------ |
| `SYNC_ACCESS_TOKEN`      | `node -e "console.log(...randomBytes...)"` |
| `GOOGLE_SERVICE_ACCOUNT` | Google Cloud Console 下载的 JSON           |
| `GOOGLE_SPREADSHEET_ID`  | Google Sheets URL 中的 ID                  |

**必需 KV:**

| 名称 | 用途         | 说明                        |
| ---- | ------------ | --------------------------- |
| `KV` | 存储同步游标 | 已在 `wrangler.toml` 中绑定 |

### Node.js VPS

- VPS 服务器 (推荐: 阿里云/腾讯云/Vultr)
- 域名 (用于 HTTPS)
- Nginx + PM2

---

## 推荐选择

- **个人/小团队 (1-10人)**: Cloudflare Workers
- **中型团队**: Cloudflare Workers 付费版
- **对数据敏感/大型企业**: Node.js VPS
