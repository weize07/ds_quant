// =============================================================================
// 中粮糖业 600737 每日监控 + 糖周期反转概率打分
// 用法:
//   node monitor.js            # 抓最新数据 + 打分 + 生成信号卡
//   node monitor.js --offline  # 只用本地 data/ 缓存，不联网
// 输出:
//   reports/YYYY-MM-DD.md      # 每日信号卡
//   reports/history.csv        # 打分历史（追加）
// =============================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const REPORTS = path.join(ROOT, 'reports');
const OFFLINE = process.argv.includes('--offline');

// ===================== 可配置参数（按你的情况调） =====================
const CONFIG = {
  cost: 13.3,                  // 持仓成本
  sugarConfirmLevel: 5688,     // 郑糖反转确认位（1年高点，突破=反转确认）
  sugarFalsifyLevel: 5053,     // 郑糖证伪位（1年低点，跌破=反转证伪）
  stopLossHalf: 12.64,         // 成本-5% 减半线
  stopLossFull: 12.24,         // 成本-8% 清仓线
  weights: { enso: 0.20, sugar: 0.30, imp: 0.15, stock: 0.20, position: 0.15 },
  zones: { add: 70, hold: 45 }, // ≥70加仓区, 45~70持有区, <45减仓区
  // 配额外进口成本估算参数（精确值以沐甜科技每日"进口糖升贴水运费加工成本"为准）
  importTariff: 1.5,    // 配额外关税50%（系数1.5）
  sugarYield: 0.92,     // 原糖→白糖出糖率92%（损耗8%）
  importFee: 550        // 加工费+运费（元/吨，估算）
};

// ===================== 工具函数 =====================
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function get(url, opts = {}) {
  const headers = { 'User-Agent': 'Mozilla/5.0', ...(opts.headers || {}) };
  const retries = opts.retries !== undefined ? opts.retries : 3;
  return new Promise((resolve) => {
    const attempt = (n) => {
      const req = https.get(url, { timeout: 30000, headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { get(res.headers.location, { retries: 0 }).then(resolve); return; }
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          if (d.length === 0 && n > 0) setTimeout(() => attempt(n - 1), 1500); // 空响应重试
          else resolve({ status: res.statusCode, body: d });
        });
      });
      req.on('timeout', () => { req.destroy(); if (n > 0) setTimeout(() => attempt(n - 1), 1500); else resolve({ status: 0, body: '' }); });
      req.on('error', () => { if (n > 0) setTimeout(() => attempt(n - 1), 1500); else resolve({ status: 0, body: '' }); });
    };
    attempt(retries);
  });
}

function ma(values, n) {
  const out = new Array(values.length).fill(null);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i];
    if (i >= n) s -= values[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

function percentile(sorted, v) {
  return sorted.filter(x => x <= v).length / sorted.length * 100;
}

// ===================== 数据抓取 =====================
async function fetch600737() {
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.600737&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&beg=20230101&end=20500101';
  const r = await get(url);
  const j = JSON.parse(r.body);
  return j.data.klines.map(k => {
    const p = k.split(',');
    return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], volume: +p[5], amount: +p[6] };
  });
}

async function fetchSR0() {
  const url = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_SR0=/InnerFuturesNewService.getDailyKLine?symbol=SR0';
  const r = await get(url);
  const m = r.body.match(/var _SR0=\((.*)\)\s*;?\s*$/s);
  const arr = JSON.parse(m[1]);
  return arr.map(k => ({ date: k.d, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v, position: +k.p, settle: +k.s }));
}

async function fetchONI() {
  const url = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
  const r = await get(url);
  return r.body.trim().split('\n').filter(l => l.trim() && !/^\s*SEAS/.test(l)).map(l => {
    const p = l.trim().split(/\s+/);
    return { seas: p[0], year: +p[1], anom: +p[3] };
  });
}

async function fetchICE() {
  // 糖11号(ICE原糖)：当月连续 SB00Y 优先，2610合约 SB26V 备选
  for (const secid of ['108.SB00Y', '108.SB26V']) {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secid + '&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&beg=20180101&end=20500101';
    const r = await get(url);
    try {
      const j = JSON.parse(r.body);
      if (j.data && j.data.klines && j.data.klines.length > 0) {
        return j.data.klines.map(k => {
          const p = k.split(',');
          return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], volume: +p[5], amount: +p[6] };
        });
      }
    } catch (e) { /* 试下一个 */ }
  }
  throw new Error('ICE原糖抓取失败');
}

