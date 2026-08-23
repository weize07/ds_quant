// 探测：SR次主力连续 + 修复巨潮资讯(http)
const https = require('https');
const http = require('http');
function get(url, headers) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0', ...(headers || {}) } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  console.log('=== SR次主力连续探测 ===');
  for (const sym of ['SR1', 'SR2', 'SR3']) {
    const u = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_t=/InnerFuturesNewService.getDailyKLine?symbol=' + sym;
    const r = await get(u);
    const m = r.b.match(/var _t=\((.*)\)\s*;?\s*$/s);
    let tag = '无数据';
    if (m) { try { const a = JSON.parse(m[1]); if (a.length) tag = 'OK rows=' + a.length + ' 最新 ' + a[a.length - 1].d + ' 收 ' + a[a.length - 1].c; } catch (e) { tag = 'parse err'; } }
    console.log('  ' + sym + ' → ' + tag);
  }

  console.log('\n=== 巨潮资讯公告搜索 ===');
  const r2 = await get('http://www.cninfo.com.cn/new/information/topSearch/query?keyWord=' + encodeURIComponent('中粮糖业') + '&maxNum=10');
  console.log('  status', r2.s, '内容:', r2.b.slice(0, 300));
})();
