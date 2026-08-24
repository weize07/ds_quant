// 探测 unicadata.com.br 数据结构 + resultados 页面链接
const https = require('https');
function get(url, headers) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'pt-BR,pt;q=0.9', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location, headers).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  console.log('=== unicadata.com.br ===');
  const r = await get('https://unicadata.com.br/');
  console.log('status', r.s, 'len', r.b.length, '标题:', (r.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
  if (r.s === 200) {
    const t = r.b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const kw of ['mix', 'Açúcar', 'sucrose', 'produção', 'safra']) {
      const i = t.indexOf(kw);
      if (i >= 0) console.log('含"' + kw + '":', t.slice(Math.max(0, i - 40), i + 100).trim().slice(0, 140));
    }
    // 找API/数据端点
    const api = r.b.match(/["'](\/api\/[^"']*|https?:\/\/[^"']*(?:json|chart|data)[^"']*)["']/gi);
    if (api) console.log('API候选:', api.slice(0, 5));
  }

  console.log('\n=== UNICA resultados 页链接 ===');
  const r2 = await get('https://unica.com.br/en/resultados/');
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{5,90})<\/a>/gi;
  let m;
  while ((m = re.exec(r2.b))) links.push(m[2].trim() + ' → ' + m[1]);
  const rel = links.filter(l => /safra|harvest|milling|report|press|release/i.test(l)).slice(0, 8);
  if (rel.length) rel.forEach(l => console.log('  ·', l.slice(0, 100)));
  else console.log('  未找到相关链接');
})();
