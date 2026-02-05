# DPP 同步服务器部署指南

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

#### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
wrangler login  # 浏览器授权
```

#### 2. 进入项目目录

```bash
cd packages/cf-worker-googlesheet
```

#### 3. 生成并配置访问令牌

```bash
# 生成令牌 (保存好，配置扩展时需要)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 配置 Secret
wrangler secret put SYNC_ACCESS_TOKEN
# 粘贴上面生成的令牌
```

#### 4. 创建 KV Namespace

```bash
wrangler kv:namespace create SYNC_KV
```

输出示例：

```
✅ Success!
[[kv_namespaces]]
binding = "SYNC_KV"
id = "abcd1234efgh5678"  # 复制这个 ID
```

编辑 `wrangler.toml`，替换 `kv_namespaces` 下的 `id` 字段：

```toml
[[kv_namespaces]]
binding = "SYNC_KV"
id = "abcd1234efgh5678"  # 替换为你的 ID
```

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
wrangler secret put GOOGLE_SERVICE_ACCOUNT
# 粘贴整个 JSON 文件内容

# Spreadsheet ID
wrangler secret put GOOGLE_SPREADSHEET_ID
# 粘贴刚才复制的 ID
```

#### 6. 部署

```bash
wrangler deploy
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
wrangler tail

# 重新部署
wrangler deploy

# 管理 Secrets
wrangler secret list
wrangler secret put SECRET_NAME
wrangler secret delete SECRET_NAME

# 管理 KV (调试用)
wrangler kv:namespace list
wrangler kv:key get "last_cursor" --namespace-id=YOUR_KV_ID
wrangler kv:key put "last_cursor" "0" --namespace-id=YOUR_KV_ID
```

### 故障排查

| 问题                | 解决方案                                                      |
| ------------------- | ------------------------------------------------------------- |
| 401 Unauthorized    | `wrangler secret put SYNC_ACCESS_TOKEN` 重新设置令牌          |
| 部署失败            | `wrangler logout && wrangler login` 重新登录                  |
| KV Namespace 未绑定 | 检查 `wrangler.toml` 中的 `id` 是否正确                       |
| Sheets 备份失败     | 确认 Service Account 已分享 Editor 权限，检查 JSON 和 ID 配置 |
| 同步游标异常        | `wrangler kv:key get "last_cursor" --namespace-id=ID` 查看值  |

---

## 方案二: Node.js VPS

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

# 安装 pnpm 和 PM2
npm install -g pnpm pm2

# 验证
node -v  # v18.x.x
pnpm -v  # 8.x.x
```

#### 2. 部署代码

**本地构建并上传**

```bash
# 本地执行
cd packages/node-server
pnpm install && pnpm build
tar -czf dpp-server.tar.gz dist package.json pnpm-lock.yaml
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
cd DPPV5/packages/node-server
pnpm install --prod && pnpm build
```

#### 3. 启动服务

```bash
pm2 start dist/index.js --name dpp-sync
pm2 save
pm2 startup  # 复制输出的命令并执行

# 测试
curl http://localhost:3000/health
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
        proxy_pass http://localhost:3000;
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
- **访问令牌**: 留空 (或在代码中自定义)
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
git pull && pnpm build && pm2 restart dpp-sync
```

### 故障排查

| 问题           | 解决方案                             |
| -------------- | ------------------------------------ |
| 服务无法启动   | `pm2 logs dpp-sync` 查看错误日志     |
| 端口占用       | `lsof -i :3000` 查找占用进程         |
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

| 名称      | 用途         | 创建命令                               |
| --------- | ------------ | -------------------------------------- |
| `SYNC_KV` | 存储同步游标 | `wrangler kv:namespace create SYNC_KV` |

### Node.js VPS

- VPS 服务器 (推荐: 阿里云/腾讯云/Vultr)
- 域名 (用于 HTTPS)
- Nginx + PM2

---

## 推荐选择

- **个人/小团队 (1-10人)**: Cloudflare Workers
- **中型团队**: Cloudflare Workers 付费版
- **对数据敏感/大型企业**: Node.js VPS
