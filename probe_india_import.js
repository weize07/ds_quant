// 抓取 intsugar-tc 印度进口政策文章，提取产量/减产上下文
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
  const url = 'http://www.intsugar-tc.com/2026/08/21/%e5%8d%b0%e5%ba%a6%e6%94%bf%e5%ba%9c%e6%89%b9%e5%87%86100%e4%b8%87%e5%90%a8%e5%8e%9f%e7%b3%96%e5%85%8d%e7%a8%8e%e8%bf%9b%e5%8f%a3/';
  const r = await get(url);
  console.log('status', r.s, 'len', r.b.length);
  if (r.s !== 200) return;
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  // 找正文关键内容（产量、万吨、榨季、减产）
  const re = /[^。；\n]{0,60}(?:万吨|产量|榨季|减产|ISMA|进口)[^。；\n]{0,80}/g;
  let m, c = 0;
  const snippets = [];
  while ((m = re.exec(txt)) && c < 12) { snippets.push(m[0].trim()); c++; }
  if (snippets.length) snippets.forEach(s => console.log('  ·', s.slice(0, 120)));
})();
