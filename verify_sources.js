// 重新验证 ICE 源 + 测试汇率源
const https = require('https');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url, headers, n = 4) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0', ...(headers || {}) } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { if (d.length === 0 && n > 0) setTimeout(() => get(url, headers, n - 1).then(resolve), 2500); else resolve({ s: r.statusCode, b: d }); });
    });
    q.on('error', () => { if (n > 0) setTimeout(() => get(url, headers, n - 1).then(resolve), 2500); else resolve({ s: 0, b: '' }); });
  });
}

(async () => {
  // 1. ICE 原糖（糖11号）
  for (const secid of ['108.SB26V', '108.SB00Y']) {
    const u = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secid + '&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&beg=20240101&end=20500101';
    const r = await get(u);
    try {
      const j = JSON.parse(r.b);
      const k = j.data && j.data.klines;
      if (k && k.length) {
        const last = k[k.length - 1].split(',');
        console.log('ICE ' + secid + ' OK rows=' + k.length + ' 最新 ' + last[0] + ' 收 ' + last[2]);
        console.log('  近8日:', k.slice(-8).map(x => { const p = x.split(','); return p[0].slice(5) + ':' + p[2]; }).join(' '));
        fs.writeFileSync('C:/Users/zewei/workspace/ds_quant/data/ICE_sugar_daily.csv', 'date,open,close,high,low,volume,amount\n' + k.map(x => x.split(',').join(',')).join('\n'));
        console.log('  → 已写入缓存');
        break;
      } else { console.log('ICE ' + secid + ' 无klines'); }
    } catch (e) { console.log('ICE ' + secid + ' 失败 status=' + r.s + ' len=' + r.b.length); }
    await sleep(2000);
  }

  // 2. 汇率 USD/CNY（新浪）
  const fx = await get('https://hq.sinajs.cn/list=fx_susdcny', { 'Referer': 'https://finance.sina.com.cn' });
  console.log('\n新浪汇率 status=' + fx.s + ' 内容: ' + fx.b.slice(0, 200));

  // 3. 汇率 USD/CNY（东财，备用）
  const fx2 = await get('https://push2.eastmoney.com/api/qt/stock/get?secid=133.USDCNH&fields=f43,f57,f58');
  console.log('东财汇率 status=' + fx2.s + ' 内容: ' + fx2.b.slice(0, 200));
})();
