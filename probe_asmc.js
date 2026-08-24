// 探测 ASMC 月度区域天气回顾：泰国降雨/干旱数据
const https = require('https');
const http = require('http');
function get(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  // 1. 首页找最新回顾链接
  const home = await get('https://asmc.asean.org/');
  console.log('首页 status', home.s, 'len', home.b.length);
  const links = [];
  const re = /href="([^"]*review[^"]*)"[^>]*>([^<]{5,100})<\/a>/gi;
  let m;
  while ((m = re.exec(home.b))) links.push(m[1]);
  const reviewLinks = [...new Set(links)];
  console.log('回顾页链接:', reviewLinks.slice(0, 5));

  // 2. 试几个 URL 模式
  const candidates = reviewLinks.length ? reviewLinks.slice(0, 2) : [
    'https://asmc.asean.org/review-of-regional-weather-for-july-2026/',
    'https://asmc.asean.org/review-of-regional-weather-for-august-2026/'
  ];
  for (const u of candidates) {
    const full = u.startsWith('http') ? u : 'https://asmc.asean.org' + u;
    const r = await get(full);
    console.log('\n抓取:', full);
    console.log('status', r.s, 'len', r.b.length);
    if (r.s === 200) {
      const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
      // 找泰国相关
      const reT = /[^。；\n]{0,60}(?:Thailand|泰国|rainfall|drought|below.?normal|above.?normal)[^。；\n]{0,80}/gi;
      let mm, c = 0;
      while ((mm = reT.exec(txt)) && c < 8) { console.log('  ·', mm[0].trim().slice(0, 110)); c++; }
      if (c === 0) console.log('  未找到泰国/降雨片段，标题:', (r.b.match(/<title>([^<]*)<\/title>/i) || [])[1]);
    }
    await new Promise(res => setTimeout(res, 1500));
  }
})();
