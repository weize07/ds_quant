// 探测 mysteel 产销数据文章可解析性
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
  const r = await get('https://m.mysteel.com/a/25060608/6787CDA36169308D_abc.html');
  console.log('status', r.s, 'len', r.b.length);
  if (r.s !== 200) return;
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  // 找 产糖/销糖率/库存/万吨
  const re = /[^。；\n]{0,50}(?:产糖|销糖率|库存|万吨|累计)[^。；\n]{0,70}/g;
  let m, c = 0;
  const snippets = [];
  while ((m = re.exec(txt)) && c < 10) { snippets.push(m[0].trim()); c++; }
  if (snippets.length) snippets.forEach(s => console.log('  ·', s.slice(0, 110)));
  else console.log('  无相关片段，正文开头:', txt.slice(0, 250));
})();
