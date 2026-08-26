// 解析 page-agent demo 的 LLM provider 配置（个人本地使用）
// 用法: node extract-provider.mjs [version]
//   version 省略则自动取 npm 上最新版本
import { execSync } from 'node:child_process';

const version =
  process.argv[2] ||
  (() => {
    try {
      return execSync('npm view page-agent version', { encoding: 'utf8' }).trim();
    } catch {
      return '1.12.2';
    }
  })();

const url = `https://cdn.jsdelivr.net/npm/page-agent@${version}/dist/iife/page-agent.demo.js`;
console.log(`\n抓取: ${url}\n`);

const js = await fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
});

const pick = (key) => {
  const m = js.match(new RegExp(key + '=\\\\?`([^`]*)`'));
  return m ? m[1] : undefined;
};

const provider = {
  version,
  model: pick('DEMO_MODEL'),
  baseURL: pick('DEMO_BASE_URL'),
  apiKey: pick('DEDemoAPIKey') || pick('DEMO_API_KEY'),
};

console.log(JSON.stringify(provider, null, 2));

if (!provider.baseURL || !provider.model) {
  console.error('\n未找到默认配置（该版本可能已改结构）。');
  process.exit(1);
}

console.log('\n可直接用于 page-agent 的初始化配置:');
console.log(`  baseURL: ${provider.baseURL}`);
console.log(`  model:   ${provider.model}`);
console.log(`  apiKey:  ${provider.apiKey ?? '(空/占位)'}`);
