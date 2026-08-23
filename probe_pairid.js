// 从 investing.com 主页面提取糖11号的 pair_id
const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'en-US,en;q=0.9' } }, (res) => {
      if (res.statusCode >= 300 && res.headers.location) { get(res.headers.location).then(resolve); return; }
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  const r = await get('https://www.investing.com/commodities/us-sugar-no11');
  console.log('status', r.s, 'len', r.b.length);
  if (r.s !== 200) return;
  const ids = new Set();
  for (const m of r.b.matchAll(/pair[_I]?d["']?\s*[:=]\s*["']?(\d+)/gi)) ids.add(m[1]);
  for (const m of r.b.matchAll(/["'](\d+)["']\s*,\s*["']?pair/i)) ids.add(m[1]);
  const cid = r.b.match(/data-cid=["'](\d+)["']/i);
  console.log('pairId 候选:', [...ids].slice(0, 20).join(', '));
  console.log('data-cid:', cid ? cid[1] : '未找到');
  // 标题确认
  const title = r.b.match(/<title>([^<]*)<\/title>/i);
  console.log('标题:', title ? title[1].slice(0, 80) : '?');
})();
