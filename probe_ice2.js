// 枚举东财全球期货市场代码，找 ICE 原糖
const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    req.on('error', () => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  // 试每个市场代码，逐页找"糖"
  for (let m = 101; m <= 130; m++) {
    for (let pn = 1; pn <= 3; pn++) {
      const u = 'https://push2.eastmoney.com/api/qt/clist/get?fid=f12&po=1&pz=200&pn=' + pn + '&np=1&fltt=2&invt=2&fs=m:' + m + '&fields=f12,f13,f14';
      const r = await get(u);
      if (r.s !== 200 || !r.b.includes('"data"')) { if (pn === 1) console.log('m:' + m + ' 无数据'); break; }
      let j; try { j = JSON.parse(r.b); } catch (e) { break; }
      const items = (j.data && j.data.diff) || [];
      if (!items.length) { if (pn === 1) console.log('m:' + m + ' 空'); break; }
      const sugar = items.filter(x => (x.f14 || '').includes('糖') || (x.f12 || '').startsWith('SB'));
      if (sugar.length) {
        console.log('★ 找到糖! m:' + m + ' pn:' + pn);
        for (const s of sugar) console.log('   ', JSON.stringify(s));
        return;
      }
      if (pn === 1) console.log('m:' + m + ' 样例', JSON.stringify(items[0]));
    }
  }
  console.log('未找到');
})();
