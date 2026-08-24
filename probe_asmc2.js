// 从 ASMC 七月回顾提取泰国/干旱/SPI 相关内容
const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    });
    q.on('error', () => resolve(''));
  });
}

(async () => {
  const html = await get('https://asmc.asean.org/review-of-regional-weather-for-july-2026/');
  const txt = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');

  // 1. 找 Thailand / Thai 出现处
  console.log('=== 含 Thailand/Thai 的句子 ===');
  const reT = /[^.]*Thailand[^.]*\./gi;
  let m, c = 0;
  while ((m = reT.exec(txt)) && c < 6) { console.log('·', m[0].trim().slice(0, 160)); c++; }
  if (c === 0) console.log('  无 Thailand 关键词');

  // 2. 找 drought / SPI / 干旱
  console.log('\n=== 含 drought/SPI 的句子 ===');
  const reD = /[^.]*(?:drought|SPI|dry)[^.]*\./gi;
  c = 0;
  while ((m = reD.exec(txt)) && c < 6) { console.log('·', m[0].trim().slice(0, 160)); c++; }
  if (c === 0) console.log('  无 drought/SPI 关键词');

  // 3. 找降雨距平百分比
  console.log('\n=== 含 % 的降雨距平句子 ===');
  const reP = /[^.]*below-average rainfall[^.]*\./gi;
  c = 0;
  while ((m = reP.exec(txt)) && c < 5) { console.log('·', m[0].trim().slice(0, 160)); c++; }
})();
