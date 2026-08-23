// ICE 原糖替代数据源探测
const https = require('https');
function get(url, headers, redirects = 3) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...(headers || {}) } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) { get(res.headers.location, headers, redirects - 1).then(resolve); return; }
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    req.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  // 1. push2 主机上的 kline 路径（绕过 push2his 限流）
  for (const host of ['push2.eastmoney.com', 'push2his.eastmoney.com']) {
    const u = 'https://' + host + '/api/qt/stock/kline/get?secid=108.SB00Y&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&beg=20240101&end=20500101';
    const r = await get(u);
    let tag = '无数据';
    try { const j = JSON.parse(r.b); if (j.data && j.data.klines && j.data.klines.length) tag = 'OK rows=' + j.data.klines.length; } catch (e) {}
    console.log(host, '→', r.s, tag);
  }

  // 2. 东财 futsseapi 主机
  const r2 = await get('https://futsseapi.eastmoney.com/api/qt/stock/kline/get?secid=108.SB00Y&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&beg=20240101&end=20500101');
  console.log('futsseapi →', r2.s, r2.b.slice(0, 120));

  // 3. stooq 多种符号
  for (const sym of ['sb.f', 'sb.us', 'SUGAR.F']) {
    const r = await get('https://stooq.com/q/d/l/?s=' + sym + '&i=d');
    console.log('stooq ' + sym + ' →', r.s, r.b.slice(0, 80).replace(/\n/g, ' '));
  }

  // 4. 新浪全球期货其它符号
  for (const sym of ['SB', 'SBN', 'SRB']) {
    const r = await get('https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_t=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=' + sym);
    const m = r.b.match(/var _t=\((.*)\)\s*;?\s*$/s);
    let tag = '无数据';
    if (m) { try { const a = JSON.parse(m[1]); tag = 'OK rows=' + a.length + ' 最新 ' + (a[a.length - 1]?.date || '?'); } catch (e) { tag = 'parse err'; } }
    console.log('sina ' + sym + ' →', r.s, tag);
  }
})();
