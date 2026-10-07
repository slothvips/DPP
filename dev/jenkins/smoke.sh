#!/usr/bin/env bash
# Jenkins 本地测试环境冒烟检查。
# 前置：容器已启动（docker compose -f dev/jenkins/docker-compose.yml up -d）。
# 用法：bash dev/jenkins/smoke.sh
# 覆盖：JENKINS_URL / JENKINS_USER / JENKINS_TOKEN
set -euo pipefail

J="${JENKINS_URL:-http://localhost:8080}"
U="${JENKINS_USER:-admin}"
T="${JENKINS_TOKEN:-admin}"
PASS=0
FAIL=0
CJ="$(mktemp)"
trap 'rm -f "$CJ"' EXIT

ok() { printf '  ok   %s\n' "$1"; PASS=$((PASS + 1)); }
bad() { printf '  FAIL %s\n' "$1"; FAIL=$((FAIL + 1)); }
eq() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (got '$2', want '$3')"; fi; }

# 读取 stdin JSON，取指定表达式的值（表达式如 ['result']）
py() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)" 2>/dev/null || true; }

echo "== 连通性与鉴权 =="
eq "认证读取根信息" "$(curl -s -o /dev/null -w '%{http_code}' -u "$U:$T" "$J/api/json")" "200"
eq "匿名被拒绝" "$(curl -s -o /dev/null -w '%{http_code}' "$J/api/json")" "403"

CRUMB_JSON="$(curl -s -c "$CJ" -u "$U:$T" "$J/crumbIssuer/api/json")"
CF="$(printf '%s' "$CRUMB_JSON" | py "['crumbRequestField']")"
CV="$(printf '%s' "$CRUMB_JSON" | py "['crumb']")"
[ -n "$CF" ] && [ -n "$CV" ] && ok "CSRF crumb 可用" || bad "CSRF crumb 不可用"

echo "== 任务发现 =="
eq "根目录存在 demo 文件夹" "$(curl -s -u "$U:$T" "$J/api/json?tree=jobs%5Bname%5D" | py "['jobs'][0]['name']")" "demo"
DEMO_JOBS="$(curl -s -u "$U:$T" "$J/job/demo/api/json?tree=jobs%5Bname%5D")"
eq "demo 下预置 13 个任务" "$(printf '%s' "$DEMO_JOBS" | py "['jobs']" | python3 -c 'import sys,ast;print(len(ast.literal_eval(sys.stdin.read())))')" "13"
MISSING="$(printf '%s' "$DEMO_JOBS" | python3 -c '
import json,sys
need={"nested","empty","dpp-pipeline","dpp-failing","dpp-freestyle","dpp-unstable","dpp-aborted","dpp-params","dpp-input","dpp-slow","dpp-parallel","dpp-disabled","dpp-unbuilt"}
have={item["name"] for item in json.load(sys.stdin)["jobs"]}
print(",".join(sorted(need-have)))
')"
[ -z "$MISSING" ] && ok "预置任务齐全" || bad "缺少任务 ($MISSING)"
eq "空文件夹没有子任务" "$(curl -s -u "$U:$T" "$J/job/demo/job/empty/api/json?tree=jobs%5Bname%5D" | py "['jobs']" | python3 -c 'import sys,ast;print(len(ast.literal_eval(sys.stdin.read())))')" "0"
eq "嵌套任务存在" "$(curl -s -u "$U:$T" "$J/job/demo/job/nested/job/dpp-leaf/api/json?tree=name" | py "['name']")" "dpp-leaf"
eq "禁用任务不可构建" "$(curl -s -u "$U:$T" "$J/job/demo/job/dpp-disabled/api/json?tree=buildable" | py "['buildable']")" "False"

P_BASE="$J/job/demo/job/dpp-pipeline"

echo "== 触发参数化 Pipeline =="
NEXT="$(curl -s -u "$U:$T" "$P_BASE/api/json?tree=nextBuildNumber" | py "['nextBuildNumber']")"
LOC="$(curl -s -D - -o /dev/null -b "$CJ" -u "$U:$T" -H "$CF: $CV" \
  -X POST "$P_BASE/buildWithParameters?GREETING=smoke" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')"
