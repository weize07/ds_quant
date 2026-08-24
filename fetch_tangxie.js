// 糖协产销数据抓取（mysteel 可解析版）：产糖量/销糖率/工业库存
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

async function parseArticle(url) {
  const r = await get(url);
  if (r.s !== 200) return null;
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
  return {
    productionMt: txt.match(/共生产食糖([\d.]+)万吨/) ? +txt.match(/共生产食糖([\d.]+)万吨/)[1] : null,
    salesMt: txt.match(/累计销售食糖([\d.]+)万吨/) ? +txt.match(/累计销售食糖([\d.]+)万吨/)[1] : null,
    salesRate: txt.match(/销糖率([\d.]+)%/) ? +txt.match(/销糖率([\d.]+)%/)[1] : null,
    inventoryMt: txt.match(/工业库存([\d.]+)万吨/) ? +txt.match(/工业库存([\d.]+)万吨/)[1] : null,
    avgPrice: txt.match(/平均销售价格([\d.]+)元/) ? +txt.match(/平均销售价格([\d.]+)元/)[1] : null,
    title: (r.b.match(/<title>([^<]*)<\/title>/i) || [])[1] || ''
  };
}

(async () => {
  // 2026-01 库存文章（搜索确认）— 最新一期
  const r1 = await parseArticle('https://ncp.mysteel.com/a/26021210/DEA0285518716060.html');
  if (r1) {
    console.log('2026-01 结转库存文章:');
    console.log('  标题:', r1.title.slice(0, 60));
    console.log('  产糖:', r1.productionMt, '销糖:', r1.salesMt, '销糖率:', r1.salesRate, '库存:', r1.inventoryMt);
    const result = { cropYear: '2025/26', asOf: '2026-01', ...r1, source: 'mysteel(糖协数据)', fetchDate: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(path.join(D, 'tangxie_data.json'), JSON.stringify(result, null, 2));
    append('tangxie_inventory', '国内工业库存(万吨)', result.asOf, result.inventoryMt);
    append('tangxie_salesRate', '国内销糖率(%)', result.asOf, result.salesRate);
    console.log('\n已保存 data/tangxie_data.json（最新: 2026-01，历史已追加）');
  }

  // 2025-05 产销数据文章（历史参考，仅展示不覆盖）
  const r2 = await parseArticle('https://m.mysteel.com/a/25060608/6787CDA36169308D_abc.html');
  if (r2) {
    console.log('\n2025-05 产销数据文章（历史参考）:');
    console.log('  产糖:', r2.productionMt, '万吨 | 销糖率:', r2.salesRate + '% | 库存:', r2.inventoryMt, '万吨');
  }
})();
