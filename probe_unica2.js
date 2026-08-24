// 深入探测 UNICA 官网：找双周压榨报告（含制糖比例）
const https = require('https');
function get(url, headers) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'en,pt;q=0.9', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location, headers).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  console.log('=== UNICA 首页链接 ===');
  const r = await get('https://unica.com.br/en/');
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{5,90})<\/a>/gi;
  let m;
  while ((m = re.exec(r.b))) links.push(m[2].trim() + ' → ' + m[1]);
  // 找 harvest/result/sugar-mix/safra 相关
  const relevant = links.filter(l => /harvest|result|safra|milling|production|data/i.test(l)).slice(0, 10);
  if (relevant.length) relevant.forEach(l => console.log('  ·', l.slice(0, 100)));
  else { console.log('  首页相关链接为空，样例:', links.slice(0, 8)); }

  // 尝试常见路径
  console.log('\n=== 尝试常见路径 ===');
  for (const u of ['https://unica.com.br/en/harvest/', 'https://unica.com.br/en/resultados/', 'https://unica.com.br/resultados-da-safra/']) {
    const r2 = await get(u);
    console.log(u, '→', r2.s, 'len', r2.b.length);
    if (r2.s === 200) {
      const t = r2.b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const i = t.search(/sugar mix|制糖|mix.*percent|% of cane/i);
      if (i >= 0) console.log('  含mix片段:', t.slice(Math.max(0, i - 50), i + 150).trim());
    }
  }
})();
