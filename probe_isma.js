// 探测印度 ISMA 产糖数据：沐甜文章 + intsugar-tc
const https = require('https');
const http = require('http');
function get(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.msweet.com.cn/' } }, r => {
      if (r.statusCode >= 300 && r.headers.location) { get(r.headers.location).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  console.log('=== 沐甜 ISMA 文章 ===');
  const r1 = await get('http://www.msweet.com.cn/eportal/ui?pageId=1014425&articleKey=3188773&columnId=1014003');
  console.log('status', r1.s, 'len', r1.b.length);
  if (r1.s === 200) {
    const txt = r1.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
    const i = txt.indexOf('印度');
    console.log('含"印度"片段:', i >= 0 ? txt.slice(i, i + 300) : '无，正文开头:' + txt.slice(0, 200));
  }

  console.log('\n=== intsugar-tc 首页找印度 ===');
  const r2 = await get('http://www.intsugar-tc.com/');
  console.log('status', r2.s, 'len', r2.b.length);
  if (r2.s === 200) {
    const txt = r2.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
    const idx = txt.search(/印度|ISMA/);
    if (idx >= 0) console.log('首页含印度:', txt.slice(Math.max(0, idx - 50), idx + 150).trim());
    else console.log('首页无印度片段');
  }
})();
