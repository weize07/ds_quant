// 抓糖协"产销数据"栏目，找最新文章
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
  const r = await get('http://www.chinasugar.org.cn/l,46,0.html');
  console.log('status', r.s, 'len', r.b.length);
  if (r.s !== 200) return;
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{5,100})<\/a>/gi;
  let m;
  while ((m = re.exec(r.b))) {
    if (/产销|库存|销糖|制糖期|数据/.test(m[2])) links.push({ url: m[1], title: m[2].trim() });
  }
  console.log('产销文章:', links.length);
  links.slice(0, 10).forEach(l => console.log('  ·', l.title.slice(0, 70), '→', l.url.slice(0, 70)));
})();
