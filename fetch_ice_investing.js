// 温和探测 investing.com 糖11号的正确 pair_id（价格区间 10~28 美分/磅）
const https = require('https');
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'domain-id': 'www' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  const candidates = [8830, 8831, 1025157, 1186965, 1186963, 8833, 8834];
  for (const pid of candidates) {
    await sleep(15000);
    const u = `https://api.investing.com/api/financialdata/historical/${pid}?start-date=2024-01-01&end-date=2026-08-22&time-frame=Daily&add-missing-rows=false`;
    const r = await get(u);
    if (r.s !== 200) { console.log('pid', pid, '→ 限流/失败 status', r.s); continue; }
    try {
      const j = JSON.parse(r.b);
      const rows = j.data || [];
      if (!rows.length) { console.log('pid', pid, '→ 空'); continue; }
      const closes = rows.map(x => x.last_close).filter(v => v != null && +v > 0).map(Number);
      const med = closes.length ? closes.sort((a, b) => a - b)[Math.floor(closes.length / 2)] : null;
      console.log('pid', pid, '→ rows', rows.length, '中位价', med);
      if (med != null && med > 5 && med < 40) {
        const lines = rows.map(x => {
          const d = x.rowDateRaw ? new Date(x.rowDateRaw * 1000).toISOString().slice(0, 10) : x.rowDate;
          return [d, x.last_close].join(',');
        }).filter(x => x.split(',')[1] && +x.split(',')[1] > 0);
        fs.writeFileSync(path.join(D, 'ICE_sugar_daily.csv'), 'date,close\n' + lines.join('\n'));
        console.log('★ 找到糖11号！pid=' + pid + '，已保存 ' + lines.length + ' 行（' + lines[0].split(',')[0] + ' ~ ' + lines[lines.length - 1].split(',')[0] + '）');
        console.log('  最新收盘', lines[lines.length - 1].split(',')[1]);
        return;
      }
    } catch (e) { console.log('pid', pid, '→ parse err'); }
  }
  console.log('未找到糖');
})();
