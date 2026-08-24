// 泰国 OCSB 产糖数据抓取（ynsugar.com）
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
  const r = await get('https://www.ynsugar.com/thailand-sugar-production-2025-26/');
  console.log('status', r.s, 'len', r.b.length);
  if (r.s !== 200) return;
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  // 找产量/万吨/出口相关
  const re = /[^。；\n]{0,60}(?:产量|万吨|出口|榨季|产糖|甘蔗|OCSB|泰国)[^。；\n]{0,80}/g;
  let m, c = 0;
  const snippets = [];
  while ((m = re.exec(txt)) && c < 15) { snippets.push(m[0].trim()); c++; }
  if (snippets.length) snippets.forEach(s => console.log('  ·', s.slice(0, 110)));
  else console.log('  无片段，正文:', txt.slice(0, 300));
})();
