// =============================================================================
// 中粮糖业 600737 辅助决策 Dashboard 生成器
// 用法: node generate_dashboard.js   → 生成 dashboard.html（用浏览器打开）
// =============================================================================
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'dashboard.html');

// ===================== 数据加载 =====================
function readLines(f) { return fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n'); }

function loadSR() {
  const l = readLines('SR0_daily.csv').slice(1);
  return l.map(x => { const p = x.split(','); return { date: p[0], close: +p[4], open: +p[1], high: +p[2], low: +p[3], volume: +p[5] }; });
}
function loadST() {
  const l = readLines('600737_daily.csv').slice(1);
  return l.map(x => { const p = x.split(','); return { date: p[0], close: +p[2], open: +p[1], high: +p[3], low: +p[4], volume: +p[5] }; });
}
function loadICE() {
  const p = path.join(DATA, 'ICE_sugar_daily.csv');
  if (!fs.existsSync(p)) return [];
  const l = fs.readFileSync(p, 'utf8').trim().split('\n').slice(1);
  return l.map(x => { const c = x.split(','); const close = +c[2]; return { date: c[0], close }; }).filter(x => x.close > 0);
}
function loadONI() {
  const l = readLines('ONI_enso.txt');
  return l.filter(x => x.trim() && !/^\s*SEAS/.test(x)).map(x => { const p = x.trim().split(/\s+/); return { seas: p[0], year: +p[1], anom: +p[3] }; });
}
function loadFX() {
  const p = path.join(DATA, 'fx_usdcny.json');
  if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')).usdcny; } catch (e) {} }
  return 7.0;
}

// ===================== 工具函数 =====================
function ma(vals, n) {
  const out = new Array(vals.length).fill(null);
  let s = 0;
  for (let i = 0; i < vals.length; i++) { s += vals[i]; if (i >= n) s -= vals[i - n]; if (i >= n - 1) out[i] = s / n; }
  return out;
}
function pearson(x, y) {
  const pairs = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] != null && y[i] != null) pairs.push([x[i], y[i]]);
  if (pairs.length < 3) return null;
  const n = pairs.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [a, b] of pairs) { sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  return den === 0 ? null : num / den;
}
function monthlyResample(daily) {
  const map = new Map();
  for (const d of daily) map.set(d.date.slice(0, 7), d.close); // 月内最后收盘
  return Array.from(map.entries()).map(([ym, close]) => ({ ym, close })).sort((a, b) => a.ym < b.ym ? -1 : 1);
}
const ONI_MONTH = { DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6, JJA: 7, JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12 };
function oniToMonthly(oni) {
  return oni.map(o => ({ ym: `${o.year}-${String(ONI_MONTH[o.seas]).padStart(2, '0')}`, anom: o.anom })).sort((a, b) => a.ym < b.ym ? -1 : 1);
}
function monthIndex(ym) { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); }
function ymFromIndex(i) { const y = Math.floor(i / 12), m = i % 12 + 1; return `${y}-${String(m).padStart(2, '0')}`; }

// 对齐两个月度序列到共同月份网格，返回连续数组（缺省为 null）
function alignMonthly(a, b) {
  const mapA = new Map(a.map(x => [x.ym, x]));
  const mapB = new Map(b.map(x => [x.ym, x]));
  const all = [...a, ...b];
  const min = Math.min(...all.map(x => monthIndex(x.ym)));
  const max = Math.max(...all.map(x => monthIndex(x.ym)));
  const grid = [], va = [], vb = [];
  for (let i = min; i <= max; i++) {
    const ym = ymFromIndex(i);
    grid.push(ym);
    va.push(mapA.has(ym) ? mapA.get(ym).close ?? mapA.get(ym).anom : null);
    vb.push(mapB.has(ym) ? mapB.get(ym).close ?? mapB.get(ym).anom : null);
  }
  return { grid, va, vb };
}

// ===================== 主计算 =====================
const sr = loadSR();
const st = loadST();
const ice = loadICE();
const oni = loadONI();
const fx = loadFX();

const CONFIG = { cost: 13.3, sugarConfirm: 5688, sugarFalsify: 5053, stopLossHalf: 12.64, stopLossFull: 12.24, importTariff: 1.5, sugarYield: 0.92, importFee: 550 };

// 最新值
const srLast = sr[sr.length - 1];
const stLast = st[st.length - 1];
const iceLast = ice[ice.length - 1];
const oniLast = oni[oni.length - 1];

// 进口利润
const importCost = ice.length ? iceLast.close * 22.0462 * fx * CONFIG.importTariff / CONFIG.sugarYield + CONFIG.importFee : null;
const importMargin = importCost ? (srLast.close - importCost) / importCost : null;

// 利润率历史 + 250日 z-score
const srMapImp = new Map(sr.map(x => [x.date, x.close]));
const marginHist = [];
for (const it of ice) {
  if (!srMapImp.has(it.date)) continue;
  const cost = it.close * 22.0462 * fx * CONFIG.importTariff / CONFIG.sugarYield + CONFIG.importFee;
  marginHist.push({ date: it.date, cost, margin: (srMapImp.get(it.date) - cost) / cost });
}
let importZscore = null;
const marginZseries = [];
if (marginHist.length >= 250) {
  for (let i = 249; i < marginHist.length; i++) {
    const seg = marginHist.slice(i - 249, i + 1).map(x => x.margin);
    const mean = seg.reduce((a, b) => a + b, 0) / 250;
    const std = Math.sqrt(seg.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 250);
    marginZseries.push({ date: marginHist[i].date, z: std === 0 ? 0 : +((marginHist[i].margin - mean) / std).toFixed(2) });
  }
  importZscore = marginZseries[marginZseries.length - 1].z;
}

// 月度序列
const srM = monthlyResample(sr);
const stM = monthlyResample(st);
const iceM = monthlyResample(ice);
const oniM = oniToMonthly(oni);

// 相关性：郑糖 vs 600737（同期）
const alignedST = alignMonthly(srM.map(x => ({ ym: x.ym, close: x.close })), stM);
const corrSR_ST = pearson(alignedST.va, alignedST.vb);

