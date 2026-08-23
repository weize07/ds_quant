// =============================================================================
// ENSO 事件化 IC 检验（目标：郑糖未来 1/3/6/12 个月收益）
// 检验"厄尔尼诺→减产→糖价上涨"传导链：
//   连续ONI值 vs 厄尔尼诺哑变量 vs 强厄尔尼诺哑变量 vs 拐点事件
// 用月度数据对齐（ONI中心月 vs 郑糖月末收盘，2006-2026 约248个月）
// =============================================================================
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

// 加载郑糖 → 月度
function loadSRMonthly() {
  const l = fs.readFileSync(path.join(D, 'SR0_daily.csv'), 'utf8').trim().split('\n').slice(1);
  const map = new Map();
  for (const x of l) { const p = x.split(','); map.set(p[0].slice(0, 7), +p[4]); }
  return Array.from(map.entries()).map(([ym, close]) => ({ ym, close })).sort((a, b) => a.ym < b.ym ? -1 : 1);
}
// 加载 ONI → 月度（中心月）
function loadONIMonthly() {
  const l = fs.readFileSync(path.join(D, 'ONI_enso.txt'), 'utf8').trim().split('\n').filter(x => x.trim() && !/^\s*SEAS/.test(x));
  const CENTER = { DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6, JJA: 7, JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12 };
  return l.map(x => { const p = x.trim().split(/\s+/); return { ym: `${p[1]}-${String(CENTER[p[0]]).padStart(2, '0')}`, anom: +p[3] }; }).sort((a, b) => a.ym < b.ym ? -1 : 1);
}

const srM = loadSRMonthly();
const oniM = loadONIMonthly();
const oniMap = new Map(oniM.map(x => [x.ym, x.anom]));

// 对齐：只保留两者都有的月份
const months = srM.filter(x => oniMap.has(x.ym)).map(x => x.ym);
const N = months.length;
const close = months.map(ym => srM.find(x => x.ym === ym).close);
const oni = months.map(ym => oniMap.get(ym));

// 工具
function pearson(x, y) {
  const pairs = [];
  for (let i = 0; i < x.length; i++) if (x[i] != null && y[i] != null && isFinite(x[i]) && isFinite(y[i])) pairs.push([x[i], y[i]]);
  if (pairs.length < 10) return null;
  const m = pairs.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [a, b] of pairs) { sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; }
  const num = m * sxy - sx * sy, den = Math.sqrt((m * sxx - sx * sx) * (m * syy - sy * sy));
  return den === 0 ? null : num / den;
}
function spearman(x, y) {
  const rank = arr => { const idx = arr.map((v, i) => [v, i]).filter(p => p[0] != null && isFinite(p[0])).sort((a, b) => a[0] - b[0]); const r = new Array(arr.length).fill(null); idx.forEach((p, i) => r[p[1]] = i + 1); return r; };
  return pearson(rank(x), rank(y));
}

// 因子（月度）
const F = {
  oni: oni,                                                    // 连续ONI
  elNino: oni.map(v => v == null ? null : (v >= 0.5 ? 1 : 0)), // 厄尔尼诺
  strongEl: oni.map(v => v == null ? null : (v >= 1.0 ? 1 : 0)), // 强厄尔尼诺
  laNina: oni.map(v => v == null ? null : (v <= -0.5 ? 1 : 0)), // 拉尼娜
  chg3: oni.map((v, i) => i < 3 || v == null || oni[i - 3] == null ? null : v - oni[i - 3]), // 3月暖化速率
  onset: oni.map((v, i) => i < 3 || v == null || oni[i - 3] == null ? null : (v >= 0.5 && oni[i - 3] < 0.5 ? 1 : 0)) // 拐点事件
};

// 前向收益（月度，1/3/6/12个月）
function fwd(k) {
  const out = new Array(N).fill(null);
  for (let i = 0; i < N - k; i++) out[i] = (close[i + k] - close[i]) / close[i];
  return out;
}
const R = { m1: fwd(1), m3: fwd(3), m6: fwd(6), m12: fwd(12) };

console.log('='.repeat(96));
console.log('ENSO 事件化 IC 检验（郑糖月度，' + months[0] + ' ~ ' + months[N - 1] + '，共 ' + N + ' 个月）');
console.log('='.repeat(96));
console.log('因子'.padEnd(16) + '未来1月'.padStart(9) + '未来3月'.padStart(9) + '未来6月'.padStart(9) + '未来12月'.padStart(9));
console.log('-'.repeat(96));
const icTable = {};
for (const [key, fac] of Object.entries(F)) {
  const row = {};
  for (const [rk, r] of Object.entries(R)) row[rk] = spearman(fac, r);
  icTable[key] = row;
  const fmt = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(3);
  const name = { oni: 'ONI连续值', elNino: '厄尔尼诺哑变量', strongEl: '强厄尔尼诺哑变量', laNina: '拉尼娜哑变量', chg3: 'ONI暖化速率(3月)', onset: '厄尔尼诺拐点事件' }[key];
  console.log(name.padEnd(16) + fmt(row.m1).padStart(9) + fmt(row.m3).padStart(9) + fmt(row.m6).padStart(9) + fmt(row.m12).padStart(9));
}

// 分组平均收益（哑变量因子更直观）
console.log('\n分组平均未来收益（哑变量 = 1 vs = 0）：');
console.log('事件'.padEnd(18) + '状态'.padEnd(8) + '样本数'.padStart(6) + '未来6月均收益'.padStart(14) + '未来12月均收益'.padStart(15));
console.log('-'.repeat(96));
function groupMean(dummy, horizon) {
  const g1 = [], g0 = [];
  for (let i = 0; i < N - horizon; i++) {
    if (dummy[i] == null || R['m' + horizon][i] == null) continue;
    if (dummy[i] === 1) g1.push(R['m' + horizon][i]); else g0.push(R['m' + horizon][i]);
  }
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length * 100).toFixed(1) + '%' : '—';
  return { g1: avg(g1), g0: avg(g0), n1: g1.length, n0: g0.length };
}
for (const [key, label, h] of [['elNino', '厄尔尼诺', 6], ['elNino', '厄尔尼诺', 12], ['strongEl', '强厄尔尼诺', 12], ['laNina', '拉尼娜', 12], ['onset', '厄尔尼诺拐点', 6], ['onset', '厄尔尼诺拐点', 12]]) {
  const r = groupMean(F[key], h);
  console.log(label.padEnd(18) + '发生'.padEnd(8) + String(r.n1).padStart(6) + r.g1.padStart(14) + '—'.padStart(15));
  console.log(label.padEnd(18) + '未发生'.padEnd(8) + String(r.n0).padStart(6) + r.g0.padStart(14) + '—'.padStart(15));
}

fs.writeFileSync(path.join(D, 'enso_ic.json'), JSON.stringify({ months, ic: icTable }, null, 2));
console.log('\n已保存: data/enso_ic.json');