async function fetchICEquote() {
  // 东财实时接口兜底（push2his 历史接口限流时用），返回当前价
  const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=108.SB00Y&fields=f43,f57,f58,f60';
  const r = await get(url);
  const j = JSON.parse(r.body);
  if (j.data && j.data.f43 && +j.data.f43 > 0) {
    return { date: new Date().toISOString().slice(0, 10), close: +(j.data.f43) / 100, name: j.data.f58 };
  }
  throw new Error('ICE实时报价失败');
}

async function fetchFX() {
  // 新浪 USD/CNY，返回中间参考价（约6.72）
  const url = 'https://hq.sinajs.cn/list=fx_susdcny';
  const r = await get(url, { headers: { 'Referer': 'https://finance.sina.com.cn' } });
  const m = r.body.match(/"([^"]*)"/);
  if (!m) throw new Error('汇率解析失败');
  const p = m[1].split(',');
  const fx = parseFloat(p[3]); // 第3字段为参考价/昨收
  if (!fx || fx <= 0) throw new Error('汇率数值异常');
  return fx;
}

function readCached(fname) {
  const p = path.join(DATA, fname);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

async function loadData() {
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
  let st = null, sr = null, oni = null, ice = null, fx = null;
  const warns = [];

  if (!OFFLINE) {
    try { st = await fetch600737(); fs.writeFileSync(path.join(DATA, '600737_daily.csv'), 'date,open,close,high,low,volume,amount\n' + st.map(x => [x.date, x.open, x.close, x.high, x.low, x.volume, x.amount].join(',')).join('\n')); } catch (e) { warns.push('600737抓取失败:' + e.message); }
    try { sr = await fetchSR0(); fs.writeFileSync(path.join(DATA, 'SR0_daily.csv'), 'date,open,high,low,close,volume,position,settle\n' + sr.map(x => [x.date, x.open, x.high, x.low, x.close, x.volume, x.position, x.settle].join(',')).join('\n')); } catch (e) { warns.push('郑糖抓取失败:' + e.message); }
    try { oni = await fetchONI(); fs.writeFileSync(path.join(DATA, 'ONI_enso.txt'), 'SEAS YR TOTAL ANOM\n' + oni.map(x => `${x.seas} ${x.year} 0 ${x.anom}`).join('\n')); } catch (e) { warns.push('ONI抓取失败:' + e.message); }
    try { ice = await fetchICE(); fs.writeFileSync(path.join(DATA, 'ICE_sugar_daily.csv'), 'date,open,close,high,low,volume,amount\n' + ice.map(x => [x.date, x.open, x.close, x.high, x.low, x.volume, x.amount].join(',')).join('\n')); } catch (e) { try { const q = await fetchICEquote(); ice = [q]; warns.push('ICE历史限流，改用实时报价'); } catch (e2) { warns.push('ICE抓取失败:' + e.message); } }
    try { fx = await fetchFX(); fs.writeFileSync(path.join(DATA, 'fx_usdcny.json'), JSON.stringify({ usdcny: fx, date: new Date().toISOString().slice(0, 10) })); } catch (e) { warns.push('汇率抓取失败:' + e.message); }
  }

  if (!st) { const c = readCached('600737_daily.csv'); if (c) { const l = c.trim().split('\n').slice(1); st = l.map(x => { const p = x.split(','); return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], volume: +p[5], amount: +p[6] }; }); warns.push('600737使用缓存'); } }
  if (!sr) { const c = readCached('SR0_daily.csv'); if (c) { const l = c.trim().split('\n').slice(1); sr = l.map(x => { const p = x.split(','); return { date: p[0], open: +p[1], high: +p[2], low: +p[3], close: +p[4], volume: +p[5], position: +p[6], settle: +p[7] }; }); warns.push('郑糖使用缓存'); } }
  if (!oni) { const c = readCached('ONI_enso.txt'); if (c) { oni = c.trim().split('\n').filter(l => l.trim() && !/^\s*SEAS/.test(l)).map(l => { const p = l.trim().split(/\s+/); return { seas: p[0], year: +p[1], anom: +p[3] }; }); warns.push('ONI使用缓存'); } }
  if (!ice) { const c = readCached('ICE_sugar_daily.csv'); if (c) { const l = c.trim().split('\n').slice(1); ice = l.filter(x => x.split(',')[2] && +x.split(',')[2] > 0).map(x => { const p = x.split(','); return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], volume: +p[5], amount: +p[6] }; }); if (ice.length) warns.push('ICE使用缓存'); } }
  if (!fx) { const c = readCached('fx_usdcny.json'); if (c) { try { fx = JSON.parse(c).usdcny; warns.push('汇率使用缓存'); } catch (e) {} } }
  if (!fx) { fx = 7.0; warns.push('汇率用默认值7.0'); }

  return { st, sr, oni, ice, fx, warns };
}