// 相关性：郑糖 vs ICE（同期）
let corrSR_ICE = null;
if (iceM.length >= 6) { const a = alignMonthly(srM, iceM); corrSR_ICE = pearson(a.va, a.vb); }

// ONI → 郑糖 滞后相关（核心分析）
const oniForCorr = oniM.map(x => ({ ym: x.ym, close: x.anom }));
const srForCorr = srM.map(x => ({ ym: x.ym, close: x.close }));
const al = alignMonthly(oniForCorr, srForCorr);
const oniArr = al.va, srArr = al.vb; // 连续数组，缺省null
const lags = [];
let maxLag = 0, maxLagVal = -2;
for (let k = 0; k <= 12; k++) {
  const x = oniArr.slice(0, oniArr.length - k);
  const y = srArr.slice(k);
  const c = pearson(x, y);
  lags.push({ lag: k, corr: c });
  if (c != null && c > maxLagVal) { maxLagVal = c; maxLag = k; }
}

// ONI → ICE 滞后相关（数据不足时跳过）
let iceLagNote = null;

// 郑糖 vs 600737 散点（月度）
const scatterSR_ST = [];
for (let i = 0; i < alignedST.grid.length; i++) if (alignedST.va[i] != null && alignedST.vb[i] != null) scatterSR_ST.push([alignedST.va[i], alignedST.vb[i]]);

// 散点回归线
function linreg(points) {
  const n = points.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const [x, y] of points) { sx += x; sy += y; sxy += x * y; sxx += x * x; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const xs = points.map(p => p[0]);
  return { slope, intercept, xmin: Math.min(...xs), xmax: Math.max(...xs) };
}
const reg = scatterSR_ST.length > 3 ? linreg(scatterSR_ST) : null;

// 郑糖 vs 股价 12个月滚动相关（展示相关性如何随时间变化）
const rollingCorr = [];
{
  const win = 12;
  for (let i = 0; i < alignedST.grid.length; i++) {
    if (alignedST.va[i] == null || alignedST.vb[i] == null) continue;
    const start = Math.max(0, i - win + 1);
    const x = alignedST.va.slice(start, i + 1), y = alignedST.vb.slice(start, i + 1);
    rollingCorr.push([alignedST.grid[i], pearson(x, y)]);
  }
}

// 郑糖20年分位
const srCloseAll = sr.map(x => x.close).sort((a, b) => a - b);
const srPct = srCloseAll.filter(v => v <= srLast.close).length / srCloseAll.length * 100;
const srAllHigh = srCloseAll[srCloseAll.length - 1], srAllLow = srCloseAll[0];

// 厄尔尼诺区间（用于20年图着色）
const elNinoPeriods = [];
{
  let start = null;
  for (const o of oniM) {
    if (o.anom >= 0.5 && !start) start = o.ym;
    if (o.anom < 0.5 && start) { elNinoPeriods.push([start, o.ym]); start = null; }
  }
  if (start) elNinoPeriods.push([start, oniM[oniM.length - 1].ym]);
}

// 近N日序列
function recent(arr, n) { return arr.slice(-n); }
const sr250 = recent(sr, 250);
const st250 = recent(st, 250);
const srMA20 = ma(sr250.map(x => x.close), 20), srMA60 = ma(sr250.map(x => x.close), 60);
const stMA20 = ma(st250.map(x => x.close), 20), stMA60 = ma(st250.map(x => x.close), 60);

// ===== P0 补丁：量仓结构 + 统计因子 =====
// 量价四象限（近20日：增仓涨/减仓涨/增仓跌/减仓跌）
function classifyVP(arr) {
  const c = { upPos: 0, upNeg: 0, downPos: 0, downNeg: 0 };
  for (let i = 1; i < arr.length; i++) {
    const pu = arr[i].close > arr[i - 1].close;
    const ou = arr[i].position > arr[i - 1].position;
    if (pu && ou) c.upPos++; else if (pu) c.upNeg++; else if (ou) c.downPos++; else c.downNeg++;
  }
  return c;
}
const srQuad = classifyVP(recent(sr, 21));

// 郑糖量仓数据（近250日，含成交量/持仓量）
const srVolPos = sr250.map((x, i) => ({ d: x.date, c: x.close, v: x.volume, p: x.position, m20: srMA20[i], m60: srMA60[i] }));
const posChg = sr250.map((x, i) => i < 5 ? null : +((x.position - sr250[i - 5].position) / sr250[i - 5].position * 100).toFixed(1));

// z-score（价 vs MA250 标准差）
function zscore(vals, win) {
  const out = new Array(vals.length).fill(null);
  for (let i = win - 1; i < vals.length; i++) {
    const seg = vals.slice(i - win + 1, i + 1);
    const mean = seg.reduce((a, b) => a + b, 0) / win;
    const std = Math.sqrt(seg.reduce((a, b) => a + (b - mean) * (b - mean), 0) / win);
    out[i] = std === 0 ? 0 : (vals[i] - mean) / std;
  }
  return out;
}
const srZ = zscore(sr.map(x => x.close), 250);
const srZseries = sr.map((x, i) => ({ d: x.date, z: srZ[i] == null ? null : +srZ[i].toFixed(2) })).filter(x => x.z != null).slice(-250);

// 波动率（20日年化，%）
function vol20(arr) {
  const out = new Array(arr.length).fill(null);
  for (let i = 20; i < arr.length; i++) {
    let s = 0;
    for (let j = i - 19; j <= i; j++) s += Math.log(arr[j].close / arr[j - 1].close);
    const mean = s / 20;
    let v = 0;
    for (let j = i - 19; j <= i; j++) { const r = Math.log(arr[j].close / arr[j - 1].close) - mean; v += r * r; }
    out[i] = Math.sqrt(v / 20) * Math.sqrt(252) * 100;
  }
  return out;
}
const srVolFull = vol20(sr);
const srVolSeries = sr.slice(-250).map((x, i) => ({ d: x.date, v: srVolFull[sr.length - 250 + i] == null ? null : +srVolFull[sr.length - 250 + i].toFixed(1) }));

