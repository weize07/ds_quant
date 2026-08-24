// 探测沐甜国际新闻：巴西/印度产量聚合
const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.msweet.com.cn/' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    });
    q.on('error', () => resolve(''));
  });
}

(async () => {
  const html = await get('https://www.msweet.com.cn/mtkj/xwzx62/gj29/index.html');
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  console.log('=== 沐甜国际新闻 ===');
  // 找巴西/印度相关片段
  const re = /[^。；\n]{0,50}(?:巴西|印度|UNICA|ISMA|糖醇|制糖比例)[^。；\n]{0,80}/g;
  let m, count = 0;
  const snippets = [];
  while ((m = re.exec(txt)) && count < 15) { snippets.push(m[0].trim()); count++; }
  if (snippets.length) snippets.forEach(s => console.log('  ·', s.slice(0, 100)));
  else {
    console.log('  无巴西/印度片段，页面开头:', txt.slice(0, 200));
  }
})();