// ===================== 打分模型（校准版） =====================
// 反转概率 = 各维度"确认度"加权。核心原则：价格确认位是门控——
// 郑糖没突破确认位5688就压低分数，跌破证伪位5053就封顶，防止基本面信号把概率顶得太虚高。

function scoreENSO(oni) {
  const last = oni[oni.length - 1];
  const prev3 = oni[oni.length - 4]; // 3季前（约3个月）
  // 基于 IC 检验：厄尔尼诺状态（≥0.5）是长期（12个月）利多信号，IC +0.205，历史未来12月 +9.0%
  let s = 50;
  if (last.anom >= 1.0) s = 80;        // 强厄尔尼诺（未来12月 +10.8%）
  else if (last.anom >= 0.5) s = 72;   // 厄尔尼诺（未来12月 +9.0%）
  else if (last.anom >= 0.3) s = 58;   // 偏暖
  else if (last.anom >= -0.3) s = 50;  // 中性
  else if (last.anom >= -0.5) s = 42;  // 偏冷
  else s = 25;                          // 拉尼娜（未来12月偏空）
  // 暖化速率：短期（3-6个月）反向信号，单独提示，不混入长期分
  const warmingRate = prev3 ? +(last.anom - prev3.anom).toFixed(2) : 0;
  const warmFast = warmingRate > 0.5;
  return { score: clamp(s, 0, 100), last, warmingRate, warmFast };
}

function scoreSugar(sr) {
  const n = sr.length;
  const last = sr[n - 1];
  const closes = sr.map(x => x.close);
  const m20 = ma(closes, 20), m60 = ma(closes, 60), m250 = ma(closes, 250);
  const ma20 = m20[n - 1], ma60 = m60[n - 1], ma250 = m250[n - 1], ma20_5 = m20[n - 6] || ma20;
  let s = 50;
  const reasons = [];
  const push = (d, t) => { s += d; reasons.push(`${d > 0 ? '+' : ''}${d} ${t}`); };

  if (last.close > ma20) push(3, '价在MA20上方'); else push(-3, '价在MA20下方');
  if (ma20 > ma20_5) push(3, 'MA20向上'); else push(-3, 'MA20向下');
  if (last.close > ma60) push(3, '价在MA60上方'); else push(-3, '价在MA60下方');
  if (ma20 > ma60) push(3, 'MA20>MA60'); else push(-3, 'MA20<MA60');

  const mom20 = (last.close - closes[n - 21]) / closes[n - 21];
  if (mom20 > 0.05) push(8, `20日动量+${(mom20 * 100).toFixed(1)}%(强)`);
  else if (mom20 > 0) push(4, `20日动量+${(mom20 * 100).toFixed(1)}%`);
  else if (mom20 > -0.05) push(-4, `20日动量${(mom20 * 100).toFixed(1)}%`);
  else push(-8, `20日动量${(mom20 * 100).toFixed(1)}%(弱)`);

  // 关键位门控
  if (last.close > CONFIG.sugarConfirmLevel) push(25, `✅突破确认位${CONFIG.sugarConfirmLevel}`);
  else if (last.close < CONFIG.sugarFalsifyLevel) push(-35, `🔴跌破证伪位${CONFIG.sugarFalsifyLevel}`);
  else push(-3, `未突破确认位${CONFIG.sugarConfirmLevel}(差${(CONFIG.sugarConfirmLevel - last.close).toFixed(0)})`);

  return { score: clamp(s, 0, 100), ma20, ma60, ma250, mom20, reasons, last };
}