// 多周期分位
function pctIn(arr, days, val) {
  const seg = arr.slice(-days).map(x => x.close).sort((a, b) => a - b);
  return seg.filter(v => v <= val).length / seg.length * 100;
}
const srPct1y = +pctIn(sr, 250, srLast.close).toFixed(1);
const srPct3y = +pctIn(sr, 750, srLast.close).toFixed(1);
const srPct5y = +pctIn(sr, 1250, srLast.close).toFixed(1);

// 反转概率历史（读 history.csv 全量）
let probHist = [];
try {
  const hp = path.join(ROOT, 'reports', 'history.csv');
  if (fs.existsSync(hp)) {
    const rows = fs.readFileSync(hp, 'utf8').trim().split('\n');
    const h = rows[0].split(',');
    const iD = h.indexOf('date'), iP = h.indexOf('reversal_prob'), iE = h.indexOf('enso_score'), iS = h.indexOf('sugar_score'), iSt = h.indexOf('stock_score'), iIm = h.indexOf('import_score');
    for (let i = 1; i < rows.length; i++) {
      const p = rows[i].split(',');
      const o = { date: p[iD], prob: +p[iP], enso: +p[iE], sugar: +p[iS], stock: +p[iSt] };
      if (iIm >= 0) o.imp = p[iIm] === '' ? null : +p[iIm];
      probHist.push(o);
    }
  }
} catch (e) {}

// 反转概率（读最新 history.csv）
let reversalProb = null, reversalSignal = '';
try {
  const hp = path.join(ROOT, 'reports', 'history.csv');
  if (fs.existsSync(hp)) {
    const rows = fs.readFileSync(hp, 'utf8').trim().split('\n');
    if (rows.length > 1) {
      const last = rows[rows.length - 1].split(',');
      const idx = rows[0].split(',').indexOf('reversal_prob');
      const idxSig = rows[0].split(',').indexOf('signal');
      reversalProb = +last[idx]; reversalSignal = last[idxSig];
    }
  }
} catch (e) {}

// ===================== 数据打包给前端 =====================
const chartData = {
  sr20y: srM.map(x => [x.ym, x.close]),
  elNino: elNinoPeriods,
  confirmLevel: CONFIG.sugarConfirm, falsifyLevel: CONFIG.sugarFalsify,
  srDaily: sr250.map((x, i) => ({ d: x.date, c: x.close, m20: srMA20[i], m60: srMA60[i] })),
  stDaily: st250.map((x, i) => ({ d: x.date, c: x.close, v: x.volume, m20: stMA20[i], m60: stMA60[i] })),
  stCost: CONFIG.cost, stStopFull: CONFIG.stopLossFull,
  oniBar: oniM.filter(x => x.ym >= '2005-01').map(x => [x.ym, x.anom]),
  oniLast: oniLast,
  lagChart: lags.map(x => x.corr == null ? null : +x.corr.toFixed(3)),
  maxLag: maxLag, maxLagVal: maxLagVal == null ? null : +maxLagVal.toFixed(3),
  scatterSR_ST: scatterSR_ST,
  regLine: reg,
  corrSR_ST: corrSR_ST == null ? null : +corrSR_ST.toFixed(3),
  corrSR_ICE: corrSR_ICE == null ? null : +corrSR_ICE.toFixed(3),
  iceDaily: ice.map(x => [x.date, x.close]),
  importCost: importCost ? +importCost.toFixed(0) : null,
  importMargin: importMargin ? +(importMargin * 100).toFixed(1) : null,
  marginHist: marginHist.map(x => [x.date, +(x.margin * 100).toFixed(1)]),
  marginZseries: marginZseries,
  rollingCorr: rollingCorr,
  // P0 新增
  srVolPos: srVolPos, srQuad: srQuad, posChg: posChg,
  srZseries: srZseries, srVolSeries: srVolSeries,
  pctMulti: { pct1y: srPct1y, pct3y: srPct3y, pct5y: srPct5y, pct20y: +srPct.toFixed(1) },
  probHist: probHist
};

// ENSO 因子（与 monitor.js 一致的状态打分）
const oniPrev3 = oni[oni.length - 4];
const warmingRate = oniPrev3 ? +(oniLast.anom - oniPrev3.anom).toFixed(2) : 0;
const ensoScore = oniLast.anom >= 1.0 ? 80 : (oniLast.anom >= 0.5 ? 72 : (oniLast.anom >= 0.3 ? 58 : (oniLast.anom >= -0.3 ? 50 : (oniLast.anom >= -0.5 ? 42 : 25))));

const kpi = {
  srClose: srLast.close, srDate: srLast.date, srPct: +srPct.toFixed(1), srAllHigh: srAllHigh, srAllLow: srAllLow,
  stClose: stLast.close, stDate: stLast.date, stPnl: +((stLast.close - CONFIG.cost) / CONFIG.cost * 100).toFixed(1), stCost: CONFIG.cost,
  iceClose: iceLast ? iceLast.close : null, fx: fx,
  importCost: importCost ? +importCost.toFixed(0) : null, importMargin: importMargin ? +(importMargin * 100).toFixed(1) : null, importZscore: importZscore,
  oniVal: oniLast.anom, oniTag: oniLast.anom >= 0.5 ? '厄尔尼诺' : (oniLast.anom <= -0.5 ? '拉尼娜' : '中性'),
  oniWarming: warmingRate, ensoScore: ensoScore,
  reversalProb: reversalProb, reversalSignal: reversalSignal,
  maxLag: maxLag, maxLagVal: maxLagVal == null ? null : +maxLagVal.toFixed(3)
};

