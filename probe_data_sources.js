// 探测：沐甜科技 现货价格 / 中国糖协 / 海关
const https = require('https');
const http = require('http');
function get(url, headers) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location, headers).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  console.log('=== 沐甜科技首页 ===');
  const r1 = await get('https://www.msweet.com.cn/');
  console.log('status', r1.s, 'len', r1.b.length);
  if (r1.s === 200) {
    // 找现货/报价相关链接
    const links = r1.b.match(/href="([^"]*)"[^>]*>([^<]*现货[^<]*|[\s\S]{0,20}现货[\s\S]{0,20})/gi);
    if (links) links.slice(0, 8).forEach(l => console.log('  ', l.slice(0, 100)));
    else console.log('  未找到现货链接，标题:', (r1.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
  }

  console.log('\n=== 中国糖协 ===');
  const r2 = await get('http://www.sugarinfo.cn/');
  console.log('status', r2.s, 'len', r2.b.length, '标题:', (r2.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
  if (r2.s === 200) {
    const links = r2.b.match(/href="([^"]*)"[^>]*>([^<]*(?:产销|库存|糖|旬)[^<]*)/gi);
    if (links) links.slice(0, 6).forEach(l => console.log('  ', l.slice(0, 90)));
  }

  console.log('\n=== 海关总署 ===');
  const r3 = await get('http://www.customs.gov.cn/');
  console.log('status', r3.s, 'len', r3.b.length, '标题:', (r3.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
})();