function computeImportParity(ice, fx, sr) {
  // 配额外进口估算成本 + 利润率历史序列 + 250日 z-score
  // 汇率用当前值近似（汇率波动远小于ICE波动，z-score 主要反映ICE/郑糖相对变动）
  const srMap = new Map(sr.map(x => [x.date, x.close]));
  const margins = [];
  for (const it of ice) {
    if (!srMap.has(it.date)) continue;
    const cost = it.close * 22.0462 * fx * CONFIG.importTariff / CONFIG.sugarYield + CONFIG.importFee;
    margins.push({ date: it.date, cost, margin: (srMap.get(it.date) - cost) / cost });
  }
  if (!margins.length) return null;
  const last = margins[margins.length - 1];
  const importCost = last.cost;
  const margin = last.margin;
  const profit = srMap.get(last.date) - importCost;
  const iceLast = ice[ice.length - 1].close;

  let zscore = null;
  if (margins.length >= 250) {
    const seg = margins.slice(-250).map(x => x.margin);
    const mean = seg.reduce((a, b) => a + b, 0) / 250;
    const std = Math.sqrt(seg.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 250);
    zscore = std === 0 ? 0 : (margin - mean) / std;
  }
  const margin5ago = margins.length > 6 ? margins[margins.length - 6].margin : null;

  return { iceLast, importCost, margin, profit, margin5ago, zscore, histLen: margins.length };
}

function scoreImport(parity) {
  // 基于 IC 检验：利润率 z-score 是均值回归因子（IC -0.28~-0.37）
  // z-score 高（利润率异常偏高→进口冲击）→未来跌→低分
  // z-score 低（利润率异常偏低/倒挂→进口放缓→内盘补涨）→未来涨→高分
  const z = parity.zscore;
  const reasons = [];
  let s = 50;
  if (z == null) {
    s = clamp(50 - parity.margin * 400, 10, 90);
    reasons.push(`利润率${(parity.margin * 100).toFixed(1)}%（无历史，用原始值）`);
  } else {
    s = clamp(50 - z * 12, 10, 90);
    const tag = z < -1.5 ? '极低→进口利润压缩→偏多' : (z > 1.5 ? '极高→进口冲击→偏空' : '中性');
    reasons.push(`利润率z-score ${z >= 0 ? '+' : ''}${z.toFixed(2)}（${tag}）`);
    reasons.push(`当前利润率${(parity.margin * 100).toFixed(1)}%，进口成本${parity.importCost.toFixed(0)}元/吨`);
  }
  if (parity.margin5ago !== null) {
    const d = parity.margin - parity.margin5ago;
    if (d < -0.02) { s += 3; reasons.push(`5日利润率收窄（外盘抬成本传导中）`); }
    else if (d > 0.02) { s -= 3; reasons.push(`5日利润率扩大`); }
  }
  return { score: clamp(s, 0, 100), reasons, ...parity };
}

function scoreStock(st) {
  const n = st.length;
  const last = st[n - 1];
  const closes = st.map(x => x.close);
  const m20 = ma(closes, 20), m60 = ma(closes, 60);
  const ma20 = m20[n - 1], ma60 = m60[n - 1], ma20_5 = m20[n - 6] || ma20;
  let s = 50;
  const reasons = [];
  const push = (d, t) => { s += d; reasons.push(`${d > 0 ? '+' : ''}${d} ${t}`); };

  if (last.close > ma20) push(3, '价在MA20上方'); else push(-3, '价在MA20下方');
  if (last.close > ma60) push(3, '价在MA60上方'); else push(-3, '价在MA60下方');
  if (ma20 > ma60) push(3, 'MA20>MA60'); else push(-3, 'MA20<MA60');
  if (ma20 > ma20_5) push(3, 'MA20向上'); else push(-3, 'MA20向下');

  const mom20 = (last.close - closes[n - 21]) / closes[n - 21];
  if (mom20 > 0.05) push(6, `20日动量+${(mom20 * 100).toFixed(1)}%`); else if (mom20 < -0.05) push(-6, `20日动量${(mom20 * 100).toFixed(1)}%`); else push(0, `20日动量${(mom20 * 100).toFixed(1)}%`);

  const dayChg = (last.close - closes[n - 2]) / closes[n - 2];
  if (dayChg < -0.05) push(-10, `最近一日${(dayChg * 100).toFixed(1)}%(大跌惩罚)`);

  const distStop = (last.close - CONFIG.stopLossFull) / CONFIG.stopLossFull;
  if (distStop > 0.20) push(6, `距清仓线${(distStop * 100).toFixed(0)}%`);
  else if (distStop > 0.10) push(3, `距清仓线${(distStop * 100).toFixed(0)}%`);
  else if (distStop <= 0.05) push(-8, `距清仓线${(distStop * 100).toFixed(0)}%(危险)`);

  return { score: clamp(s, 0, 100), ma20, ma60, mom20, dayChg, reasons, last, distStop };
}