// ===================== HTML 模板 =====================
const hasLocalEcharts = fs.existsSync(path.join(ROOT, 'lib', 'echarts.min.js'));
const echartsSrc = hasLocalEcharts ? 'lib/echarts.min.js' : 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>中粮糖业 600737 辅助决策 Dashboard</title>
<script src="${echartsSrc}"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Microsoft YaHei", "PingFang SC", sans-serif; background: #f5f7fa; color: #1f2937; padding: 16px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .kpi { background: #fff; border-radius: 10px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .kpi .label { font-size: 12px; color: #6b7280; }
  .kpi .val { font-size: 20px; font-weight: 600; margin: 4px 0 2px; }
  .kpi .note { font-size: 11px; color: #9ca3af; }
  .up { color: #dc2626; } .down { color: #16a34a; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 14px; }
  .card { background: #fff; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card h3 { font-size: 14px; margin-bottom: 8px; color: #374151; }
  .chart { width: 100%; height: 300px; }
  .wide { grid-column: 1 / -1; }
  .wide .chart { height: 360px; }
  table.corr { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.corr th, table.corr td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: center; }
  table.corr th { background: #f9fafb; font-weight: 600; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  .tag.red { background: #fee2e2; color: #b91c1c; } .tag.blue { background: #dbeafe; color: #1d4ed8; } .tag.gray { background: #e5e7eb; color: #4b5563; }
  .tag.green { background: #dcfce7; color: #15803d; } .tag.yellow { background: #fef9c3; color: #a16207; }
  .reasoning { margin-top: 10px; padding: 9px 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; color: #4b5563; font-size: 12px; line-height: 1.6; }
  .reasoning summary { cursor: pointer; color: #374151; font-weight: 600; }
  .reasoning summary:hover { color: #111827; }
  .reasoning ul { margin: 6px 0 0 18px; }
  .reasoning li { margin: 2px 0; }
  .formula { margin-top: 6px; padding: 6px 8px; border-radius: 6px; background: #eef2ff; color: #3730a3; font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; }
</style>
</head>
<body>
<h1>中粮糖业 600737 · 糖周期辅助决策 Dashboard</h1>
<div class="sub">数据日期 ${srLast.date} ｜ 生成时间 ${new Date().toISOString().slice(0, 10)} ｜ 反转概率模型 + 相关性分析</div>

<div class="kpis">
  <div class="kpi"><div class="label">反转概率</div><div class="val">${kpi.reversalProb != null ? kpi.reversalProb.toFixed(1) + '%' : '—'}</div><div class="note">${kpi.reversalSignal || '待 monitor.js 生成'}</div></div>
  <div class="kpi"><div class="label">郑糖主力</div><div class="val">${kpi.srClose.toFixed(0)}</div><div class="note">历史分位 ${kpi.srPct}%（区间 ${kpi.srAllLow}~${kpi.srAllHigh}）</div></div>
  <div class="kpi"><div class="label">中粮糖业</div><div class="val">${kpi.stClose.toFixed(2)}</div><div class="note ${kpi.stPnl >= 0 ? 'up' : 'down'}">盈亏 ${kpi.stPnl >= 0 ? '+' : ''}${kpi.stPnl}%（成本 ${kpi.stCost}）</div></div>
  <div class="kpi"><div class="label">ICE 原糖</div><div class="val">${kpi.iceClose != null ? kpi.iceClose.toFixed(2) : '—'}</div><div class="note">美分/磅 ｜ 汇率 ${kpi.fx.toFixed(2)}</div></div>
  <div class="kpi"><div class="label">进口利润率</div><div class="val">${kpi.importMargin != null ? (kpi.importMargin >= 0 ? '+' : '') + kpi.importMargin + '%' : '—'}</div><div class="note">z-score ${kpi.importZscore != null ? (kpi.importZscore >= 0 ? '+' : '') + kpi.importZscore : '—'}｜${kpi.importZscore != null && kpi.importZscore < -1.5 ? '极低→偏多' : (kpi.importZscore > 1.5 ? '极高→偏空' : '中性')}</div></div>
  <div class="kpi"><div class="label">厄尔尼诺 ONI</div><div class="val">${kpi.oniVal >= 0 ? '+' : ''}${kpi.oniVal.toFixed(2)}</div><div class="note"><span class="tag ${kpi.oniTag === '厄尔尼诺' ? 'red' : (kpi.oniTag === '拉尼娜' ? 'blue' : 'gray')}">${kpi.oniTag}</span> 暖化${kpi.oniWarming >= 0 ? '+' : ''}${kpi.oniWarming}｜因子${kpi.ensoScore}分</div></div>
</div>

<div class="grid">
  <div class="card wide"><h3>郑糖主力 20 年周期（月线，红色阴影=厄尔尼诺期）</h3><div id="c1" class="chart"></div></div>

  <div class="card wide"><h3>郑糖量仓结构（价格 + 成交量 + 持仓量）<span id="quadTag" style="font-size:12px;color:#6b7280;margin-left:8px"></span></h3><div id="c9" class="chart"></div><details class="reasoning"><summary>展开量仓确认逻辑</summary><ul><li>成交量与持仓量用于确认价格信号质量：增仓上涨通常代表新多资金参与，减仓上涨更偏空头回补。</li><li>增仓下跌说明空头压力仍在，减仓下跌则可能是多头离场后的尾段释放。</li><li>当前仪表盘中量仓结构作为反转概率的确认/背离提示，不直接写入五维加权公式。</li></ul></details></div>

  <div class="card"><h3>郑糖近一年（日线 + MA20/MA60 + 关键位）</h3><div id="c2" class="chart"></div></div>
  <div class="card"><h3>中粮糖业近一年（日线 + 成交量）</h3><div id="c3" class="chart"></div></div>

  <div class="card"><h3>厄尔尼诺/拉尼娜指数 ONI（2005至今）<span id="oniNote" style="font-size:12px;color:#6b7280;font-weight:normal;margin-left:8px"></span></h3><div id="c4" class="chart"></div><details class="reasoning"><summary>展开 ENSO 气候因子解释</summary><ul><li>ONI ≥ +0.5 通常定义为厄尔尼诺，ONI ≤ -0.5 通常定义为拉尼娜。</li><li>气候因子打分反映天气扰动对甘蔗/甜菜产量和供应预期的领先影响，强厄尔尼诺给较高但不满分的确认度。</li><li>暖化速度用于提示短期过热或回调风险：快速升温可能提高波动，不等同于价格立即上涨。</li></ul></details></div>
  <div class="card"><h3>ONI 领先郑糖的滞后相关（核心分析）</h3><div id="c5" class="chart"></div><details class="reasoning"><summary>展开 ONI 领先滞后公式</summary><div class="formula">r(lag) = corr(ONI_t, 郑糖收益率_{t+lag})</div><ul><li>柱子表示 ONI 对未来不同月份郑糖表现的相关系数，最高柱对应历史上最强的传导滞后。</li><li>相关系数接近 +1 为同向，接近 -1 为反向，接近 0 代表线性关系弱。</li><li>该结果只说明历史统计关系，仍需价格、进口利润和量仓结构共同确认。</li></ul></details></div>

  <div class="card"><h3>统计因子：郑糖 z-score（价 vs 250日均值的标准差）</h3><div id="c11" class="chart"></div><details class="reasoning"><summary>展开 z-score 计算说明</summary><div class="formula">z = (当前价格 - 250日均价) / 250日标准差</div><ul><li>z-score 衡量价格偏离长期均值的程度，|z| 越大代表越极端。</li><li>接近 -2σ 常被视为偏低/均值回归候选，接近 +2σ 则提示偏高或追涨风险。</li><li>该统计因子主要进入“郑糖/统计”维度，需结合趋势突破确认位判断。</li></ul></details></div>
  <div class="card"><h3>统计因子：20日年化波动率 + 多周期分位</h3><div id="c12" style="padding-top:8px"></div><details class="reasoning"><summary>展开波动率/分位解释</summary><div class="formula">20日年化波动率 ≈ std(日收益率, 20) × √252</div><ul><li>历史分位 = 当前价格在所选历史区间内所处的位置百分比。</li><li>低分位说明估值/价格位置偏低，上行赔率更好；高分位说明价格已处相对高位。</li><li>低波动向高波动切换时，若价格同步突破，趋势确认度更高。</li></ul></details></div>

  <div class="card"><h3>郑糖 vs 中粮糖业股价（月度散点 + 回归线）</h3><div id="c6" class="chart"></div></div>
  <div class="card"><h3>相关性结论</h3><div id="c7" style="padding-top:10px"></div><details class="reasoning"><summary>展开相关系数解读</summary><ul><li>r ≥ 0.7：强正相关；r ≤ -0.7：强负相关；|r| 在 0.4~0.7：中等相关；接近 0：弱相关。</li><li>负相关或滚动相关转弱时，说明股价可能更多受公司事件、分红或主题驱动，而非糖价本身。</li><li>相关性不是因果关系，只用于校验“糖周期反转”是否能够传导到公司股价。</li></ul></details></div>

  <div class="card wide"><h3>郑糖与股价的相关性随时间变化（12个月滚动相关系数）</h3><div id="c8" class="chart"></div></div>

  <div class="card wide"><h3>反转概率历史轨迹 + 各维度得分演变</h3><div id="c10" class="chart"></div><details class="reasoning"><summary>展开反转概率评分公式</summary><p>当前仪表盘评分解释模型沿用监控脚本的五维权重；若历史数据缺少某一维度，则图中仅展示已有维度曲线。</p><div class="formula">反转概率 ≈ 20%×ENSO气候 + 30%×郑糖/统计 + 15%×进口利润/内外价差 + 20%×股价/公司因子 + 15%×历史位置</div><ul><li>价格确认门控：郑糖突破 ${CONFIG.sugarConfirm} 时提高反转确认度；跌破 ${CONFIG.sugarFalsify} 时压低反转概率上限。</li><li>ENSO 维度关注 ONI 水平和升温速度；郑糖/统计维度关注均线、动量、z-score 与分位；股价维度关注公司价格趋势和风险线。</li><li>进口利润 z-score 反映“外强内弱”：利润率越低/倒挂越深，进口冲击越弱，对内盘偏多。</li><li>量仓结构由上方“成交量 + 持仓量”卡片提供确认：当前作为辅助确认项，不伪装成已有固定权重。</li></ul></details></div>

  <div class="card wide"><h3>进口利润率 + z-score 历史（"外强内弱"压缩可视化）</h3><div id="c13" class="chart"></div><details class="reasoning"><summary>展开进口利润率/z-score 公式</summary><div class="formula">进口利润率 = (郑糖价格 - 配额外进口成本) / 配额外进口成本</div><div class="formula">进口利润 z-score = (当前利润率 - 250日均值) / 250日标准差</div><ul><li>利润率 &gt; 0：进口糖有利可图，可能增加供给、压制内盘。</li><li>利润率 &lt; 0：进口倒挂，外盘强势传导为进口成本上升，对国内价格偏多。</li><li>z-score 低于 -1.5 视为进口利润极低/倒挂偏深，模型中偏多；高于 +1.5 则偏空。</li></ul></details></div>

  <div class="card wide"><h3>药用糖 / 公司事件时间轴（2025-2026 上涨的核心驱动）</h3><div id="c14" style="padding-top:6px"></div></div>
</div>

<script>
const DATA = ${JSON.stringify(chartData)};
const KPI = ${JSON.stringify(kpi)};

function lineOpt(xData, series, markLine) {
  return {
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: xData, boundaryGap: false },
    yAxis: { type: 'value', scale: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 2 }],
    series: series,
    ...(markLine ? { series: series.map(s => s.name === 'close' || s.name === '郑糖' ? { ...s, markLine } : s) } : {})
  };
}

// C1 郑糖20年周期
(function () {
  const x = DATA.sr20y.map(p => p[0]);
  const y = DATA.sr20y.map(p => p[1]);
  const areas = DATA.elNino.map(p => [{ name: '厄尔尼诺', xAxis: p[0], itemStyle: { color: 'rgba(220,38,38,0.10)' } }, { xAxis: p[1] }]);
  const opt = {
    grid: { left: 60, right: 30, top: 30, bottom: 60 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', scale: true, name: '元/吨' },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 30 }],
    series: [{
      name: '郑糖主力', type: 'line', data: y, showSymbol: false, lineStyle: { width: 1.5, color: '#dc2626' },
      markLine: { silent: true, symbol: 'none', data: [
        { yAxis: DATA.confirmLevel, label: { formatter: '确认位 5688', position: 'insideEndTop' }, lineStyle: { color: '#16a34a', type: 'dashed' } },
        { yAxis: DATA.falsifyLevel, label: { formatter: '证伪位 5053', position: 'insideEndTop' }, lineStyle: { color: '#f59e0b', type: 'dashed' } }
      ] },
      markArea: { silent: true, data: areas }
    }]
  };
  echarts.init(document.getElementById('c1')).setOption(opt);
})();

// C2 郑糖日线
(function () {
  const x = DATA.srDaily.map(p => p.d);
  const opt = {
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: x, boundaryGap: false },
    yAxis: { type: 'value', scale: true },
    dataZoom: [{ type: 'inside' }],
    series: [
      { name: '郑糖', type: 'line', data: DATA.srDaily.map(p => p.c), showSymbol: false, lineStyle: { width: 1.5, color: '#dc2626' },
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: DATA.confirmLevel, lineStyle: { color: '#16a34a', type: 'dashed' } }, { yAxis: DATA.falsifyLevel, lineStyle: { color: '#f59e0b', type: 'dashed' } }] } },
      { name: 'MA20', type: 'line', data: DATA.srDaily.map(p => p.m20), showSymbol: false, lineStyle: { width: 1, color: '#2563eb' } },
      { name: 'MA60', type: 'line', data: DATA.srDaily.map(p => p.m60), showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } }
    ]
  };
  echarts.init(document.getElementById('c2')).setOption(opt);
})();

// C3 股价日线 + 成交量
(function () {
  const x = DATA.stDaily.map(p => p.d);
  const opt = {
    grid: [{ left: 50, right: 20, top: 30, height: '55%' }, { left: 50, right: 20, top: '72%', height: '18%' }],
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: [
      { type: 'category', data: x, boundaryGap: false, gridIndex: 0 },
      { type: 'category', data: x, gridIndex: 1, axisLabel: { show: false } }
    ],
    yAxis: [
      { type: 'value', scale: true, gridIndex: 0 },
      { type: 'value', gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false } }
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }],
    series: [
      { name: '股价', type: 'line', data: DATA.stDaily.map(p => p.c), showSymbol: false, lineStyle: { width: 1.5, color: '#1f2937' },
        markLine: { silent: true, symbol: 'none', data: [
          { yAxis: DATA.stCost, label: { formatter: '成本 13.3', position: 'insideEndTop' }, lineStyle: { color: '#6b7280', type: 'dashed' } },
          { yAxis: DATA.stStopFull, label: { formatter: '清仓 12.24', position: 'insideEndBottom' }, lineStyle: { color: '#dc2626', type: 'dashed' } }
        ] } },
      { name: 'MA20', type: 'line', data: DATA.stDaily.map(p => p.m20), showSymbol: false, lineStyle: { width: 1, color: '#2563eb' } },
      { name: 'MA60', type: 'line', data: DATA.stDaily.map(p => p.m60), showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } },
      { name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: DATA.stDaily.map((p, i) => ({ value: p.v, itemStyle: { color: i > 0 && p.c >= DATA.stDaily[i - 1].c ? '#dc2626' : '#16a34a' } })) }
    ]
  };
  echarts.init(document.getElementById('c3')).setOption(opt);
})();

