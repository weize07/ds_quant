// 验证糖协产销文章正文可解析 + 找最新文章
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
  // 1. 验证已知文章正文（2024-01 产销数据）
  console.log('=== 已知文章正文验证 ===');
  const r = await get('http://www.chinasugar.org.cn/i,35,4493,0.html');
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  const idx = txt.indexOf('制糖期全国食糖产销');
  console.log('正文附近:', idx >= 0 ? txt.slice(idx, idx + 400) : txt.slice(1000, 1500));

  // 2. 列表页找最新文章
  console.log('\n=== 列表页文章 ===');
  const r2 = await get('http://www.chinasugar.org.cn/l,35,0.html');
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{5,100})<\/a>/gi;
  let m;
  while ((m = re.exec(r2.b))) links.push({ url: m[1], title: m[2].trim() });
  const prod = links.filter(l => /产销|销糖|制糖期/.test(l.title));
  console.log('产销文章:', prod.length);
  prod.slice(0, 8).forEach(l => console.log('  ·', l.title.slice(0, 70), '→', l.url.slice(0, 60)));
})();
