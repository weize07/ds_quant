// 从沐甜列表页预览文本直接提取 南宁/昆明 现货价（不依赖详情页）
const https = require('https');
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.msweet.com.cn/' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    });
    q.on('error', () => resolve(''));
  });
}

(async () => {
  const listHtml = await get('https://www.msweet.com.cn/mtkj/xwzx62/xh32/index.html');
  const txt = listHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');

  // 提取所有 南宁/昆明 + 数字 + 元/吨 片段
  const nanning = [];
  const kunming = [];
  let m;
  const reN = /南宁[^，。；]{0,40}?报价?(\d{3,5})(?:[-~](\d{3,5}))?\s*元/g;
  while ((m = reN.exec(txt))) nanning.push({ price: +m[1], raw: m[0].slice(0, 40) });
  const reK = /云南昆明[^，。；]{0,40}?报价?(\d{3,5})(?:[-~](\d{3,5}))?\s*元/g;
  while ((m = reK.exec(txt))) kunming.push({ price: +m[1], raw: m[0].slice(0, 40) });

  console.log('南宁报价片段:', nanning.length, '条');
  nanning.slice(0, 3).forEach(x => console.log('   ', x.price, '|', x.raw));
  console.log('昆明报价片段:', kunming.length, '条');
  kunming.slice(0, 3).forEach(x => console.log('   ', x.price, '|', x.raw));

  const result = {
    date: '2026-08-24',
    nanning: nanning.length ? nanning[0].price : null,
    kunming: kunming.length ? kunming[0].price : null,
    source: '沐甜科技(列表页预览)'
  };
  if (result.nanning || result.kunming) {
    fs.writeFileSync(path.join(D, 'spot_price.json'), JSON.stringify(result, null, 2));
    console.log('\n已保存:', JSON.stringify(result));
  }
})();