// C4 ONI
(function () {
  const x = DATA.oniBar.map(p => p[0]);
  const y = DATA.oniBar.map(p => p[1]);
  // 解释文字
  let note = '';
  if (KPI.oniTag === '厄尔尼诺') note = '历史厄尔尼诺期未来12月糖价 +9.0%（vs 非厄尔尼诺 +0.6%）';
  else if (KPI.oniTag === '拉尼娜') note = '拉尼娜期未来12月糖价偏空';
  else note = '中性期糖价无明显方向';
  if (KPI.oniWarming > 0.5) note += '｜暖化' + (KPI.oniWarming >= 0 ? '+' : '') + KPI.oniWarming + '→未来3-6月短期偏回调';
  document.getElementById('oniNote').innerHTML = note;
  const opt = {
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', name: 'ONI 距平' },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 14, bottom: 4 }],
    series: [{
      name: 'ONI', type: 'bar', data: y.map(v => ({ value: v, itemStyle: { color: v >= 0.5 ? '#dc2626' : (v <= -0.5 ? '#2563eb' : '#9ca3af') } })),
      markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0.5, lineStyle: { color: '#dc2626', type: 'dashed' } }, { yAxis: -0.5, lineStyle: { color: '#2563eb', type: 'dashed' } }] },
      markPoint: { symbolSize: 50, label: { show: true, formatter: '当前', fontSize: 10 }, data: [{ coord: [x.length - 1, y[y.length - 1]], value: '当前', itemStyle: { color: '#dc2626' } }] }
    }]
  };
  echarts.init(document.getElementById('c4')).setOption(opt);
})();

