# Jenkins 本地测试环境（Agent 使用说明）

本目录提供一个用 Docker 一键启动的本地 Jenkins，用于测试 `src/features/jenkins` 模块。
不要用真实 Jenkins 做自动化测试；这里的数据可以随便重置。

## 1. 启动 / 停止 / 重置

在项目根目录执行（不要 `cd` 进本目录）：

```bash
# 启动（首次或改插件列表时加 --build）
docker compose -f dev/jenkins/docker-compose.yml up -d --build

# 查看日志 / 等待就绪
docker compose -f dev/jenkins/docker-compose.yml logs -f
curl -s -o /dev/null -w '%{http_code}\n' -u admin:admin http://localhost:8080/api/json   # 期望 200

# 停止（保留数据）
docker compose -f dev/jenkins/docker-compose.yml down

# 彻底重置（删除所有构建记录与配置）
docker compose -f dev/jenkins/docker-compose.yml down -v
```

改任务定义（`casc.yaml`）后，`up -d --force-recreate` 重启即会重新应用，无需 `--build`；
只有改插件列表（`Dockerfile`）才需要 `--build`。

## 2. 连接信息

| 项 | 值 |
| --- | --- |
| 地址 | `http://localhost:8080` |
| 用户名 | `admin` |
| 密码 / Token | `admin` |
| CSRF | 已开启（匿名请求返回 403，属预期） |

在扩展里配置环境（设置 → Jenkins 环境）时填写：

```
host  = http://localhost:8080
user  = admin
token = admin
```

`password` 和 `API Token` 在 Basic Auth 下等价。扩展「自动检测」走的取 Token 接口也已打通：
`POST /user/admin/descriptorByName/jenkins.security.ApiTokenProperty/generateNewToken`。

> 写操作（触发、停止、审批）需要 CSRF crumb，且 crumb 与 session cookie 绑定。
> 用 curl 时务必 `-c jar` 取 crumb、`-b jar` 发请求（`smoke.sh` 已处理）。

## 3. 预置测试夹具

`casc.yaml` 用 JCasC + Job DSL 预置了：

| 任务 | URL | 类型 | 用途 / 预期 |
| --- | --- | --- | --- |
| `demo` | `/job/demo/` | Folder | 验证 folder 遍历 |
| `demo/dpp-pipeline` | `/job/demo/job/dpp-pipeline/` | Pipeline（声明式） | 参数 `GREETING`；3 阶段 `Prepare/Test/Artifact`；产出 `artifact.txt`；1 个通过测试；触发必须用 `buildWithParameters` |
| `demo/dpp-failing` | `/job/demo/job/dpp-failing/` | Pipeline | 构建结果固定 `FAILURE` |
| `demo/dpp-freestyle` | `/job/demo/job/dpp-freestyle/` | FreeStyle | 无参构建，结果 `SUCCESS` |

构建号：存量环境可能有历史构建，触发前先查 `nextBuildNumber`，或直接用 `lastBuild`。

## 4. 模块功能 → Jenkins 接口映射

所有请求都走 Basic Auth；URL 受 `src/features/jenkins/api/urlSafety.ts` 约束
（必须与配置环境同 origin，且在被选中的根路径前缀下）。

| 模块能力 | 消息类型 | 接口 |
| --- | --- | --- |
| 拉取任务 | `JENKINS_FETCH_JOBS` | `GET /api/json?tree=...`（递归遍历 folder） |
| 我的构建 | `JENKINS_FETCH_MY_BUILDS` | 遍历各 Job 的 `builds[...]`（`GET {jobUrl}/api/json?tree=...`），按用户匹配 |
| 能力探测 | — | `GET /api/json?tree=mode,useCrumbs,useSecurity,jobs[name]`、`/me/api/json`、`/queue/api/json`、`/crumbIssuer/api/json` |
| 触发构建 | `JENKINS_TRIGGER_BUILD` | `POST {jobUrl}/build` 或 `/buildWithParameters`；成功返回 `201` + `Location: .../queue/item/{id}/` |
| 队列查询 | `JENKINS_GET_QUEUE_ITEM` | `GET /queue/item/{id}/api/json` |
| 取消排队 | `JENKINS_CANCEL_QUEUE_ITEM` | `POST /queue/cancelItem?id={id}` |
| 停止运行中构建 | `JENKINS_STOP_BUILD` | `POST {buildUrl}/stop` |
| 取消构建 | `JENKINS_CANCEL_BUILD` | `POST {jobUrl}/{buildNumber}/stop` |
| Job 详情 | `JENKINS_GET_JOB_DETAILS` | `GET {jobUrl}/api/json` |
| 构建详情 | `JENKINS_GET_BUILD_DETAILS` | `GET {buildUrl}/api/json?tree=...`、`/testReport/api/json`、`/consoleText` |
| 测试明细 | `JENKINS_GET_TEST_DETAILS` | `GET {buildUrl}/testReport/api/json?tree=suites[...]` |
| 渐进日志 | `JENKINS_GET_BUILD_LOG` | `GET {buildUrl}/logText/progressiveText?start={n}`（看 `X-Text-Size`、`X-More-Data`） |
| 下载产物 | `JENKINS_DOWNLOAD_ARTIFACT` | `GET {buildUrl}/artifact/{relativePath}` |
| Pipeline 阶段 | `JENKINS_GET_PIPELINE_STAGES` | `GET {buildUrl}/wfapi/describe`、`/wfapi/pendingInputActions` |
| 阶段节点 | `JENKINS_GET_PIPELINE_STAGE_NODES` | `GET {buildUrl}/execution/node/{stageId}/wfapi/describe` |
| 节点日志 | `JENKINS_GET_PIPELINE_NODE_LOG` | `GET {buildUrl}/execution/node/{nodeId}/wfapi/log` |
| 审批 Pending Input | `JENKINS_SUBMIT_PIPELINE_INPUT` | `POST {buildUrl}/input/{id}/proceedEmpty` 或 `/abort`（需 crumb） |

