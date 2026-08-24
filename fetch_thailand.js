// 泰国 OCSB 产糖数据（从搜索结果确认，需定期人工更新URL）
const fs = require('fs');
const path = require('path');
const D = 'C:/Users/zewei/workspace/ds_quant/data';
const { append } = require('./lib/history');

const result = {
  cropYear: '2025/26',
  productionMt: 1200,           // 泰国2025/26产糖约1200万吨
  nextSeasonWarning: '泰国糖产商预警超级厄尔尼诺，2026/27新榨季甘蔗产量或降至1亿吨（正常约1.15亿吨）',
  status: '泰国是全球第二大出口国，厄尔尼诺干旱的敏感产区；新榨季减产预警是ICE的重要支撑',
  source: 'ynsugar.com(OCSB) + 沐甜科技',
  fetchDate: new Date().toISOString().slice(0, 10)
};
fs.writeFileSync(path.join(D, 'thailand_ocsb.json'), JSON.stringify(result, null, 2));
append('thailand_production', '泰国产糖(万吨)', result.cropYear, result.productionMt);
console.log('泰国 OCSB 数据已保存:');
console.log('  2025/26产糖:', result.productionMt, '万吨');
console.log('  预警:', result.nextSeasonWarning);