// C5 滞后相关
(function () {
  const lags = DATA.lagChart;
  const x = lags.map((_, i) => i + '个月');
  const opt = {
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    tooltip: { trigger: 'axis', formatter: p => p[0].name + '：相关系数 ' + (p[0].value == null ? '—' : p[0].value) },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', name: '相关系数', min: -1, max: 1 },
    series: [{
      type: 'bar', data: lags.map((v, i) => ({ value: v, itemStyle: { color: i === DATA.maxLag ? '#dc2626' : '#94a3b8' } })),
      label: { show: true, position: 'top', formatter: p => p.value == null ? '' : p.value }
    }],
    title: { text: 'ONI 领先糖价 ' + DATA.maxLag + ' 个月相关性最强 (r=' + (DATA.maxLagVal == null ? '—' : DATA.maxLagVal) + ')', textStyle: { fontSize: 12 }, left: 'center', top: 2 }
  };
  echarts.init(document.getElementById('c5')).setOption(opt);
})();

// C6 散点+回归
(function () {
  const pts = DATA.scatterSR_ST;
  const reg = DATA.regLine;
  const series = [{ name: '月度样本', type: 'scatter', data: pts, symbolSize: 7, itemStyle: { color: '#6366f1' } }];
  if (reg) series.push({ name: '回归线', type: 'line', data: [[reg.xmin, reg.slope * reg.xmin + reg.intercept], [reg.xmax, reg.slope * reg.xmax + reg.intercept]], showSymbol: false, lineStyle: { color: '#dc2626', width: 2, type: 'dashed' } });
  const opt = {
    grid: { left: 60, right: 30, top: 30, bottom: 40 },
    tooltip: { trigger: 'item', formatter: p => '郑糖 ' + p.value[0].toFixed(0) + ' 元/吨<br>股价 ' + p.value[1].toFixed(2) + ' 元' },
    xAxis: { type: 'value', name: '郑糖（元/吨）', scale: true },
    yAxis: { type: 'value', name: '股价（元）', scale: true },
    series: series,
    title: { text: '相关系数 r=' + (DATA.corrSR_ST == null ? '—' : DATA.corrSR_ST), textStyle: { fontSize: 12 }, left: 'center', top: 2 }
  };
  echarts.init(document.getElementById('c6')).setOption(opt);
})();

