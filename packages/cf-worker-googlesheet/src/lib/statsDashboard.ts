import { STATS_CATALOG } from './statsCatalog';

/**
 * 内置运营看板：零外部依赖。
 * 仅通过不可猜测的内部路径暴露（见 index.ts 的 STATS_DASHBOARD_PATH）。
 * 令牌经请求头传递，不出现在 URL。
 */
export function renderStatsDashboard(): string {
  const catalogJson = JSON.stringify(STATS_CATALOG);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>DPP 使用洞察</title>
<style>
  :root {
    --bg: #f4f5f7;
    --surface: #ffffff;
    --surface-2: #f8f9fb;
    --border: #e4e7ec;
    --text: #12151a;
    --muted: #5c6570;
    --accent: #0f766e;
    --accent-2: #115e59;
    --accent-soft: #ccfbf1;
    --warn: #b45309;
    --warn-soft: #fef3c7;
    --danger: #b91c1c;
    --shadow: 0 1px 2px rgba(16, 24, 40, .04), 0 8px 24px rgba(16, 24, 40, .04);
    --radius: 14px;
    --font: "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0f1419;
      --surface: #171d24;
      --surface-2: #1e262e;
      --border: #2a3440;
      --text: #eef2f6;
      --muted: #9aa6b2;
      --accent: #2dd4bf;
      --accent-2: #5eead4;
      --accent-soft: #134e4a;
      --warn: #fbbf24;
      --warn-soft: #422006;
      --danger: #f87171;
      --shadow: 0 1px 2px rgba(0,0,0,.35);
    }
  }
  :root[data-theme="dark"] {
    --bg: #0f1419;
    --surface: #171d24;
    --surface-2: #1e262e;
    --border: #2a3440;
    --text: #eef2f6;
    --muted: #9aa6b2;
    --accent: #2dd4bf;
    --accent-2: #5eead4;
    --accent-soft: #134e4a;
    --warn: #fbbf24;
    --warn-soft: #422006;
    --danger: #f87171;
    --shadow: 0 1px 2px rgba(0,0,0,.35);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    font-family: var(--font);
    background:
      radial-gradient(1200px 480px at 10% -10%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 50%),
      var(--bg);
    color: var(--text);
    line-height: 1.5;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 64px; }
  .top {
    display: flex; justify-content: space-between; gap: 16px; align-items: flex-end;
    margin-bottom: 20px; flex-wrap: wrap;
  }
  .brand { display: flex; flex-direction: column; gap: 4px; }
  .eyebrow {
    font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--accent-2); font-weight: 650;
  }
  h1 { margin: 0; font-size: 26px; letter-spacing: -.03em; }
  .sub { color: var(--muted); font-size: 13px; }
  .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  label.field {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--muted); background: var(--surface);
    border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px;
  }
  input, button, select {
    font: inherit; color: var(--text);
  }
  input[type="date"], input[type="password"] {
    background: transparent; border: 0; padding: 0; min-width: 9.5rem;
  }
  .btn, .chip {
    border: 1px solid var(--border); background: var(--surface); color: var(--text);
    border-radius: 10px; padding: 7px 12px; cursor: pointer; font-size: 13px;
  }
  .btn.primary {
    background: var(--accent); border-color: transparent; color: #fff; font-weight: 650;
  }
  :root[data-theme="dark"] .btn.primary { color: #042f2e; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .btn.primary { color: #042f2e; }
  }
  .btn:hover, .chip:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
  .chip.active { background: var(--accent-soft); border-color: transparent; color: var(--accent-2); font-weight: 650; }
  .ghost { color: var(--muted); }
  .status { font-size: 13px; color: var(--muted); min-height: 1.2em; }
  .err { color: var(--danger); }
  .gate {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 18px; margin-bottom: 18px; display: none;
  }
  .gate h2 { margin: 0 0 6px; font-size: 16px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 16px 18px;
  }
  .kpi .label { font-size: 12px; color: var(--muted); }
  .kpi .value { font-size: 28px; font-weight: 700; letter-spacing: -.04em; font-variant-numeric: tabular-nums; margin-top: 4px; }
  .kpi .hint { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .grid-2 { display: grid; grid-template-columns: 1.4fr .8fr; gap: 12px; margin-bottom: 16px; }
  .section-title { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  .section-title h2 { margin: 0; font-size: 15px; }
  .bars { display: flex; align-items: flex-end; gap: 6px; height: 148px; padding-top: 8px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; min-width: 0; }
  .bar {
    width: 100%; max-width: 28px; border-radius: 6px 6px 2px 2px;
    background: linear-gradient(180deg, var(--accent-2), var(--accent));
    min-height: 2px;
  }
  .bar-col span { font-size: 10px; color: var(--muted); margin-top: 6px; white-space: nowrap; }
  .dist { display: flex; flex-direction: column; gap: 8px; }
  .dist-row { display: grid; grid-template-columns: minmax(0, 108px) 1fr 52px; gap: 8px; align-items: center; font-size: 13px; }
  .dist-row > div:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { height: 8px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
  .fill { height: 100%; background: var(--accent); border-radius: 99px; }
  .num { font-variant-numeric: tabular-nums; text-align: right; }
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 13px; }
  th { color: var(--muted); font-weight: 600; font-size: 12px; }
  tbody tr:hover { background: var(--surface-2); }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: var(--muted); }
  .badge {
    display: inline-flex; align-items: center; border-radius: 999px; padding: 1px 8px;
    font-size: 11px; font-weight: 650;
  }
  .badge.warn { background: var(--warn-soft); color: var(--warn); }
  .badge.muted { background: var(--surface-2); color: var(--muted); }
  .desc { color: var(--muted); font-size: 12px; max-width: 36rem; }
  details.glossary { margin-top: 16px; }
  details.glossary > summary { cursor: pointer; font-weight: 650; }
  .glossary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
  .glossary-mod h3 { margin: 0 0 6px; font-size: 13px; }
  .glossary-mod p { margin: 0 0 8px; font-size: 12px; color: var(--muted); }
  .glossary-mod ul { margin: 0; padding-left: 1.1rem; }
  .glossary-mod li { font-size: 12px; margin: 0 0 6px; }
  .empty { color: var(--muted); padding: 28px 8px; text-align: center; }
  @media (max-width: 900px) {
    .kpis, .grid-2, .glossary-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand">
      <div class="eyebrow">Internal · Anonymous</div>
      <h1>DPP 使用洞察</h1>
      <div class="sub">匿名聚合统计，供运营核对功能使用量。不含 URL、对话、凭据或个人身份。</div>
    </div>
    <div class="controls">
      <button class="chip" data-range="7" type="button">近 7 天</button>
      <button class="chip" data-range="14" type="button">近 14 天</button>
      <button class="chip" data-range="30" type="button">近 30 天</button>
      <label class="field">从 <input type="date" id="from" /></label>
      <label class="field">到 <input type="date" id="to" /></label>
      <button class="btn primary" id="load" type="button">查询</button>
      <button class="btn ghost" id="theme" type="button">外观</button>
    </div>
  </header>
  <div class="gate" id="token-box">
    <h2>输入管理令牌</h2>
    <p class="sub">令牌只存在于本页会话，不会写入地址栏。</p>
    <div class="controls" style="margin-top:12px">
      <label class="field">令牌 <input type="password" id="token" autocomplete="off" /></label>
      <button class="btn primary" id="save-token" type="button">进入看板</button>
    </div>
  </div>
  <div class="status" id="status"></div>
  <div id="out"></div>
</div>
<script>
const CATALOG = ${catalogJson};
const TOKEN_KEY = 'dpp_stats_admin_token';
const THEME_KEY = 'dpp_stats_theme';
const statusEl = document.getElementById('status');
const outEl = document.getElementById('out');
const tokenBox = document.getElementById('token-box');

function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
function fmt(n) { return Number(n || 0).toLocaleString('zh-CN'); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function iso(d) { return d.toISOString().slice(0, 10); }
function moduleLabel(mod) { return (CATALOG[mod] && CATALOG[mod].label) || mod; }
function actionMeta(mod, action) {
  const entry = CATALOG[mod] && CATALOG[mod].actions[action];
  return entry || { label: action, description: '词典中尚未登记，请核对埋点是否新增。', unknown: true };
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

applyTheme(sessionStorage.getItem(THEME_KEY) || '');
document.getElementById('theme').addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : current === 'light' ? '' : 'dark';
  if (next) sessionStorage.setItem(THEME_KEY, next); else sessionStorage.removeItem(THEME_KEY);
  applyTheme(next);
});

function showTokenBox(message) {
  tokenBox.style.display = 'block';
  statusEl.innerHTML = '<span class="err">' + esc(message) + '</span>';
}

document.getElementById('save-token').addEventListener('click', () => {
  const value = document.getElementById('token').value.trim();
  if (!value) return;
  sessionStorage.setItem(TOKEN_KEY, value);
  tokenBox.style.display = 'none';
  statusEl.textContent = '';
  load();
});

function setRange(days) {
  const to = new Date();
  const from = new Date(Date.now() - (days - 1) * 86400000);
  document.getElementById('from').value = iso(from);
  document.getElementById('to').value = iso(to);
  document.querySelectorAll('[data-range]').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.range) === days);
  });
}

