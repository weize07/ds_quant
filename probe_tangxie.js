// 探测 chinasugar.org.cn：找产销数据（产糖量/销糖率/库存）
const https = require('https');
const http = require('http');
function get(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, r => {
      if (r.statusCode >= 300 && r.headers.location) { get(r.headers.location).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  console.log('=== chinasugar.org.cn 首页 ===');
  const r = await get('http://www.chinasugar.org.cn/');
  console.log('status', r.s, 'len', r.b.length);
  if (r.s !== 200) return;
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{4,90})<\/a>/gi;
  let m;
  while ((m = re.exec(r.b))) links.push({ url: m[1], title: m[2].trim() });
  const prod = links.filter(l => /产销|库存|销糖|糖料/i.test(l.title)).slice(0, 10);
  console.log('产销相关链接:', prod.length);
  prod.forEach(l => console.log('  ·', l.title.slice(0, 60), '→', l.url.slice(0, 80)));
  if (!prod.length) console.log('  首页样例:', links.slice(0, 6).map(l => l.title.slice(0, 40)).join(' | '));
})();
