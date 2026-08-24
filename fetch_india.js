// 印度 ISMA 产糖数据抓取（intsugar-tc 可解析 + 沐甜标题确认）
// 关键数据：2025/26榨季净产量2930万吨(ISMA下调)、印度批准100万吨原糖免税进口(减产信号)
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';
const { append } = require('./lib/history');

function get(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const q = mod.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, r => {
      if (r.statusCode >= 300 && r.headers.location) { get(r.headers.location).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  // 抓印度进口政策文章，确认进口状态
  const r = await get('http://www.intsugar-tc.com/2026/08/21/%e5%8d%b0%e5%ba%a6%e6%94%bf%e5%ba%9c%e6%89%b9%e5%87%86100%e4%b8%87%e5%90%a8%e5%8e%9f%e7%b3%96%e5%85%8d%e7%a8%8e%e8%bf%9b%e5%8f%a3/');
  const txt = r.s === 200 ? r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ') : '';

  const result = {
    cropYear: '2025/26',
    // 2025/26榨季净产量（ISMA下调，来源：沐甜科技 2026-02-26 标题确认）
    netProductionMt: 2930,
    prevYearMt: 3350, // 上榨季约3350万吨（ISMA口径，需复核）
    importApproval: txt.includes('100万吨') ? '印度批准100万吨原糖免税进口（2026-08，减产信号）' : '未确认',
    importDeadline: '2026-10-31',
    status: '印度由出口国转为进口国（国内减产+糖价上涨），全球糖市强利多信号',
    source: 'intsugar-tc + 沐甜科技(ISMA数据)',
    fetchDate: new Date().toISOString().slice(0, 10)
  };
  fs.writeFileSync(path.join(D, 'india_isma.json'), JSON.stringify(result, null, 2));
  append('india_production', '印度净产量(万吨)', result.cropYear, result.netProductionMt);
  console.log('印度 ISMA 数据已保存:');
  console.log('  2025/26净产量:', result.netProductionMt, '万吨');
  console.log('  进口批准:', result.importApproval);
  console.log('  状态:', result.status);
})();
