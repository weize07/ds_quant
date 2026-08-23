// 网络连通性 + 数据源可用性测试
const https = require('https');
const fs = require('fs');

function test(url, label) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        const r = { label, ok: true, status: res.statusCode, len: data.length, head: data.slice(0, 300) };
        console.log(label + ' OK status=' + res.statusCode + ' len=' + data.length);
        resolve(r);
      });
    });
    req.on('timeout', () => { req.destroy(); console.log(label + ' TIMEOUT'); resolve({ label, ok: false, err: 'timeout' }); });
    req.on('error', (e) => { console.log(label + ' ERR ' + e.code + ' ' + e.message); resolve({ label, ok: false, err: e.code + ' ' + e.message }); });
  });
}

(async () => {
  const results = [];
  // 1. 东财 600737 日K（近8个月）
  results.push(await test(
    'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.600737&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&beg=20250901&end=20500101',
    'eastmoney_600737'
  ));
  // 2. 新浪 郑糖主力日线
  results.push(await test(
    'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_SR0=/InnerFuturesNewService.getDailyKLine?symbol=SR0',
    'sina_futures_SR0'
  ));
  // 3. 通用连通性
  results.push(await test('https://www.baidu.com', 'baidu'));

  fs.writeFileSync('C:/Users/zewei/workspace/ds_quant/net_test_result.json', JSON.stringify(results, null, 2));
  console.log('DONE');
})();
