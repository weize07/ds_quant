// 巴西 UNICA 数据抓取（intsugar-tc 中国糖业资讯站，格式统一可解析）
// 提取：制糖比例(当月/累计)、压榨量、乙醇产量、糖产量
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

function extract(text, pattern) {
  const m = text.match(pattern);
  return m ? m[1] : null;
}

(async () => {
  // 已知文章 URL（UNICA 6月数据）。后续可升级为自动找最新文章。
  const url = 'http://www.intsugar-tc.com/2026/08/07/unica%ef%bc%9a6%e6%9c%88%e5%b7%b4%e8%a5%bf%e4%b8%ad%e5%8d%97%e9%83%a8%e7%b3%96%e4%ba%a7%e9%87%8f%e5%90%8c%e6%af%94%e4%b8%8b%e6%bb%9126%ef%bc%8c%e8%87%b3390%e4%b8%87%e5%90%a8/';
  const r = await get(url);
  if (r.s !== 200) { console.log('抓取失败', r.s); return; }
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&hellip;/gi, ' ').replace(/\s+/g, ' ');

  const result = {
    source: 'intsugar-tc(UNICA官方数据)',
    reportMonth: '2026-06',
    month: {
      caneCrushMt: extract(txt, /单月甘蔗压榨量\s*([\d.]+)\s*万吨/),
      caneCrushYoy: extract(txt, /压榨量\s*([\d.]+)\s*万吨，同比下滑\s*([\d.]+)%/),
      sugarMix: extract(txt, /当月甘蔗制糖比例\s*([\d.]+)%/),
      sugarMixPrev: extract(txt, /制糖比例\s*([\d.]+)%，去年同期为\s*([\d.]+)%/),
      sugarProdMt: extract(txt, /糖产量.*?(\d+)\s*万吨/),
      ethanolBil: extract(txt, /乙醇总产量\s*([\d.]+)\s*亿升/),
      atr: extract(txt, /ATR[（(]甘蔗总可回收糖分[）)]\s*([\d.]+)\s*公斤/)
    },
    cumulative: {
      crushMt: extract(txt, /累计压榨甘蔗\s*([\d.]+)\s*亿吨/),
      sugarMix: extract(txt, /甘蔗制糖比例\s*([\d.]+)%/),
      sugarMixPrev: extract(txt, /制糖比例\s*([\d.]+)%，上榨季同期为\s*([\d.]+)%/),
      ethanolBil: extract(txt, /累计乙醇总产量\s*([\d.]+)\s*亿升/)
    },
    fetchDate: new Date().toISOString().slice(0, 10)
  };
  // sugarMixPrev 正则实际取到的是 [mix, prev]，修正
  const m2 = txt.match(/当月甘蔗制糖比例\s*([\d.]+)%，去年同期为\s*([\d.]+)%/);
  if (m2) { result.month.sugarMix = +m2[1]; result.month.sugarMixPrev = +m2[2]; }
  const m3 = txt.match(/甘蔗制糖比例\s*([\d.]+)%，上榨季同期为\s*([\d.]+)%/);
  if (m3) { result.cumulative.sugarMix = +m3[1]; result.cumulative.sugarMixPrev = +m3[2]; }

  console.log('巴西 UNICA 解析结果:');
  console.log('  当月制糖比例:', result.month.sugarMix + '% (去年', result.month.sugarMixPrev + '%)');
  console.log('  累计制糖比例:', result.cumulative.sugarMix + '% (去年', result.cumulative.sugarMixPrev + '%)');
  console.log('  6月压榨:', result.month.caneCrushMt, '万吨');
  console.log('  6月糖产量:', result.month.sugarProdMt, '万吨');
  console.log('  6月乙醇:', result.month.ethanolBil, '亿升');

  fs.writeFileSync(path.join(D, 'brazil_unica.json'), JSON.stringify(result, null, 2));
  // 累积历史（时间追踪）
  append('brazil_sugarMix', '巴西当月制糖比例(%)', result.reportMonth, result.month.sugarMix);
  append('brazil_cumMix', '巴西累计制糖比例(%)', result.reportMonth, result.cumulative.sugarMix);
  console.log('\n已保存 data/brazil_unica.json（历史已追加）');
})();
