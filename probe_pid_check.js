// 仔细检查 investing.com 各 pid 的字段结构和价格，识别糖11号
const https = require('https');
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'domain-id': 'www' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR' }));
  });
}

(async () => {
  for (const pid of [8830, 8831, 1025157, 8832]) {
    await sleep(10000);
    const u = `https://api.investing.com/api/financialdata/historical/${pid}?start-date=2026-01-01&end-date=2026-08-22&time-frame=Daily&add-missing-rows=false`;
    const r = await get(u);
    if (r.s !== 200) { console.log('pid', pid, '→ status', r.s); continue; }
    try {
      const j = JSON.parse(r.b);
      const rows = j.data || [];
      if (!rows.length) { console.log('pid', pid, '→ 空'); continue; }
      const keys = Object.keys(rows[0]);
      const last = rows[rows.length - 1];
      const first = rows[0];
      // 打印 last_close 和 last_closeRaw 的值
      console.log('pid', pid, 'rows', rows.length);
      console.log('  字段:', keys.join(','));
      console.log('  首行(last_close):', first.last_close, '| last_closeRaw:', first.last_closeRaw, '| 日期:', first.rowDate);
      console.log('  末行(last_close):', last.last_close, '| last_closeRaw:', last.last_closeRaw, '| 日期:', last.rowDate);
    } catch (e) { console.log('pid', pid, '→ parse err', r.b.slice(0, 80)); }
  }
})();
