// ENSO 混杂检验：控制价格分位后，厄尔尼诺溢价是否仍然存在？
// 逻辑：如果"厄尔尼诺→+9%"只是因为它常出现在糖价低位（均值回归），
//       那么在同一价格分位桶内，厄尔尼诺 vs 非厄尔尼诺的收益差应该消失。
// 方法：按月分桶（低位<33% / 中位33-67% / 高位>67%），桶内比较厄尔尼诺 vs 非厄尔尼诺的未来12月收益。
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

function loadSRMonthly() {
  const l = fs.readFileSync(path.join(D, 'SR0_daily.csv'), 'utf8').trim().split('\n').slice(1);
  const map = new Map();
  for (const x of l) { const p = x.split(','); map.set(p[0].slice(0, 7), +p[4]); }
  return Array.from(map.entries()).map(([ym, close]) => ({ ym, close })).sort((a, b) => a.ym < b.ym ? -1 : 1);
}
function loadONIMonthly() {
  const l = fs.readFileSync(path.join(D, 'ONI_enso.txt'), 'utf8').trim().split('\n').filter(x => x.trim() && !/^\s*SEAS/.test(x));
  const CENTER = { DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6, JJA: 7, JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12 };
  return l.map(x => { const p = x.trim().split(/\s+/); return { ym: `${p[1]}-${String(CENTER[p[0]]).padStart(2, '0')}`, anom: +p[3] }; }).sort((a, b) => a.ym < b.ym ? -1 : 1);
}

const srM = loadSRMonthly();
const oniM = loadONIMonthly();
const oniMap = new Map(oniM.map(x => [x.ym, x.anom]));
const months = srM.filter(x => oniMap.has(x.ym)).map(x => x.ym);
const N = months.length;
const close = months.map(ym => srM.find(x => x.ym === ym).close);
const oni = months.map(ym => oniMap.get(ym));

// 前12月收益
const fwd12 = new Array(N).fill(null);
for (let i = 0; i < N - 12; i++) fwd12[i] = (close[i + 12] - close[i]) / close[i];

// 价格分位（滚动3年36个月）
function trailingPct(i, win = 36) {
  if (i < win - 1) return null;
  const seg = close.slice(i - win + 1, i + 1).sort((a, b) => a - b);
  return seg.filter(v => v <= close[i]).length / win;
}

console.log('='.repeat(90));
console.log('厄尔尼诺 +9% 的混杂检验（控制价格分位）');
console.log('='.repeat(90));
console.log('价格分位桶'.padEnd(14) + '状态'.padEnd(10) + '样本数'.padStart(6) + '未来12月均收益'.padStart(14));
console.log('-'.repeat(90));

const buckets = [[0, 0.33, '低位<33%'], [0.33, 0.67, '中位33-67%'], [0.67, 1.01, '高位>67%']];
for (const [lo, hi, label] of buckets) {
  for (const [state, tag] of [[true, '厄尔尼诺'], [false, '非厄尔尼诺']]) {
    const rets = [];
    for (let i = 0; i < N - 12; i++) {
      if (fwd12[i] == null || oni[i] == null) continue;
      const pct = trailingPct(i);
      if (pct == null || pct < lo || pct >= hi) continue;
      const isEl = oni[i] >= 0.5;
      if (isEl === state) rets.push(fwd12[i]);
    }
    const avg = rets.length ? (rets.reduce((a, b) => a + b, 0) / rets.length * 100).toFixed(1) + '%' : '—';
    console.log(label.padEnd(14) + tag.padEnd(10) + String(rets.length).padStart(6) + avg.padStart(14));
  }
  console.log('');
}

// 桶内溢价（厄尔尼诺 - 非厄尔尼诺）
console.log('各价格桶内的"厄尔尼诺溢价"（厄尔尼诺 − 非厄尔尼诺）：');
for (const [lo, hi, label] of buckets) {
  const el = [], nel = [];
  for (let i = 0; i < N - 12; i++) {
    if (fwd12[i] == null || oni[i] == null) continue;
    const pct = trailingPct(i);
    if (pct == null || pct < lo || pct >= hi) continue;
    if (oni[i] >= 0.5) el.push(fwd12[i]); else nel.push(fwd12[i]);
  }
  if (el.length >= 5 && nel.length >= 5) {
    const e = el.reduce((a, b) => a + b, 0) / el.length, n = nel.reduce((a, b) => a + b, 0) / nel.length;
    console.log('  ' + label.padEnd(14) + '溢价 ' + ((e - n) * 100).toFixed(1) + '%（厄尔尼诺' + el.length + '样本 vs 非' + nel.length + '样本）');
  } else {
    console.log('  ' + label.padEnd(14) + '样本不足');
  }
}