function scorePosition(sr) {
  const closes = sr.map(x => x.close).sort((a, b) => a - b);
  const pct = percentile(closes, sr[sr.length - 1].close);
  return { score: clamp(100 - pct, 0, 100), pct }; // 越低分位=越便宜=上行空间越大
}

// ===================== 风控检查 =====================
function riskCheck(st) {
  const last = st[st.length - 1];
  const alerts = [];
  if (last.close <= CONFIG.stopLossFull) alerts.push('🔴 跌破清仓线 ' + CONFIG.stopLossFull + ' → 无条件清仓');
  else if (last.close <= CONFIG.stopLossHalf) alerts.push('🟠 跌破减半线 ' + CONFIG.stopLossHalf + ' → 减仓至10%以下');
  const closes = st.map(x => x.close);
  const recentHigh = Math.max(...closes.slice(-60));
  const drawdown = (recentHigh - last.close) / recentHigh;
  if (drawdown > 0.12) alerts.push('🟠 距60日高点回撤' + (drawdown * 100).toFixed(1) + '% → 移动止盈减半');
  return { alerts, drawdown, recentHigh };
}

// ===================== 报告生成 =====================
async function main() {
  const { st, sr, oni, ice, fx, warns } = await loadData();
  if (!st || !sr || !oni) { console.error('数据不完整，无法打分'); return; }

  const e = scoreENSO(oni);
  const su = scoreSugar(sr);
  const ip = (ice && ice.length > 0) ? computeImportParity(ice, fx, sr) : null;
  const im = ip ? scoreImport(ip) : null;
  const sk = scoreStock(st);
  const po = scorePosition(sr);
  const risk = riskCheck(st);

  const W = CONFIG.weights;
  let prob = W.enso * e.score + W.sugar * su.score + W.stock * sk.score + W.position * po.score;
  prob += im ? W.imp * im.score : W.imp * 50; // 进口数据缺失按中性50计，保证权重和=1
  prob = clamp(prob, 0, 100);

  // 价格确认门控（关键）：郑糖是否突破确认位/跌破证伪位，直接决定反转概率上下限
  const srClose = su.last.close;
  let gateNote = '';
  if (srClose > CONFIG.sugarConfirmLevel) { prob = Math.max(prob, CONFIG.zones.add + 2); gateNote = `郑糖已突破确认位${CONFIG.sugarConfirmLevel}，反转概率保底${CONFIG.zones.add + 2}%`; }
  if (srClose < CONFIG.sugarFalsifyLevel) { prob = Math.min(prob, CONFIG.zones.hold - 5); gateNote = `郑糖已跌破证伪位${CONFIG.sugarFalsifyLevel}，反转概率封顶${CONFIG.zones.hold - 5}%`; }

  let signal, action;
  if (risk.alerts.some(a => a.includes('🔴'))) { signal = '🔴 清仓'; action = risk.alerts.find(a => a.includes('🔴')); }
  else if (prob >= CONFIG.zones.add) { signal = '🟢 加仓区'; action = `反转概率≥${CONFIG.zones.add}%，趋势确认，可择机加仓`; }
  else if (prob >= CONFIG.zones.hold) { signal = '🟡 持有观察区'; action = '反转概率中等，持有为主，等待突破' + CONFIG.sugarConfirmLevel + '确认或跌破' + CONFIG.sugarFalsifyLevel + '证伪'; }
  else { signal = '🟠 减仓区'; action = '反转概率偏低，趋势走弱，逢反弹减仓'; }

  const asOf = su.last.date;
  const lines = [];
  lines.push(`# 中粮糖业 600737 每日信号卡`);
  lines.push(``);
  lines.push(`- 数据日期：${asOf}`);
  lines.push(`- 生成时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`);
  lines.push(`- 持仓成本：${CONFIG.cost} 元（当前${(((sk.last.close - CONFIG.cost) / CONFIG.cost) * 100).toFixed(1)}%）`);
  lines.push(``);
  lines.push(`## 结论`);
  lines.push(``);
  lines.push(`**反转概率：${prob.toFixed(1)}%  →  ${signal}**`);
  lines.push(``);
  lines.push(`> ${action}`);
  if (gateNote) { lines.push(`>`); lines.push(`> ⚙️ 门控：${gateNote}`); }
  lines.push(``);
  lines.push(`## 打分明细`);
  lines.push(``);
  lines.push(`| 维度 | 权重 | 得分 | 关键信号 |`);
  lines.push(`|------|------|------|----------|`);
  lines.push(`| 厄尔尼诺(ENSO) | ${W.enso * 100}% | ${e.score.toFixed(0)} | ONI ${e.last.seas} ${e.last.year} = ${e.last.anom >= 0 ? '+' : ''}${e.last.anom.toFixed(2)}，暖化速率${e.warmingRate >= 0 ? '+' : ''}${e.warmingRate} |`);
  lines.push(`| 郑糖趋势 | ${W.sugar * 100}% | ${su.score.toFixed(0)} | 收盘${su.last.close.toFixed(0)}，MA20 ${su.ma20.toFixed(0)} |`);
  lines.push(`| 内外价差/进口利润 | ${W.imp * 100}% | ${im ? im.score.toFixed(0) : '-'} | ${im ? 'z-score ' + (im.zscore != null ? (im.zscore >= 0 ? '+' : '') + im.zscore.toFixed(2) : '—') + '，利润率' + (im.margin * 100).toFixed(1) + '%' : '数据缺失'} |`);
  lines.push(`| 股价趋势 | ${W.stock * 100}% | ${sk.score.toFixed(0)} | 收盘${sk.last.close.toFixed(2)}，MA20 ${sk.ma20.toFixed(2)} |`);
  lines.push(`| 位置(历史分位) | ${W.position * 100}% | ${po.score.toFixed(0)} | 郑糖${po.pct.toFixed(1)}%分位 |`);
  lines.push(``);
  lines.push(`### 郑糖趋势分解`);
  lines.push(``);
  for (const r of su.reasons) lines.push(`- ${r}`);
  lines.push(``);
  if (im) {
    lines.push(`### 内外价差/进口利润分解`);
    lines.push(``);
    for (const r of im.reasons) lines.push(`- ${r}`);
    lines.push(``);
  }
  lines.push(`### 股价趋势分解`);
  lines.push(``);
  for (const r of sk.reasons) lines.push(`- ${r}`);
  lines.push(``);
  lines.push(`## 关键数据快照`);
  lines.push(``);
  lines.push(`| 数据 | 最新值 |`);
  lines.push(`|------|--------|`);
  lines.push(`| 郑糖主力收盘 | ${su.last.close.toFixed(0)} 元/吨（${su.last.date}） |`);
  lines.push(`| 郑糖MA20/MA60/MA250 | ${su.ma20.toFixed(0)} / ${su.ma60.toFixed(0)} / ${su.ma250 ? su.ma250.toFixed(0) : '-'} |`);
  lines.push(`| 郑糖历史分位 | ${po.pct.toFixed(1)}%（20年区间2807~7548） |`);
  lines.push(`| 中粮糖业收盘 | ${sk.last.close.toFixed(2)} 元（${sk.last.date}） |`);
  lines.push(`| 股价MA20/MA60 | ${sk.ma20.toFixed(2)} / ${sk.ma60.toFixed(2)} |`);
  lines.push(`| ONI 最新 | ${e.last.seas} ${e.last.year} = ${e.last.anom >= 0 ? '+' : ''}${e.last.anom.toFixed(2)} ${e.last.anom >= 0.5 ? '（厄尔尼诺）' : (e.last.anom <= -0.5 ? '（拉尼娜）' : '（中性）')} |`);
  lines.push(`| ICE原糖收盘 | ${ip ? ip.iceLast.toFixed(2) + ' 美分/磅' : '数据缺失'} |`);
  lines.push(`| USD/CNY 汇率 | ${fx.toFixed(4)} |`);
  lines.push(`| 配额外进口成本 | ${ip ? ip.importCost.toFixed(0) + ' 元/吨' : '-'} |`);
  lines.push(`| 进口利润率(配额外) | ${ip ? (ip.margin >= 0 ? '+' : '') + (ip.margin * 100).toFixed(1) + '%' + (ip.margin < 0 ? '（倒挂）' : '（有利润）') : '-'} |`);
  lines.push(`| 利润率z-score(250日) | ${ip && ip.zscore != null ? (ip.zscore >= 0 ? '+' : '') + ip.zscore.toFixed(2) + (ip.zscore < -1.5 ? '（极低，偏多）' : (ip.zscore > 1.5 ? '（极高，偏空）' : '（中性）')) : '—'} |`);
  lines.push(``);
  lines.push(`## 关键阈值监控`);
  lines.push(``);
  lines.push(`| 阈值 | 数值 | 当前状态 |`);
  lines.push(`|------|------|----------|`);
  lines.push(`| 郑糖反转确认位 | ${CONFIG.sugarConfirmLevel} | ${srClose > CONFIG.sugarConfirmLevel ? '✅ 已突破' : '⏳ 未突破(差' + (CONFIG.sugarConfirmLevel - srClose).toFixed(0) + ')'} |`);
  lines.push(`| 郑糖证伪位 | ${CONFIG.sugarFalsifyLevel} | ${srClose < CONFIG.sugarFalsifyLevel ? '🔴 已跌破' : '✅ 未跌破(距' + (srClose - CONFIG.sugarFalsifyLevel).toFixed(0) + ')'} |`);
  lines.push(`| 股价减半线 | ${CONFIG.stopLossHalf} | ${sk.last.close < CONFIG.stopLossHalf ? '🔴 已跌破' : '✅ 未跌破'} |`);
  lines.push(`| 股价清仓线 | ${CONFIG.stopLossFull} | ${sk.last.close < CONFIG.stopLossFull ? '🔴 已跌破' : '✅ 未跌破(距' + ((sk.last.close - CONFIG.stopLossFull) / CONFIG.stopLossFull * 100).toFixed(1) + '%)'} |`);
  lines.push(``);
  if (e.warmFast) {
    lines.push(`## ⚠️ 短期风险提示（厄尔尼诺快速变暖）`);
    lines.push(``);
    lines.push(`- ONI 暖化速率 ${e.warmingRate}，历史数据显示快速变暖后未来 3-6 个月糖价倾向回调（IC -0.23）`);
    lines.push(`- 厄尔尼诺的利多兑现点在约 12 个月后（历史未来12月 +9.0%），短期不宜追高`);
    lines.push(``);
  }
  if (risk.alerts.length) {
    lines.push(`## ⚠️ 风控警报`);
    lines.push(``);
    for (const a of risk.alerts) lines.push(`- ${a}`);
    lines.push(``);
  }
  if (warns.length) {
    lines.push(`## 数据源提示`);
    lines.push(``);
    for (const w of warns) lines.push(`- ${w}`);
    lines.push(``);
  }

  const report = lines.join('\n');
  if (!fs.existsSync(REPORTS)) fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, asOf + '.md'), report);

  const hist = path.join(REPORTS, 'history.csv');
  const header = 'date,enso_score,sugar_score,import_score,stock_score,position_score,reversal_prob,signal,sr_close,st_close,ice_close,oni\n';
  if (!fs.existsSync(hist)) fs.writeFileSync(hist, header);
  fs.appendFileSync(hist, [asOf, e.score.toFixed(0), su.score.toFixed(0), im ? im.score.toFixed(0) : '', sk.score.toFixed(0), po.score.toFixed(0), prob.toFixed(1), signal, su.last.close.toFixed(0), sk.last.close.toFixed(2), ip ? ip.iceLast.toFixed(2) : '', e.last.anom.toFixed(2)].join(',') + '\n');

  console.log('========== 中粮糖业信号卡 ' + asOf + ' ==========');
  console.log('反转概率: ' + prob.toFixed(1) + '%  →  ' + signal);
  console.log('打分: ENSO ' + e.score.toFixed(0) + ' | 郑糖 ' + su.score.toFixed(0) + ' | 进口 ' + (im ? im.score.toFixed(0) : '-') + ' | 股价 ' + sk.score.toFixed(0) + ' | 位置 ' + po.score.toFixed(0));
  console.log('郑糖 ' + su.last.close.toFixed(0) + ' (MA20 ' + su.ma20.toFixed(0) + ' MA60 ' + su.ma60.toFixed(0) + ') | 600737 ' + sk.last.close.toFixed(2) + ' (MA20 ' + sk.ma20.toFixed(2) + ') | ONI ' + e.last.seas + ' ' + e.last.anom.toFixed(2));
  console.log('报告已写入: reports/' + asOf + '.md');
  if (risk.alerts.length) { console.log('⚠️ 风控警报:'); risk.alerts.forEach(a => console.log('  ' + a)); }
}

main().catch(e => { console.error('运行失败:', e); process.exit(1); });