// C8 滚动相关
(function () {
  const x = DATA.rollingCorr.map(p => p[0]);
  const y = DATA.rollingCorr.map(p => p[1] == null ? null : +p[1].toFixed(3));
  const opt = {
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis', formatter: p => p[0].name + '：12月滚动相关 ' + (p[0].value == null ? '—' : p[0].value) },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', name: '相关系数', min: -1, max: 1 },
    dataZoom: [{ type: 'inside' }],
    series: [{
      name: '滚动相关', type: 'line', data: y, showSymbol: false,
      areaStyle: { opacity: 0.15 }, lineStyle: { color: '#6366f1', width: 1.5 },
      markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0, lineStyle: { color: '#9ca3af', type: 'dashed' }, label: { formatter: '零相关' } }] }
    }]
  };
  echarts.init(document.getElementById('c8')).setOption(opt);
})();

// C9 郑糖量仓结构
(function () {
  const x = DATA.srVolPos.map(p => p.d);
  const q = DATA.srQuad;
  document.getElementById('quadTag').innerHTML = '近20日：增仓涨 ' + q.upPos + ' 天 ｜ 减仓涨 ' + q.upNeg + ' 天 ｜ 增仓跌 ' + q.downPos + ' 天 ｜ 减仓跌 ' + q.downNeg + ' 天';
  const opt = {
    grid: [{ left: 60, right: 20, top: 30, height: '45%' }, { left: 60, right: 20, top: '62%', height: '13%' }, { left: 60, right: 20, top: '82%', height: '13%' }],
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: [
      { type: 'category', data: x, boundaryGap: false, gridIndex: 0 },
      { type: 'category', data: x, gridIndex: 1, axisLabel: { show: false } },
      { type: 'category', data: x, gridIndex: 2, axisLabel: { show: false } }
    ],
    yAxis: [
      { type: 'value', scale: true, gridIndex: 0 },
      { type: 'value', gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false } },
      { type: 'value', gridIndex: 2, axisLabel: { show: false }, splitLine: { show: false } }
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1, 2] }],
    series: [
      { name: '郑糖', type: 'line', data: DATA.srVolPos.map(p => p.c), showSymbol: false, lineStyle: { width: 1.5, color: '#dc2626' } },
      { name: 'MA20', type: 'line', data: DATA.srVolPos.map(p => p.m20), showSymbol: false, lineStyle: { width: 1, color: '#2563eb' } },
      { name: 'MA60', type: 'line', data: DATA.srVolPos.map(p => p.m60), showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } },
      { name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: DATA.srVolPos.map((p, i) => ({ value: p.v, itemStyle: { color: i > 0 && p.c >= DATA.srVolPos[i - 1].c ? '#dc2626' : '#16a34a' } })) },
      { name: '持仓量', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: DATA.srVolPos.map(p => p.p), showSymbol: false, lineStyle: { width: 1.5, color: '#8b5cf6' } }
    ]
  };
  echarts.init(document.getElementById('c9')).setOption(opt);
})();

// C10 反转概率历史轨迹
(function () {
  const x = DATA.probHist.map(p => p.date);
  const opt = {
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', min: 0, max: 100, name: '分数' },
    series: [
      { name: '反转概率', type: 'line', data: DATA.probHist.map(p => p.prob), showSymbol: true, symbolSize: 6, lineStyle: { width: 2, color: '#dc2626' } },
      { name: 'ENSO', type: 'line', data: DATA.probHist.map(p => p.enso), showSymbol: false, lineStyle: { width: 1, color: '#f59e0b' } },
      { name: '郑糖', type: 'line', data: DATA.probHist.map(p => p.sugar), showSymbol: false, lineStyle: { width: 1, color: '#2563eb' } },
      { name: '股价', type: 'line', data: DATA.probHist.map(p => p.stock), showSymbol: false, lineStyle: { width: 1, color: '#16a34a' } }
    ]
  };
  echarts.init(document.getElementById('c10')).setOption(opt);
})();

// C11 z-score
(function () {
  const x = DATA.srZseries.map(p => p.d);
  const opt = {
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x, boundaryGap: false },
    yAxis: { type: 'value', name: 'z-score' },
    dataZoom: [{ type: 'inside' }],
    series: [{
      name: 'z-score', type: 'line', data: DATA.srZseries.map(p => p.z), showSymbol: false,
      areaStyle: { opacity: 0.15 }, lineStyle: { color: '#6366f1', width: 1.5 },
      markLine: { silent: true, symbol: 'none', data: [
        { yAxis: 2, lineStyle: { color: '#dc2626', type: 'dashed' }, label: { formatter: '+2σ' } },
        { yAxis: -2, lineStyle: { color: '#16a34a', type: 'dashed' }, label: { formatter: '-2σ' } },
        { yAxis: 0, lineStyle: { color: '#9ca3af', type: 'dashed' } }
      ] }
    }]
  };
  echarts.init(document.getElementById('c11')).setOption(opt);
})();