## 5. 冒烟检查

`dev/jenkins/smoke.sh` 会对上面的关键链路做一次端到端验证（14 项）：

```bash
bash dev/jenkins/smoke.sh
# 覆盖目标：JENKINS_URL=... JENKINS_USER=... JENKINS_TOKEN=... bash dev/jenkins/smoke.sh
```

覆盖：鉴权、匿名拦截、CSRF、folder 遍历、参数化触发 + 队列地址、构建结果、
`wfapi/describe` 阶段、产物下载、测试报告、渐进日志分页头、失败任务结果。

> 该脚本会新建构建记录，属于预期副作用；要干净环境就 `down -v` 重置。

## 6. 仓库内已有自动化测试

```bash
pnpm test                 # 运行 tests/*.test.mjs（Node 内置 test runner）
```

Jenkins 相关：

- `tests/jenkinsLifecycle.test.mjs` —— 主要是对源码的字符串断言（检查关键实现还在）。
- `tests/jenkinsContracts.test.mjs`
- `tests/fixtures/fakeJenkins.mjs` —— `fetch` 桩，用于离线路由级测试。

这些**不连接**本目录的真实 Jenkins，改的是「实现契约」。需要真实协议行为时用第 5/7 节。

## 7. 推荐测试流程（Agent）

1. `docker compose ... up -d`，轮询 `GET /api/json` 到 `200`。
2. `bash dev/jenkins/smoke.sh`，确认环境本身健康（应 14/14）。
3. 针对改动点直接用 curl 打对应接口，最小复现，例如：
   ```bash
   J=http://localhost:8080
   curl -s -u admin:admin "$J/job/demo/job/dpp-pipeline/lastBuild/wfapi/describe" | python3 -m json.tool
   curl -s -u admin:admin "$J/job/demo/job/dpp-pipeline/lastBuild/testReport/api/json?tree=passCount,failCount"
   ```
4. 需要测扩展端到端：`pnpm dev` 起扩展，在设置里加上面的环境，
   确认 `jenkins_*` 能力开关（默认全开）后，验证工作台 / 队列 / 构建详情 / Pipeline / 产物各页。
5. 结束时如需干净状态：`docker compose -f dev/jenkins/docker-compose.yml down -v`。

## 8. 已知坑

- **JCasC 会插值 `${...}`**：`casc.yaml` 里 pipeline 脚本中的 `${params.X}` 会被当成配置变量替换成空。
  用 `+ params.X` 这类写法避开，或写成 `$${...}` 转义。
- **Job DSL 默认非沙箱**：非沙箱整段脚本需要「脚本审批」，JCasC 创建的任务会直接报
  `UnapprovedUsageException`。夹具显式使用 `sandbox(true)`；普通声明式步骤在沙箱下可用。
- **`workflow-aggregate` 已从 Jenkins 更新中心下架**：请安装具体插件
  （`workflow-cps`、`pipeline-model-definition`、`pipeline-stage-view` 等）。
- **带参数的 Job 必须用 `buildWithParameters`**：对参数化任务调 `/build` 会返回 `400`。
- **`junit` 的 testcase 需带 `classname`**：否则插件内部 NPE。
- **写操作需 crumb 且绑定 session**：见第 2 节 curl 注意事项。
- **匿名 403 是安全配置生效**，不是故障。

## 9. 目录文件

```
dev/jenkins/
├── docker-compose.yml   # 服务、端口 8080/50000、数据卷
├── Dockerfile           # jenkins/jenkins:lts-jdk17 + 预装插件
├── casc.yaml            # JCasC：安全、CSRF、预置任务
├── smoke.sh             # 端到端冒烟检查
└── README.md            # 本文件
```

插件清单在 `Dockerfile`：`configuration-as-code`、`job-dsl`、`workflow-cps`、
`workflow-job`、`workflow-multibranch`、`workflow-basic-steps`、`workflow-durable-task-step`、
`pipeline-model-definition`、`pipeline-stage-view`、`cloudbees-folder`、`junit`、`git`。
