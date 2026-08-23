// 修复 ICE 原糖：新浪全球期货用完整字段名
const https = require('https');
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';

function get(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', e => resolve('ERR ' + e.message));
  });
}

(async () => {
  const url = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_SB=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=SB';
  const body = await get(url);
  const m = body.match(/var _SB=\((.*)\)\s*;?\s*$/s);
  const arr = JSON.parse(m[1]);
  const rows = arr.map(k => [k.date, k.open, k.high, k.low, k.close, k.volume, k.position, k.s].join(','));
  const csv = 'date,open,high,low,close,volume,position,settle\n' + rows.join('\n');
  fs.writeFileSync(path.join(D, 'ICE_sugar_daily.csv'), csv);
  const last = arr[arr.length - 1];
  console.log('ICE原糖修复:', arr.length, '行，', arr[0].date, '~', last.date, '最新收盘', last.close);
})();
