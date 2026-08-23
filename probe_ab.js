// 探测：A. 郑糖远月合约数据 + B. 巨潮资讯公告接口
const https = require('https');
function get(url, headers) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0', ...(headers || {}) } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  console.log('=== A. 郑糖远月合约（新浪） ===');
  for (const sym of ['SR2609', 'SR2611', 'SR2701', 'SR2705', 'SR2709']) {
    const u = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_t=/InnerFuturesNewService.getDailyKLine?symbol=' + sym;
    const r = await get(u);
    const m = r.b.match(/var _t=\((.*)\)\s*;?\s*$/s);
    let tag = '无数据';
    if (m) { try { const a = JSON.parse(m[1]); if (a.length) tag = 'OK rows=' + a.length + ' 最新 ' + a[a.length - 1].d + ' 收 ' + a[a.length - 1].c; } catch (e) { tag = 'parse err ' + r.b.slice(0, 60); } }
    console.log('  ' + sym + ' → ' + tag);
  }

  console.log('\n=== B. 巨潮资讯公告接口 ===');
  // 先搜索 orgId
  const searchUrl = 'http://www.cninfo.com.cn/new/information/topSearch/query';
  const r2 = await get(searchUrl + '?keyWord=' + encodeURIComponent('中粮糖业') + '&maxNum=10');
  console.log('  搜索 → status', r2.s, r2.b.slice(0, 200));
})();