case "$LOC" in
  */queue/item/*/) ok "触发返回队列地址 ($LOC)" ;;
  *) bad "触发未返回队列地址 (got '$LOC')" ;;
esac

echo "== 等待构建 #$NEXT 完成 =="
RESP=""
for _ in $(seq 1 60); do
  RESP="$(curl -s -u "$U:$T" "$P_BASE/$NEXT/api/json?tree=result,building" || true)"
  BUILDING="$(printf '%s' "$RESP" | py "['building']")"
  if [ "$BUILDING" = "False" ]; then break; fi
  sleep 2
done
eq "Pipeline 构建成功" "$(printf '%s' "$RESP" | py "['result']")" "SUCCESS"

echo "== 构建详情 / 测试报告 / 产物 =="
WF="$(curl -s -u "$U:$T" "$P_BASE/$NEXT/wfapi/describe")"
eq "wfapi 构建状态" "$(printf '%s' "$WF" | py "['status']")" "SUCCESS"
eq "阶段数量" "$(printf '%s' "$WF" | py "['stages']" | python3 -c 'import sys,ast;print(len(ast.literal_eval(sys.stdin.read())))')" "3"

ART="$(curl -s -u "$U:$T" "$P_BASE/$NEXT/api/json?tree=artifacts%5BrelativePath%5D" | py "['artifacts'][0]['relativePath']")"
eq "构建产物存在" "$ART" "artifact.txt"
eq "产物内容正确" "$(curl -s -u "$U:$T" "$P_BASE/$NEXT/artifact/artifact.txt")" "built by dpp"
eq "测试报告通过数" "$(curl -s -u "$U:$T" "$P_BASE/$NEXT/testReport/api/json?tree=passCount" | py "['passCount']")" "1"

PROG="$(curl -s -D - -o /dev/null -u "$U:$T" "$P_BASE/$NEXT/logText/progressiveText?start=0" | tr -d '\r' | awk 'tolower($1)=="x-text-size:"{print $2}')"
[ -n "$PROG" ] && ok "渐进日志分页头可用 (X-Text-Size=$PROG)" || bad "渐进日志分页头缺失"

echo "== 失败任务 =="
F_BASE="$J/job/demo/job/dpp-failing"
FNEXT="$(curl -s -u "$U:$T" "$F_BASE/api/json?tree=nextBuildNumber" | py "['nextBuildNumber']")"
curl -s -o /dev/null -b "$CJ" -u "$U:$T" -H "$CF: $CV" -X POST "$F_BASE/build"
FRESP=""
for _ in $(seq 1 30); do
  FRESP="$(curl -s -u "$U:$T" "$F_BASE/$FNEXT/api/json?tree=result,building" || true)"
  FB="$(printf '%s' "$FRESP" | py "['building']")"
  if [ "$FB" = "False" ]; then break; fi
  sleep 2
done
eq "失败任务结果为 FAILURE" "$(printf '%s' "$FRESP" | py "['result']")" "FAILURE"

wait_result() {
  local label="$1" base="$2" num="$3" want="$4" resp="" building=""
  for _ in $(seq 1 60); do
    resp="$(curl -s -u "$U:$T" "$base/$num/api/json?tree=result,building" || true)"
    building="$(printf '%s' "$resp" | py "['building']")"
    if [ "$building" = "False" ]; then break; fi
    sleep 2
  done
  eq "$label" "$(printf '%s' "$resp" | py "['result']")" "$want"
}

trigger_build() {
  local base="$1" path="$2"
  local next
  next="$(curl -s -u "$U:$T" "$base/api/json?tree=nextBuildNumber" | py "['nextBuildNumber']")"
  curl -s -o /dev/null -b "$CJ" -u "$U:$T" -H "$CF: $CV" -X POST "$base/$path"
  wait_result "$3" "$base" "$next" "$4"
}

echo "== 其余结果与参数 =="
trigger_build "$J/job/demo/job/dpp-unstable" "build" "不稳定任务结果为 UNSTABLE" "UNSTABLE"
eq "不稳定任务失败用例数" "$(curl -s -u "$U:$T" "$J/job/demo/job/dpp-unstable/lastBuild/testReport/api/json?tree=failCount,skipCount" | py "['failCount']")" "1"
trigger_build "$J/job/demo/job/dpp-aborted" "build" "中止任务结果为 ABORTED" "ABORTED"
trigger_build "$J/job/demo/job/dpp-parallel" "build" "并行任务结果为 SUCCESS" "SUCCESS"
trigger_build "$J/job/demo/job/dpp-params" "buildWithParameters" "参数任务结果为 SUCCESS" "SUCCESS"
eq "参数任务日志不包含令牌值" "$(curl -s -u "$U:$T" "$J/job/demo/job/dpp-params/lastBuild/consoleText" | python3 -c 'import sys; text=sys.stdin.read(); print("no" if "fixture-token" not in text and "TOKEN length=" in text else "yes")')" "no"
trigger_build "$J/job/demo/job/dpp-slow" "buildWithParameters" "慢任务默认结果为 SUCCESS" "SUCCESS"
trigger_build "$J/job/demo/job/nested/job/dpp-leaf" "build" "嵌套任务结果为 SUCCESS" "SUCCESS"

echo
echo "通过 ${PASS} 项，失败 ${FAIL} 项"
[ "$FAIL" -eq 0 ]
