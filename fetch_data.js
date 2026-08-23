// 中粮糖业周期判断 - 核心数据抓取脚本
// 数据源：东财 push2his(600737)、新浪(郑糖主力SR0)、东财全球期货(ICE原糖)、NOAA(ONI)
const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT = 'C:/Users/zewei/workspace/ds_quant/data';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function get(url, opts = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0', ...(opts.headers || {}) } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        get(res.headers.location, opts).then(resolve);
        return;
      }
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', err: 'timeout' }); });
    req.on('error', (e) => resolve({ status: 0, body: '', err: e.code + ' ' + e.message }));
  });
}

const log = [];
function record(name, ok, detail) { log.push({ name, ok, detail }); console.log((ok ? 'OK  ' : 'FAIL') + ' ' + name + ' | ' + detail); }

(async () => {
  // 1. 600737 日K（3年，前复权）
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.600737&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&beg=20230601&end=20500101';
    const r = await get(url);
    const j = JSON.parse(r.body);
    const klines = j.data.klines;
    const rows = klines.map(k => k.split(',').join(','));
    const csv = 'date,open,close,high,low,volume,amount\n' + rows.join('\n');
    fs.writeFileSync(path.join(OUT, '600737_daily.csv'), csv);
    record('600737日K', true, `${klines.length} 行，${klines[0]?.split(',')[0]} ~ ${klines[klines.length - 1]?.split(',')[0]}`);
  } catch (e) { record('600737日K', false, e.message); }

  // 2. 郑糖主力 SR0（全历史，新浪）
  try {
    const url = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_SR0=/InnerFuturesNewService.getDailyKLine?symbol=SR0';
    const r = await get(url);
    const m = r.body.match(/var _SR0=\((.*)\)\s*;?\s*$/s);
    const arr = JSON.parse(m[1]);
    const rows = arr.map(k => [k.d, k.o, k.h, k.l, k.c, k.v, k.p, k.s].join(','));
    const csv = 'date,open,high,low,close,volume,position,settle\n' + rows.join('\n');
    fs.writeFileSync(path.join(OUT, 'SR0_daily.csv'), csv);
    const last = arr[arr.length - 1];
    record('郑糖主力SR0', true, `${arr.length} 行，${arr[0].d} ~ ${last.d}，最新收盘 ${last.c}`);
  } catch (e) { record('郑糖主力SR0', false, e.message); }

  // 3. ICE 原糖 #11（东财全球期货，尝试多个 secid）
  let iceOk = false;
  for (const secid of ['101.11号糖', '101.ICE11号糖', '102.11号糖']) {
    try {
      const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + encodeURIComponent(secid) + '&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&beg=20200101&end=20500101';
      const r = await get(url);
      const j = JSON.parse(r.body);
      if (j.data && j.data.klines && j.data.klines.length > 0) {
        const rows = j.data.klines.map(k => k.split(',').join(','));
        const csv = 'date,open,close,high,low,volume,amount\n' + rows.join('\n');
        fs.writeFileSync(path.join(OUT, 'ICE_sugar_daily.csv'), csv);
        record('ICE原糖', true, `secid=${secid}，${rows.length} 行`);
        iceOk = true;
        break;
      }
    } catch (e) { /* try next */ }
  }
  if (!iceOk) {
    // 新浪全球期货 SB
    try {
      const url = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_SB=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=SB';
      const r = await get(url);
      const m = r.body.match(/var _SB=\((.*)\)\s*;?\s*$/s);
      const arr = JSON.parse(m[1]);
      const rows = arr.map(k => [k.d, k.o, k.h, k.l, k.c, k.v, k.p, k.s].join(','));
      const csv = 'date,open,high,low,close,volume,position,settle\n' + rows.join('\n');
      fs.writeFileSync(path.join(OUT, 'ICE_sugar_daily.csv'), csv);
      record('ICE原糖(新浪SB)', true, `${rows.length} 行`);
    } catch (e) { record('ICE原糖', false, '东财与新浪均失败: ' + e.message); }
  }

  // 4. NOAA ONI 指数（厄尔尼诺/拉尼娜）
  try {
    const url = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
    const r = await get(url);
    if (r.status === 200 && r.body.length > 100) {
      fs.writeFileSync(path.join(OUT, 'ONI_enso.txt'), r.body);
      const lines = r.body.trim().split('\n').filter(l => l.trim() && !l.startsWith('SEAS'));
      record('NOAA ONI', true, `${lines.length} 行（3个月滑动 Niño3.4 距平）`);
    } else {
      record('NOAA ONI', false, 'status=' + r.status + ' len=' + r.body.length);
    }
  } catch (e) { record('NOAA ONI', false, e.message); }

  fs.writeFileSync(path.join(OUT, 'fetch_log.json'), JSON.stringify(log, null, 2));
  console.log('\n=== fetch done ===');
})();