document.querySelectorAll('[data-range]').forEach((el) => {
  el.addEventListener('click', () => { setRange(Number(el.dataset.range)); load(); });
});

function fillDays(from, to, dau) {
  const map = Object.fromEntries(dau.map((d) => [d.day, Number(d.devices)]));
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const rows = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const day = iso(new Date(t));
    rows.push({ day, devices: map[day] || 0 });
  }
  return rows;
}

function formatDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (s < 60) return s + ' 秒';
  if (s < 3600) return (s / 60).toFixed(1) + ' 分钟';
  return (s / 3600).toFixed(1) + ' 小时';
}

function formatValue(mod, action, totalValue) {
  const n = Number(totalValue) || 0;
  if (!n) return '—';
  const meta = actionMeta(mod, action);
  if (action === 'feature_closed') return formatDuration(n);
  if (meta.valueHint) return fmt(n);
  return fmt(n);
}

function summarizeActions(byAction) {
  const map = new Map();
  for (const row of byAction) {
    const key = row.module + '\\0' + row.action;
    const current = map.get(key) || { module: row.module, action: row.action, count: 0, totalValue: 0 };
    current.count += Number(row.count) || 0;
    current.totalValue += Number(row.totalValue) || 0;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function renderKpis(data, days) {
  const overview = data.overview || { events: 0, devices: 0 };
  const avg = days.length ? (days.reduce((s, d) => s + d.devices, 0) / days.length) : 0;
  const top = (data.byModule || [])[0];
  return '<div class="kpis">' +
    kpi('活跃设备', fmt(overview.devices), '区间内去重匿名实例') +
    kpi('事件总数', fmt(overview.events), '所有模块动作合计') +
    kpi('日均活跃', avg.toFixed(1), '含无上报日') +
    kpi('最热模块', top ? esc(moduleLabel(top.module)) : '—', top ? fmt(top.count) + ' 次事件' : '所选区间暂无数据') +
  '</div>';
}

function kpi(label, value, hint) {
  return '<article class="card kpi"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div><div class="hint">' + esc(hint) + '</div></article>';
}

function renderDau(days) {
  const max = Math.max(1, ...days.map((d) => d.devices));
  const step = days.length > 20 ? 5 : days.length > 12 ? 2 : 1;
  const cols = days.map((d, i) => {
    const h = Math.max(2, Math.round((d.devices / max) * 128));
    const show = i === 0 || i === days.length - 1 || i % step === 0;
    const label = show ? d.day.slice(5) : '';
    return '<div class="bar-col" title="' + esc(d.day + ' · ' + d.devices + ' 台') + '"><div class="bar" style="height:' + (d.devices ? h : 2) + 'px;opacity:' + (d.devices ? 1 : .28) + '"></div><span>' + esc(label) + '</span></div>';
  }).join('');
  return '<section class="card"><div class="section-title"><h2>日活跃设备</h2><span class="sub">按匿名实例去重</span></div><div class="bars">' + (days.length ? cols : '<div class="empty">暂无数据</div>') + '</div></section>';
}

function renderDist(title, rows, nameKey, valueKey) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));
  const body = rows.length ? rows.map((r) => {
    const name = nameKey === 'module' ? moduleLabel(r.module) : r[nameKey];
    const n = Number(r[valueKey]) || 0;
    const width = Math.round((n / max) * 100);
    return '<div class="dist-row"><div>' + esc(name) + '</div><div class="track"><div class="fill" style="width:' + width + '%"></div></div><div class="num">' + fmt(n) + '</div></div>';
  }).join('') : '<div class="empty">暂无数据</div>';
  return '<section class="card"><div class="section-title"><h2>' + esc(title) + '</h2></div><div class="dist">' + body + '</div></section>';
}

