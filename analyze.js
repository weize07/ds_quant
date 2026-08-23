// 周期位置分析：郑糖主力 + 600737 + ONI + ICE
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

function loadCsv(f, cols) {
  const lines = fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n');
  const head = lines[0].split(',');
  const idx = {};
  head.forEach((h, i) => idx[h.trim()] = i);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    const o = {};
    for (const c of cols) o[c] = idx[c] !== undefined ? p[idx[c]] : undefined;
    out.push(o);
  }
  return out;
}

function ma(arr, n) {
  const closes = arr.map(x => x.close);
  const out = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < n - 1) { out.push(null); continue; }
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += closes[j];
    out.push(s / n);
  }
  return out;
}

// 郑糖主力
const sr = loadCsv('SR0_daily.csv', ['date', 'close', 'volume', 'position']).map(x => ({ ...x, close: +x.close, volume: +x.volume, position: +x.position }));
const srClose = sr.map(x => x.close);
const srLast = sr[sr.length - 1];
const srAllHigh = Math.max(...srClose), srAllLow = Math.min(...srClose);
const sorted = [...srClose].sort((a, b) => a - b);
const pct = sorted.filter(v => v <= srLast.close).length / sorted.length * 100;
const sr20 = ma(sr, 20), sr60 = ma(sr, 60), sr250 = ma(sr, 250);
const sr1y = sr.filter(x => x.date >= '2025-08-21');
const sr3y = sr.filter(x => x.date >= '2023-08-21');
const sr1yHigh = Math.max(...sr1y.map(x => x.close)), sr1yLow = Math.min(...sr1y.map(x => x.close));
const sr3yHigh = Math.max(...sr3y.map(x => x.close)), sr3yLow = Math.min(...sr3y.map(x => x.close));

console.log('========== 郑糖主力 SR0 ==========');
console.log('最新:', srLast.date, '收盘', srLast.close.toFixed(0), '持仓', srLast.position);
console.log('20年最高/最低:', srAllHigh.toFixed(0), '/', srAllLow.toFixed(0));
console.log('当前历史分位:', pct.toFixed(1) + '%');
console.log('MA20/MA60/MA250:', sr20[sr20.length - 1].toFixed(0), '/', sr60[sr60.length - 1].toFixed(0), '/', sr250[sr250.length - 1].toFixed(0));
console.log('MA20趋势:', sr20[sr20.length - 1] > sr20[sr20.length - 6] ? '向上' : '向下');
console.log('1年高/低:', sr1yHigh.toFixed(0), '/', sr1yLow.toFixed(0), '  现价距1年低点', ((srLast.close - sr1yLow) / sr1yLow * 100).toFixed(1) + '%');
console.log('3年高/低:', sr3yHigh.toFixed(0), '/', sr3yLow.toFixed(0), '  现价距3年高点', ((sr3yHigh - srLast.close) / sr3yHigh * 100).toFixed(1) + '%');
// 近30日涨幅
const sr30ago = sr[sr.length - 31]?.close;
console.log('近30日涨幅:', ((srLast.close - sr30ago) / sr30ago * 100).toFixed(1) + '%');

// 600737
const st = loadCsv('600737_daily.csv', ['date', 'close', 'volume', 'amount']).map(x => ({ ...x, close: +x.close, volume: +x.volume }));
const stLast = st[st.length - 1];
const st20 = ma(st, 20), st60 = ma(st, 60);
const stClose = st.map(x => x.close);
const stHigh = Math.max(...stClose), stLow = Math.min(...stClose);
const cost = 13.3;
console.log('\n========== 600737 中粮糖业 ==========');
console.log('最新:', stLast.date, '收盘', stLast.close.toFixed(2), '  成本', cost, '  盈亏', ((stLast.close - cost) / cost * 100).toFixed(1) + '%');
console.log('MA20/MA60:', st20[st20.length - 1].toFixed(2), '/', st60[st60.length - 1].toFixed(2), '  价在MA20', stLast.close > st20[st20.length - 1] ? '上方' : '下方');
console.log('3年最高/最低:', stHigh.toFixed(2), '/', stLow.toFixed(2));
console.log('近10日:', st.slice(-10).map(x => x.date.slice(5) + ':' + x.close).join(' '));

// ICE
const ice = loadCsv('ICE_sugar_daily.csv', ['date', 'close']).map(x => ({ ...x, close: +x.close }));
if (ice.length) {
  const iceLast = ice[ice.length - 1];
  const ice20 = ma(ice, 20);
  const ice1y = ice.filter(x => x.date >= '2025-08-21');
  console.log('\n========== ICE 原糖 ==========');
  console.log('最新:', iceLast.date, '收盘', iceLast.close.toFixed(2), '  MA20:', ice20[ice20.length - 1].toFixed(2));
  console.log('1年高/低:', Math.max(...ice1y.map(x => x.close)).toFixed(2), '/', Math.min(...ice1y.map(x => x.close)).toFixed(2));
  console.log('近10日:', ice.slice(-10).map(x => x.date.slice(5) + ':' + x.close).join(' '));
}

// ONI
const oniText = fs.readFileSync(path.join(D, 'ONI_enso.txt'), 'utf8');
const oniLines = oniText.trim().split('\n').filter(l => l.trim() && !/^\s*SEAS/.test(l));
const oni = oniLines.map(l => {
  const p = l.trim().split(/\s+/);
  return { seas: p[0], year: +p[1], anom: +p[3] };
});
const recentOni = oni.slice(-14);
console.log('\n========== ONI 厄尔尼诺/拉尼娜 ==========');
for (const o of recentOni) {
  const tag = o.anom >= 0.5 ? 'El Nino' : (o.anom <= -0.5 ? 'La Nina' : '中性');
  console.log(`${o.seas} ${o.year}: ${o.anom >= 0 ? '+' : ''}${o.anom.toFixed(2)}  [${tag}]`);
}
const lastOni = oni[oni.length - 1];
console.log('\n结论: 最新ONI', lastOni.seas, lastOni.year, '=', lastOni.anom.toFixed(2), lastOni.anom >= 0.5 ? '→ 已进入厄尔尼诺状态' : (lastOni.anom <= -0.5 ? '→ 拉尼娜状态' : '→ 中性'));
