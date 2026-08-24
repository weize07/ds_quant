// ASMC 月度区域天气回顾抓取：提取"中南半岛(泰国区域)降雨异常"定性信号
// 数据是区域级+定性（above/below-average），比ONI精细、但非国别数值
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
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

// 每月更新此URL（ASMC 月初发布上月回顾）
const REVIEW_URL = 'https://asmc.asean.org/review-of-regional-weather-for-july-2026/';

(async () => {
  const r = await get(REVIEW_URL);
  if (r.s !== 200) { console.log('抓取失败', r.s); return; }
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');

  // 提取中南半岛(泰国区域)降雨异常描述
  const mse = txt.match(/[^.]*Mainland Southeast Asia[^.]*\./gi) || [];
  const central = mse.find(s => /central|below-average|above-average/i.test(s)) || '';

  // 定性判断：中部(泰国)偏干还是偏湿
  let thaiSignal = '中性';
  if (/central parts of Mainland Southeast Asia recorded below-average rainfall/i.test(txt)) thaiSignal = '偏干';
  else if (/central parts of Mainland Southeast Asia recorded above-average rainfall/i.test(txt)) thaiSignal = '偏湿';

  const result = {
    month: '2026-07',
    region: '中南半岛(含泰国)',
    signal: thaiSignal,
    detail: central.trim().slice(0, 200),
    note: 'ASMC区域级定性数据；"偏干"=泰国区域干旱风险（利多糖价）。定量数值在降雨距平地图(图片)中，需人工查看。',
    source: 'ASMC (asean.org)',
    fetchDate: new Date().toISOString().slice(0, 10)
  };
  fs.writeFileSync(path.join(D, 'asmc_weather.json'), JSON.stringify(result, null, 2));
  console.log('ASMC 天气信号:');
  console.log('  ' + result.month + ' 中南半岛(泰国区域):', result.signal);
  console.log('  详情:', result.detail.slice(0, 150));
  console.log('  已保存 data/asmc_weather.json');
})();
