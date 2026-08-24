// 提取沐甜 ISMA 文章正文
const https = require('https');
const http = require('http');
function get(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.msweet.com.cn/' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    });
    q.on('error', () => resolve(''));
  });
}

(async () => {
  const html = await get('http://www.msweet.com.cn/eportal/ui?pageId=1014425&articleKey=3188773&columnId=1014003');
  // 找正文区域：通常在 eportal_article 或 article 相关 div
  const m = html.match(/<div[^>]*(?:class="[^"]*(?:article|content|detail)[^"]*")[^>]*>([\s\S]*?)<\/div>/i);
  if (m) {
    const body = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('正文区域:', body.slice(0, 600));
  } else {
    // 退而求其次：找所有含"万吨"的片段
    const txt = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
    const re = /[^。；\n]{0,50}(?:万吨|2930|产糖|产量)[^。；\n]{0,60}/g;
    let mm, c = 0;
    const snippets = [];
    while ((mm = re.exec(txt)) && c < 8) { snippets.push(mm[0].trim()); c++; }
    console.log('含万吨/产量片段:');
    snippets.forEach(s => console.log('  ·', s.slice(0, 110)));
  }
})();
