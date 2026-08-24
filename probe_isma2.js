// 在 intsugar-tc 找印度 ISMA 产糖文章
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
  const r = await get('http://www.intsugar-tc.com/');
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{4,80})<\/a>/gi;
  let m;
  while ((m = re.exec(r.b))) links.push({ url: m[1], title: m[2].trim() });
  // 找印度/产糖/ISMA 相关
  const india = links.filter(l => /印度|ISMA|产糖/i.test(l.title)).slice(0, 10);
  console.log('首页印度相关链接:', india.length);
  india.forEach(l => console.log('  ·', l.title.slice(0, 70), '→', l.url.slice(0, 80)));

  // 找分类导航
  const nav = links.filter(l => /国际|资讯|数据|糖业/.test(l.title) && !l.url.includes('javascript')).slice(0, 10);
  console.log('\n分类导航:', nav.length);
  nav.forEach(l => console.log('  ·', l.title.slice(0, 40), '→', l.url.slice(0, 70)));
})();
