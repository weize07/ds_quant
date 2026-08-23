// 排查 ICE 原糖可用的免费数据源
const https = require('https');
function get(url, headers) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...(headers || {}) } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { get(res.headers.location, headers).then(resolve); return; }
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ s: 0, b: '' }); });
    req.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
  });
}

(async () => {
  // 1. 东财全球期货列表，找糖的 secid
  for (const fs of ['m:101', 'm:101,m:102', 'm:101,m:102,m:103,m:104']) {
    const u = 'https://push2.eastmoney.com/api/qt/clist/get?fid=f12&po=1&pz=500&pn=1&np=1&fltt=2&invt=2&fs=' + encodeURIComponent(fs) + '&fields=f12,f13,f14';
    const r = await get(u);
    console.log('clist fs=' + fs + ' status=' + r.s + ' len=' + r.b.length);
    if (r.s === 200 && r.b.includes('"data"')) {
      try {
        const j = JSON.parse(r.b);
        const items = (j.data && j.data.diff) || [];
        const sugar = items.filter(x => JSON.stringify(x).includes('糖') || JSON.stringify(x).includes('SB'));
        console.log('  总条数', items.length, '含糖/含SB:', sugar.length);
        for (const s of sugar.slice(0, 10)) console.log('   ', JSON.stringify(s));
        if (items.length) { console.log('  样例:', JSON.stringify(items[0])); }
        if (sugar.length) break;
      } catch (e) { console.log('  parse err', e.message); }
    }
  }
})();
