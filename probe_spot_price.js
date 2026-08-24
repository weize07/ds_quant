// 验证：从沐甜现货报价列表页提取 南宁/昆明 现货价
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
  const html = await get('https://www.msweet.com.cn/mtkj/xwzx62/xh32/index.html');
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

  // 找所有"南部/西部/制糖集团"现货综述，提取日期+价格
  const items = [];
  const dateRe = /(\d{4}-\d{2}-\d{2})[\s\S]{0,80}?\[白糖\]\s*(\d{1,2})日(南部|西部|制糖集团|东部|中部)区域?[^。]{0,50}/g;
  let m;
  while ((m = dateRe.exec(txt))) {
    const date = m[1], day = m[2], region = m[3];
    // 在该片段后200字内找 南宁/昆明 报价
    const seg = txt.slice(m.index, m.index + 300);
    const nanning = seg.match(/南宁[^，。]*?报价(\d+)(?:-(\d+))?元/);
    const kunming = seg.match(/云南昆明[^，。]*?报价(\d+)(?:-(\d+))?元/) || seg.match(/昆明[^，。]*?报价(\d+)(?:-(\d+))?元/);
    items.push({ date, region, nanning: nanning ? nanning[1] : null, kunming: kunming ? kunming[1] : null, raw: seg.slice(0, 80).trim() });
  }
  console.log('解析到', items.length, '条现货综述：');
  for (const it of items) {
    console.log('  [' + it.date + '] ' + it.region + '区 | 南宁:' + (it.nanning || '—') + ' | 昆明:' + (it.kunming || '—'));
  }
})();
