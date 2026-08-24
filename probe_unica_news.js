// 抓取 intsugar-tc 的 UNICA 巴西数据报道，提取 制糖比例/产量/乙醇
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

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
  const urls = [
    'http://www.intsugar-tc.com/2026/08/07/unica%ef%bc%9a6%e6%9c%88%e5%b7%b4%e8%a5%bf%e4%b8%ad%e5%8d%97%e9%83%a8%e7%b3%96%e4%ba%a7%e9%87%8f%e5%90%8c%e6%af%94%e4%b8%8b%e6%bb%9126%ef%bc%8c%e8%87%b3390%e4%b8%87%e5%90%a8/'
  ];
  for (const u of urls) {
    const r = await get(u);
    console.log('status', r.s, 'len', r.b.length);
    if (r.s !== 200) continue;
    const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
    // 找制糖比例/产量/乙醇
    const re = /[^。；\n]{0,40}(?:制糖比例|糖醇比|产糖|甘蔗|压榨|乙醇|混合|mix|比例)[^。；\n]{0,70}/g;
    let m, c = 0;
    const snippets = [];
    while ((m = re.exec(txt)) && c < 12) { snippets.push(m[0].trim()); c++; }
    if (snippets.length) snippets.forEach(s => console.log('  ·', s.slice(0, 100)));
    else console.log('  无相关片段，正文开头:', txt.indexOf('Unica') >= 0 ? txt.slice(txt.indexOf('Unica'), txt.indexOf('Unica') + 300) : txt.slice(0, 300));
  }
})();
