// 探测沐甜"月度进口"页：找进口量数据（万吨）
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
  // 月度进口
  const html = await get('https://www.msweet.com.cn/mtkj/xwzx62/sj26/jck5/index.html');
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  console.log('=== 月度进口页 ===');
  // 找含"万吨/进口/吨"的文本片段
  const re = /[^。；\n]{0,40}(?:进口食糖|食糖进口|进口糖|万吨)[^。；\n]{0,60}/g;
  let m, count = 0;
  const snippets = [];
  while ((m = re.exec(txt)) && count < 10) { snippets.push(m[0].trim()); count++; }
  if (snippets.length) snippets.forEach(s => console.log('  ·', s.slice(0, 90)));
  else console.log('  月度进口页无进口量片段');

  // 进口监测（更频繁）
  console.log('\n=== 进口监测页 ===');
  const html2 = await get('https://www.msweet.com.cn/mtkj/xwzx62/sj26/jkjc26/index.html');
  const txt2 = html2.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  let count2 = 0;
  const snippets2 = [];
  while ((m = re.exec(txt2)) && count2 < 10) { snippets2.push(m[0].trim()); count2++; }
  if (snippets2.length) snippets2.forEach(s => console.log('  ·', s.slice(0, 90)));
  else console.log('  进口监测页无片段');
})();
