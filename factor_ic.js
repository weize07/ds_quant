// =============================================================================
// 量仓因子 IC 检验（目标A：未来20日郑糖收益率）
// 用 20 年郑糖日线（含成交量、持仓量）检验各量仓因子对后市的预测力
// 输出: 控制台结果表 + data/factor_ic.json（滚动IC，供 dashboard）
// =============================================================================
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

function loadSR() {
  const l = fs.readFileSync(path.join(D, 'SR0_daily.csv'), 'utf8').trim().split('\n').slice(1);
  return l.map(x => { const p = x.split(','); return { date: p[0], close: +p[4], volume: +p[5], position: +p[6] }; });
}
const sr = loadSR();
const n = sr.length;

// ===== 工具 =====
function pearson(x, y) {
  const pairs = [];
  for (let i = 0; i < x.length; i++) if (x[i] != null && y[i] != null && isFinite(x[i]) && isFinite(y[i])) pairs.push([x[i], y[i]]);
  if (pairs.length < 10) return null;
  const m = pairs.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [a, b] of pairs) { sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; }
  const num = m * sxy - sx * sy;
  const den = Math.sqrt((m * sxx - sx * sx) * (m * syy - sy * sy));
  return den === 0 ? null : num / den;
}
function spearman(x, y) {
  const rank = arr => {
    const idx = arr.map((v, i) => [v, i]).filter(p => p[0] != null && isFinite(p[0])).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length).fill(null);
    idx.forEach((p, i) => r[p[1]] = i + 1);
    return r;
  };
  return pearson(rank(x), rank(y));
}

// ===== 目标：未来20日收益 =====
const fwd20 = new Array(n).fill(null);
for (let i = 0; i < n - 20; i++) fwd20[i] = (sr[i + 20].close - sr[i].close) / sr[i].close;

// ===== 因子 =====
const F = {
  upPos: new Array(n).fill(null),     // 增仓涨占比(近20日) 真趋势
  upNeg: new Array(n).fill(null),     // 减仓涨占比 空头回补/虚涨
  downPos: new Array(n).fill(null),   // 增仓跌占比 空头打压
  posChg20: new Array(n).fill(null),  // 持仓量20日变化率
  posPct: new Array(n).fill(null),    // 持仓量250日分位
  volAbn: new Array(n).fill(null),    // 成交量异常度
  mom20: new Array(n).fill(null)      // 20日动量(基准对比)
};

for (let i = 20; i < n; i++) {
  let upPos = 0, upNeg = 0, downPos = 0, volSum = 0;
  for (let j = i - 19; j <= i; j++) {
    const pu = sr[j].close > sr[j - 1].close;
    const ou = sr[j].position > sr[j - 1].position;
    if (pu && ou) upPos++; else if (pu) upNeg++; else if (ou) downPos++;
    volSum += sr[j].volume;
  }
  F.upPos[i] = upPos / 20;
  F.upNeg[i] = upNeg / 20;
  F.downPos[i] = downPos / 20;
  F.posChg20[i] = (sr[i].position - sr[i - 20].position) / sr[i - 20].position;
  F.volAbn[i] = sr[i].volume / (volSum / 20);
  F.mom20[i] = (sr[i].close - sr[i - 20].close) / sr[i - 20].close;
  const seg = sr.slice(i - 249, i + 1).map(x => x.position).sort((a, b) => a - b);
  F.posPct[i] = seg.filter(v => v <= sr[i].position).length / 250;
}

// ===== IC 计算 =====
function icOn(factor, indices) {
  const xs = [], ys = [];
  for (const i of indices) if (factor[i] != null && fwd20[i] != null) { xs.push(factor[i]); ys.push(fwd20[i]); }
  return spearman(xs, ys);
}

const allIdx = []; for (let i = 20; i < n - 20; i++) allIdx.push(i);
const nonOverlapIdx = []; for (let i = 20; i < n - 20; i += 20) nonOverlapIdx.push(i);
const inSampleIdx = []; for (let i = 20; i < n - 20 - 1250; i++) inSampleIdx.push(i);        // 前15年
const outSampleIdx = []; for (let i = n - 20 - 1250; i < n - 20; i++) outSampleIdx.push(i); // 后5年

// 滚动IC（250日窗口，步长20）
function rollingIC(factor) {
  const out = [];
  for (let start = 20; start < n - 20 - 250; start += 20) {
    const xs = [], ys = [];
    for (let i = start; i < start + 250; i++) if (factor[i] != null && fwd20[i] != null) { xs.push(factor[i]); ys.push(fwd20[i]); }
    const ic = spearman(xs, ys);
    if (ic != null) out.push({ date: sr[start + 250].date, ic: +ic.toFixed(4) });
  }
  return out;
}

const factorMeta = {
  upPos: { name: '增仓涨占比(真趋势)', expect: '+' },
  upNeg: { name: '减仓涨占比(虚涨)', expect: '-' },
  downPos: { name: '增仓跌占比(空头打压)', expect: '-' },
  posChg20: { name: '持仓20日变化率', expect: '+' },
  posPct: { name: '持仓250日分位', expect: '?' },
  volAbn: { name: '成交量异常度', expect: '?' },
  mom20: { name: '20日动量(基准)', expect: '+' }
};

console.log('='.repeat(100));
console.log('量仓因子 IC 检验（目标：未来20日郑糖收益率）');
console.log('样本：郑糖主力 20年（' + sr[0].date + ' ~ ' + sr[n - 1].date + '，共 ' + n + ' 个交易日）');
console.log('='.repeat(100));
console.log('因子'.padEnd(22) + '全样本IC'.padStart(10) + '非重叠IC'.padStart(10) + '样本内IC'.padStart(10) + '样本外IC'.padStart(10) + '预期方向'.padStart(8));
console.log('-'.repeat(100));

const rollICData = {};
for (const [key, meta] of Object.entries(factorMeta)) {
  const icFull = icOn(F[key], allIdx);
  const icNon = icOn(F[key], nonOverlapIdx);
  const icIn = icOn(F[key], inSampleIdx);
  const icOut = icOn(F[key], outSampleIdx);
  rollICData[key] = rollingIC(F[key]);
  const fmt = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(3);
  console.log(
    meta.name.padEnd(22) + fmt(icFull).padStart(10) + fmt(icNon).padStart(10) + fmt(icIn).padStart(10) + fmt(icOut).padStart(10) + meta.expect.padStart(8)
  );
}

// 滚动IC稳定性（以 upPos 和 upNeg 为例）
console.log('\n滚动IC稳定性（250日窗口，正IC占比）：');
for (const [key, meta] of Object.entries(factorMeta)) {
  const roll = rollICData[key];
  const posRatio = roll.length ? (roll.filter(r => r.ic > 0).length / roll.length * 100).toFixed(0) + '%' : '—';
  console.log('  ' + meta.name.padEnd(22) + ' 正IC占比 ' + posRatio + '（窗口数 ' + roll.length + '）');
}

// 保存滚动IC供 dashboard
fs.writeFileSync(path.join(D, 'factor_ic.json'), JSON.stringify({ fwd20_days: 20, rolling: rollICData }, null, 2));
console.log('\n滚动IC已保存: data/factor_ic.json');
