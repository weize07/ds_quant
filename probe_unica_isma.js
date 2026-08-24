// 探测 UNICA(巴西制糖比例) + ISMA(印度产量) 的发布结构
const https = require('https');
function get(url, headers) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location, headers).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  // UNICA 新闻/发布
  console.log('=== UNICA 英文站新闻 ===');
  const r1 = await get('https://unica.com.br/en/noticias/');
  console.log('status', r1.s, 'len', r1.b.length);
  if (r1.s === 200) {
    const links = [];
    const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{10,100})<\/a>/gi;
    let m;
    while ((m = re.exec(r1.b))) links.push(m[2].trim() + ' → ' + m[1]);
    // 找含 sugar/production/safra 的
    const relevant = links.filter(l => /sugar|production|safra|harvest|cana/i.test(l)).slice(0, 6);
    console.log('相关链接:');
    relevant.forEach(l => console.log('  ·', l.slice(0, 100)));
    if (!relevant.length) console.log('  未找到，页面标题:', (r1.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
  }

  // ISMA 首页
  console.log('\n=== ISMA 首页 ===');
  const r2 = await get('https://www.indiansugar.com/');
  console.log('status', r2.s, 'len', r2.b.length);
  if (r2.s === 200) {
    const links = [];
    const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{10,100})<\/a>/gi;
    let m;
    while ((m = re.exec(r2.b))) links.push(m[2].trim() + ' → ' + m[1]);
    const relevant = links.filter(l => /production|press|release|sugar/i.test(l)).slice(0, 6);
    console.log('相关链接:');
    relevant.forEach(l => console.log('  ·', l.slice(0, 100)));
    if (!relevant.length) console.log('  未找到，页面标题:', (r2.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
  }
})();