function actionRowsHtml(rows, total, showDay) {
  if (!rows.length) return '<div class="empty">所选条件没有动作数据。</div>';
  const head = '<thead><tr>' +
    (showDay ? '<th>日期</th>' : '') +
    '<th>模块</th><th>动作</th><th>含义</th><th class="num">次数</th><th class="num">占比</th><th class="num">累计值</th></tr></thead>';
  const body = rows.map((r) => {
    const meta = actionMeta(r.module, r.action);
    const badge = meta.unknown ? ' <span class="badge warn">未登记</span>' : '';
    const share = total ? ((r.count / total) * 100).toFixed(1) + '%' : '—';
    return '<tr>' +
      (showDay ? '<td class="code">' + esc(r.day) + '</td>' : '') +
      '<td>' + esc(moduleLabel(r.module)) + '<div class="code">' + esc(r.module) + '</div></td>' +
      '<td><strong>' + esc(meta.label) + '</strong>' + badge + '<div class="code">' + esc(r.action) + '</div></td>' +
      '<td class="desc">' + esc(meta.description) + (meta.valueHint ? '<div class="code">累计值：' + esc(meta.valueHint) + '</div>' : '') + '</td>' +
      '<td class="num">' + fmt(r.count) + '</td>' +
      '<td class="num">' + share + '</td>' +
      '<td class="num">' + esc(formatValue(r.module, r.action, r.totalValue)) + '</td></tr>';
  }).join('');
  return '<table>' + head + '<tbody>' + body + '</tbody></table>';
}

