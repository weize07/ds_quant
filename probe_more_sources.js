// 批量探测：糖协/进口/UNICA/ISMA
const https = require('https');
const http = require('http');
function get(url, headers) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location, headers).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  // #3 沐甜科技 月度进口（比海关总署更友好）
  console.log('=== #3 沐甜科技 月度进口 ===');
  const r1 = await get('https://www.msweet.com.cn/mtkj/xwzx62/sj26/jck5/index.html', { 'Referer': 'https://www.msweet.com.cn/' });
  console.log('status', r1.s, 'len', r1.b.length, '标题:', (r1.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
  const txt1 = r1.b.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const im = txt1.search(/进口/);
  if (im >= 0) console.log('  含"进口"片段:', txt1.slice(Math.max(0, im - 40), im + 120).trim());

  // #2 糖协（再试一次）
  console.log('\n=== #2 中国糖协 ===');
  for (const u of ['http://www.sugarinfo.cn/', 'https://www.sugarinfo.cn/']) {
    const r2 = await get(u);
    console.log(u, '→', r2.s, r2.b.slice(0, 60).replace(/\n/g, ''));
  }

  // #4 UNICA
  console.log('\n=== #4 UNICA ===');
  for (const u of ['https://unica.com.br/en/', 'https://www.unica.com.br/en/']) {
    const r3 = await get(u);
    console.log(u, '→', r3.s, 'len', r3.b.length, '标题:', (r3.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
  }

  // #5 ISMA
  console.log('\n=== #5 ISMA ===');
  const r4 = await get('https://www.indiansugar.com/');
  console.log('status', r4.s, 'len', r4.b.length, '标题:', (r4.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || '?');
})();
