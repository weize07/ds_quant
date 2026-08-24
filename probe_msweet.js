// 检查沐甜现货页内容结构
const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.msweet.com.cn/' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  const r = await get('https://www.msweet.com.cn/mtkj/xwzx62/xh32/index.html');
  console.log('status', r.s, 'len', r.b.length);
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{3,80})<\/a>/gi;
  let m;
  while ((m = re.exec(r.b))) links.push(m[1] + ' | ' + m[2].trim());
  console.log('链接数:', links.length);
  links.slice(0, 15).forEach(l => console.log('  ', l.slice(0, 110)));
  // 找价格关键词
  const txt = r.b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const kw of ['南宁', '云南', '报价', '现货价']) {
    const i = txt.indexOf(kw);
    if (i >= 0) console.log('含"' + kw + '"处:', txt.slice(Math.max(0, i - 60), i + 120).trim());
  }
})();