function renderGlossary() {
  const cards = Object.entries(CATALOG).map(([id, mod]) => {
    const items = Object.entries(mod.actions).map(([action, meta]) => {
      const mark = meta.unwired ? ' <span class="badge muted">未接入</span>' : '';
      return '<li><strong>' + esc(meta.label) + '</strong> <span class="code">' + esc(action) + '</span>' + mark +
        '<div class="desc">' + esc(meta.description) + (meta.valueHint ? ' 累计值：' + esc(meta.valueHint) + '。' : '') + '</div></li>';
    }).join('');
    return '<article class="card glossary-mod"><h3>' + esc(mod.label) + ' <span class="code">' + esc(id) + '</span></h3><p>' + esc(mod.description) + '</p><ul>' + items + '</ul></article>';
  }).join('');
  return '<details class="glossary" open><summary>动作词典 · 口径说明</summary><div class="glossary-grid">' + cards + '</div></details>';
}

let lastData = null;
let viewMode = 'summary';
let moduleFilter = '';

function renderActions(data) {
  const all = data.byAction || [];
  const filtered = moduleFilter ? all.filter((r) => r.module === moduleFilter) : all;
  const rows = viewMode === 'daily' ? filtered.slice().sort((a, b) => b.count - a.count || a.day.localeCompare(b.day)) : summarizeActions(filtered);
  const total = rows.reduce((s, r) => s + Number(r.count), 0);
  const modules = [...new Set((data.byModule || []).map((m) => m.module))];
  const chips = ['<button class="chip' + (moduleFilter === '' ? ' active' : '') + '" data-mod="" type="button">全部模块</button>']
    .concat(modules.map((mod) => '<button class="chip' + (moduleFilter === mod ? ' active' : '') + '" data-mod="' + esc(mod) + '" type="button">' + esc(moduleLabel(mod)) + '</button>'))
    .join('');
  return '<section class="card">' +
    '<div class="section-title"><h2>动作明细</h2><span class="sub">中文名称是运营口径，英文是上报原值</span></div>' +
    '<div class="toolbar">' +
      '<button class="chip' + (viewMode === 'summary' ? ' active' : '') + '" data-mode="summary" type="button">区间汇总</button>' +
      '<button class="chip' + (viewMode === 'daily' ? ' active' : '') + '" data-mode="daily" type="button">按日明细</button>' +
      chips +
    '</div>' +
    actionRowsHtml(rows, total, viewMode === 'daily') +
  '</section>';
}

function bindActionToolbar() {
  outEl.querySelectorAll('[data-mode]').forEach((el) => {
    el.addEventListener('click', () => { viewMode = el.dataset.mode; paint(); });
  });
  outEl.querySelectorAll('[data-mod]').forEach((el) => {
    el.addEventListener('click', () => { moduleFilter = el.dataset.mod; paint(); });
  });
}

function paint() {
  if (!lastData) return;
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const days = fillDays(from, to, lastData.dau || []);
  const versions = (lastData.versions || []).map((v) => ({ version: v.version, devices: v.devices }));
  const browsers = (lastData.browsers || []).map((b) => ({ browser: b.browser, devices: b.devices }));
  outEl.innerHTML =
    renderKpis(lastData, days) +
    '<div class="grid-2">' + renderDau(days) + renderDist('模块分布', lastData.byModule || [], 'module', 'count') + '</div>' +
    '<div class="grid-2">' + renderDist('扩展版本', versions, 'version', 'devices') + renderDist('浏览器', browsers, 'browser', 'devices') + '</div>' +
    renderActions(lastData) +
    renderGlossary();
  bindActionToolbar();
}

async function load() {
  const token = getToken();
  if (!token) { showTokenBox('请输入管理令牌后查看数据'); return; }
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  statusEl.textContent = '正在拉取聚合数据…';
  try {
    const res = await fetch('/api/stats/summary?from=' + from + '&to=' + to, {
      headers: { 'X-Stats-Admin-Token': token },
    });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      document.getElementById('token').value = '';
      lastData = null;
      outEl.innerHTML = '';
      showTokenBox('令牌无效，请重新输入');
      return;
    }
    if (!res.ok) { statusEl.innerHTML = '<span class="err">查询失败: HTTP ' + res.status + '</span>'; return; }
    lastData = await res.json();
    statusEl.textContent = from + ' 至 ' + to;
    paint();
  } catch (e) {
    statusEl.innerHTML = '<span class="err">查询失败: ' + esc(e.message || e) + '</span>';
  }
}

setRange(14);
document.getElementById('load').addEventListener('click', load);
load();
</script>
</body>
</html>`;
}
