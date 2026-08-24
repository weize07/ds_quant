// 调试：看详情页里 南宁/报价 附近的实际文本
const https = require('https');
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
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]*现货报价综述[^<]*)<\/a>/gi;
  let m;
  while ((m = re.exec(listHtml))) {
    if (m[2].includes('南部')) {
      console.log('南部文章URL:', m[1]);
      const body = await get('https://www.msweet.com.cn' + m[1]);
      console.log('详情页长度:', body.length);
      const txt = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
      // 打印含"南宁"前后150字
      let idx = txt.indexOf('南宁');
      if (idx >= 0) console.log('文本片段:', txt.slice(Math.max(0, idx - 50), idx + 250));
      else console.log('详情页无"南宁"，页面开头:', txt.slice(0, 300));
      break;
    }
  }
})();