// C12 波动率 + 多周期分位
(function () {
  const pct = DATA.pctMulti;
  const volLatest = DATA.srVolSeries.length ? DATA.srVolSeries[DATA.srVolSeries.length - 1].v : null;
  const tag = (p, low, high) => p < low ? '低位' : (p > high ? '高位' : '中位');
  document.getElementById('c12').innerHTML =
    '<div style="font-size:13px;margin-bottom:8px"><b>20日年化波动率：' + (volLatest == null ? '—' : volLatest + '%') + '</b></div>' +
    '<table class="corr"><tr><th>周期</th><th>历史分位</th><th>位置</th></tr>' +
    '<tr><td>1年</td><td>' + pct.pct1y + '%</td><td>' + tag(pct.pct1y, 30, 70) + '</td></tr>' +
    '<tr><td>3年</td><td>' + pct.pct3y + '%</td><td>' + tag(pct.pct3y, 30, 70) + '</td></tr>' +
    '<tr><td>5年</td><td>' + pct.pct5y + '%</td><td>' + tag(pct.pct5y, 30, 70) + '</td></tr>' +
    '<tr><td>20年</td><td>' + pct.pct20y + '%</td><td>' + tag(pct.pct20y, 30, 70) + '</td></tr>' +
    '</table>' +
    '<div style="font-size:12px;color:#6b7280;margin-top:8px">低波动→高波动切换常伴随趋势启动；z-score 到 ±2σ 附近常是均值回归拐点</div>';
})();

// C13 进口利润率 + z-score 历史
(function () {
  const x1 = DATA.marginHist.map(p => p[0]);
  const x2 = DATA.marginZseries.map(p => p.date);
  const opt = {
    grid: [{ left: 60, right: 60, top: 30, height: '45%' }, { left: 60, right: 60, top: '62%', height: '28%' }],
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: [
      { type: 'category', data: x1, gridIndex: 0, axisLabel: { show: false } },
      { type: 'category', data: x2, gridIndex: 1 }
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, name: '利润率%', scale: true },
      { type: 'value', gridIndex: 1, name: 'z-score' }
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }],
    series: [
      { name: '进口利润率%', type: 'line', data: DATA.marginHist.map(p => p[1]), showSymbol: false, lineStyle: { width: 1.5, color: '#dc2626' }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0, lineStyle: { color: '#9ca3af', type: 'dashed' }, label: { formatter: '盈亏平衡' } }] } },
      { name: 'z-score(250日)', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: DATA.marginZseries.map(p => p.z), showSymbol: false, lineStyle: { width: 1.5, color: '#8b5cf6' }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: -1.5, lineStyle: { color: '#16a34a', type: 'dashed' }, label: { formatter: '偏多阈值' } }, { yAxis: 1.5, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: '偏空阈值' } }] } }
    ]
  };
  echarts.init(document.getElementById('c13')).setOption(opt);
})();

// C14 药用糖事件时间轴
(function () {
  const events = [
    ['2025-02-10', '崇左糖业注射级药用蔗糖获国内首个发明专利授权（填补国内空白）'],
    ['2025-05-30', '注射级疫苗糖生产线建成（业绩会称"未来不排除业务拓展"）'],
    ['2025-08-12', '股价 8 日 +65% 跳涨（分红除权 + 药用研发 + 央企改革 + 食糖主业）'],
    ['2025-08-15', '公司发布《股票交易风险提示公告》（炒作中）'],
    ['2025-08-19', '公司发布《股票交易异常波动公告》（跳涨见顶）'],
    ['2025-09-01', '涨停：研发突破 + 全产业链优势 + 央企改革'],
    ['2025-11-12', '2 连板：食糖 + 国企改革概念联动'],
    ['2026-06-01', '涨停：行业景气度提升 + 药用糖业务突破 + 高比例分红']
  ];
  document.getElementById('c14').innerHTML =
    '<table class="corr"><tr><th style="width:110px">日期</th><th>事件</th></tr>' +
    events.map(e => '<tr><td style="white-space:nowrap">' + e[0] + '</td><td style="text-align:left">' + e[1] + '</td></tr>').join('') +
    '</table>' +
    '<div style="font-size:12px;color:#6b7280;margin-top:8px">⚠️ 关键提醒：股价近 3 年与糖价脱钩（r=-0.82），上涨主要由"药用糖国产替代 + 央企改革 + 高分红"驱动，而非糖价。糖价反转只是其中一个期权。</div>';
})();

// C7 相关性结论表
(function () {
  function strength(c) {
    if (c == null) return '数据不足';
    if (c <= -0.7) return '强负相关(脱钩)';
    if (c >= 0.7) return '强正相关';
    if (Math.abs(c) >= 0.4) return '中等' + (c < 0 ? '负' : '正') + '相关';
    return '弱相关';
  }
  const rows = [
    ['郑糖 ↔ 中粮糖业股价', DATA.corrSR_ST, '同期月度(近3年)', strength(DATA.corrSR_ST), '近3年股价与糖价脱钩：糖价跌17%而股价涨165%，由公司故事(2025年8月+65%跳涨)驱动'],
    ['郑糖 ↔ ICE 原糖', DATA.corrSR_ICE, '同期月度', strength(DATA.corrSR_ICE), '内外联动，近期"外强内弱"分化'],
    ['ONI → 郑糖(领先' + DATA.maxLag + '个月)', DATA.maxLagVal, '滞后相关峰值', strength(DATA.maxLagVal), '厄尔尼诺→减产→糖价上涨，传导约12个月，但相关性偏弱']
  ];
  document.getElementById('c7').innerHTML = '<table class="corr"><tr><th>关系</th><th>相关系数</th><th>口径</th><th>强度</th><th>解读</th></tr>' +
    rows.map(r => '<tr><td style="text-align:left">' + r[0] + '</td><td>' + (r[1] == null ? '—' : r[1]) + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td style="text-align:left">' + r[4] + '</td></tr>').join('') + '</table>';
})();

window.addEventListener('resize', () => { for (const id of ['c1','c2','c3','c4','c5','c6','c8','c9','c10','c11','c13']) { const c = echarts.getInstanceByDom(document.getElementById(id)); if (c) c.resize(); } });
</script>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log('dashboard.html 已生成:', OUT, '(' + (html.length / 1024).toFixed(0) + 'KB)');
console.log('核心相关分析结果:');
console.log('  郑糖 ↔ 股价 r =', corrSR_ST == null ? '—' : corrSR_ST.toFixed(3));
console.log('  郑糖 ↔ ICE  r =', corrSR_ICE == null ? '—' : corrSR_ICE.toFixed(3));
console.log('  ONI → 郑糖 滞后峰值: 领先', maxLag, '个月, r =', maxLagVal == null ? '—' : maxLagVal.toFixed(3));
for (const l of lags) console.log('    lag', l.lag, '个月:', l.corr == null ? '—' : l.corr.toFixed(3));
