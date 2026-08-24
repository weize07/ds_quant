// 沐甜科技 月度食糖进口量抓取（海关数据，沐甜每月18日左右发布）
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
  const html = await get('https://www.msweet.com.cn/mtkj/xwzx62/sj26/jck5/index.html');
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');

  // 提取月度进口序列
  const re = /(\d{4})年(\d{1,2})月份我国进口食糖(\d+)万吨，同比(减少|增加)(\d+)万吨/g;
  const months = [];
  let m;
  while ((m = re.exec(txt))) {
    months.push({ year: +m[1], month: +m[2], importMt: +m[3], yoyDir: m[4], yoyMt: +m[5] });
  }
  // 去重（预览可能重复），按时间排序
  const seen = new Set();
  const uniq = [];
  for (const x of months) {
    const k = x.year + '-' + x.month;
    if (!seen.has(k)) { seen.add(k); uniq.push(x); }
  }
  uniq.sort((a, b) => (a.year - b.year) || (a.month - b.month));

  console.log('解析到', uniq.length, '个月进口数据：');
  for (const x of uniq.slice(-6)) {
    console.log('  ' + x.year + '年' + x.month + '月: ' + x.importMt + '万吨（同比' + x.yoyDir + x.yoyMt + '万吨）');
  }

  if (uniq.length) {
    const latest = uniq[uniq.length - 1];
    const result = { source: '沐甜科技(海关数据)', latest, history: uniq, fetchDate: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(path.join(D, 'import_data.json'), JSON.stringify(result, null, 2));
    console.log('\n已保存 data/import_data.json，最新:', latest.year + '年' + latest.month + '月', latest.importMt + '万吨');
  }
})();
