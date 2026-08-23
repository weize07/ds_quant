// 从 GitHub 抓取 investing.com 的 commodity pair_id 映射，找糖11号
const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      if (r.statusCode >= 300 && r.headers.location) { get(r.headers.location).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  const urls = [
    'https://raw.githubusercontent.com/derlin/investing-historical-data/master/investing_historical_data/commodities.py',
    'https://raw.githubusercontent.com/derlin/investing-historical-data/main/investing_historical_data/commodities.py',
    'https://raw.githubusercontent.com/derlin/investing-historical-data/master/commodities.py',
    'https://raw.githubusercontent.com/derlin/investing-historical-data/master/investing_historical_data.py'
  ];
  for (const u of urls) {
    const r = await get(u);
    if (r.s === 200 && r.b.length > 100) {
      console.log('找到文件:', u);
      console.log('内容(含sugar的行):');
      for (const line of r.b.split('\n')) if (/sugar|coffee|8832|8830|8831/i.test(line)) console.log('  ' + line.trim().slice(0, 120));
      return;
    }
  }
  console.log('未找到文件');
})();
