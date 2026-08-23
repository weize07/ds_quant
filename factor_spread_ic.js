// =============================================================================
// 价差因子 IC 检验（进口利润率 + z-score + 郑糖/ICE 比值）
// 目标：郑糖未来 20/60/120 日收益率
// 数据：ICE 2018-2026（东财 108.SB00Y）+ 郑糖 2018-2026 + 汇率近似6.73
// =============================================================================
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

function loadCSV(f, dateIdx, closeIdx) {
  const l = fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n').slice(1);
  const map = new Map();
  for (const x of l) { const p = x.split(','); map.set(p[dateIdx], +p[closeIdx]); }
  return map;
}

const iceMap = loadCSV('ICE_sugar_daily.csv', 0, 2);
const srMap = loadCSV('SR0_daily.csv', 0, 4);

// 对齐日期
const dates = [];
for (const d of srMap.keys()) if (iceMap.has(d)) dates.push(d);
dates.sort();
const N = dates.length;
const iceClose = dates.map(d => iceMap.get(d));
const srClose = dates.map(d => srMap.get(d));

// 常数
const FX = 6.7259, TARIFF = 1.5, YIELD = 0.92, FEE = 550;

// 进口成本 + 利润率（每日）
const importCost = iceClose.map(ice => ice * 22.0462 * FX * TARIFF / YIELD + FEE);
const margin = srClose.map((sr, i) => (sr - importCost[i]) / importCost[i]);

// 工具
function pearson(x, y) {
  const pairs = [];
  for (let i = 0; i < x.length; i++) if (x[i] != null && y[i] != null && isFinite(x[i]) && isFinite(y[i])) pairs.push([x[i], y[i]]);
  if (pairs.length < 10) return null;
  const m = pairs.length; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [a, b] of pairs) { sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; }
  const num = m * sxy - sx * sy, den = Math.sqrt((m * sxx - sx * sx) * (m * syy - sy * sy));
  return den === 0 ? null : num / den;
}
function spearman(x, y) {
  const rank = arr => { const idx = arr.map((v, i) => [v, i]).filter(p => p[0] != null && isFinite(p[0])).sort((a, b) => a[0] - b[0]); const r = new Array(arr.length).fill(null); idx.forEach((p, i) => r[p[1]] = i + 1); return r; };
  return pearson(rank(x), rank(y));
}

// 因子
const zscore = new Array(N).fill(null);   // 利润率 250日滚动 z-score
const margin5chg = new Array(N).fill(null); // 利润率 5日变化
const ratio = new Array(N).fill(null);      // 郑糖/ICE 比值
for (let i = 0; i < N; i++) {
  ratio[i] = srClose[i] / iceClose[i];
  if (i >= 5) margin5chg[i] = margin[i] - margin[i - 5];
  if (i >= 250) {
    const seg = margin.slice(i - 249, i + 1);
    const mean = seg.reduce((a, b) => a + b, 0) / 250;
    const std = Math.sqrt(seg.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 250);
    zscore[i] = std === 0 ? 0 : (margin[i] - mean) / std;
  }
}

// 前向收益
function fwd(k) { const out = new Array(N).fill(null); for (let i = 0; i < N - k; i++) out[i] = (srClose[i + k] - srClose[i]) / srClose[i]; return out; }
const R20 = fwd(20), R60 = fwd(60), R120 = fwd(120);

const factors = {
  margin: { name: '进口利润率(原始)', arr: margin },
  zscore: { name: '利润率z-score(250日)', arr: zscore },
  margin5chg: { name: '利润率5日变化', arr: margin5chg },
  ratio: { name: '郑糖/ICE比值', arr: ratio }
};

console.log('='.repeat(88));
console.log('价差因子 IC 检验（郑糖未来收益，ICE 2018-2026 共 ' + N + ' 个对齐交易日）');
console.log('当前进口利润率:', (margin[N - 1] * 100).toFixed(1) + '%，z-score:', zscore[N - 1] == null ? '—' : zscore[N - 1].toFixed(2));
console.log('='.repeat(88));
console.log('因子'.padEnd(20) + '未来20日'.padStart(10) + '未来60日'.padStart(10) + '未来120日'.padStart(10));
console.log('-'.repeat(88));
for (const [key, f] of Object.entries(factors)) {
  const ic20 = spearman(f.arr, R20), ic60 = spearman(f.arr, R60), ic120 = spearman(f.arr, R120);
  const fmt = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(3);
  console.log(f.name.padEnd(20) + fmt(ic20).padStart(10) + fmt(ic60).padStart(10) + fmt(ic120).padStart(10));
}

// 分组：利润率倒挂 vs 有利润
console.log('\n分组未来收益（按利润率正负）：');
for (const [label, h] of [['倒挂(利润率<0)', 60], ['倒挂(利润率<0)', 120], ['有利润(利润率>0)', 60], ['有利润(利润率>0)', 120]]) {
  const isNeg = label.startsWith('倒挂');
  const rets = [];
  for (let i = 0; i < N - h; i++) {
    if (h === 60 ? R60[i] == null : R120[i] == null) continue;
    const neg = margin[i] < 0;
    if (neg === isNeg) rets.push(h === 60 ? R60[i] : R120[i]);
  }
  const avg = rets.length ? (rets.reduce((a, b) => a + b, 0) / rets.length * 100).toFixed(1) + '%' : '—';
  console.log('  ' + label.padEnd(16) + '未来' + h + '日: ' + avg + '（' + rets.length + '样本）');
}
