// 后台温和重试 ICE 历史抓取（每5分钟单次请求，避免加重限流）
// 依次尝试：东财 push2his → investing.com API
const https = require('https');
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url, headers) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...(headers || {}) } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

async function tryEastmoney() {
  for (const secid of ['108.SB00Y', '108.SB26V']) {
    const u = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secid + '&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&beg=20180101&end=20500101';
    const r = await get(u);
    try {
      const j = JSON.parse(r.b);
      if (j.data && j.data.klines && j.data.klines.length > 100) {
        const k = j.data.klines;
        fs.writeFileSync(path.join(D, 'ICE_sugar_daily.csv'), 'date,open,close,high,low,volume,amount\n' + k.map(x => x.split(',').join(',')).join('\n'));
        console.log('✓ 东财成功', secid, k.length, '行');
        return true;
      }
    } catch (e) {}
  }
  return false;
}

(async () => {
  const MAX = 36; // 最多重试36次（3小时）
  for (let i = 1; i <= MAX; i++) {
    const ts = new Date().toISOString().slice(11, 19);
    const ok1 = await tryEastmoney();
    if (ok1) { console.log(ts, '第', i, '轮东财成功，退出'); process.exit(0); }
    console.log(ts, '第', i, '轮东财失败，5分钟后重试');
    await sleep(5 * 60 * 1000);
  }
  console.log('3小时未成功，放弃');
})();
