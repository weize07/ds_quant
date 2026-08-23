// 下载 ECharts 到本地（离线可用）+ 检查数据文件
const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url, redirects = 3) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) { get(res.headers.location, redirects - 1).then(resolve); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', () => resolve({ status: 0, body: Buffer.alloc(0) }));
  });
}

(async () => {
  const mirrors = [
    'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js',
    'https://cdn.bootcdn.net/ajax/libs/echarts/5.4.3/echarts.min.js',
    'https://unpkg.com/echarts@5.5.0/dist/echarts.min.js',
    'https://registry.npmmirror.com/echarts/5.4.3/files/dist/echarts.min.js'
  ];
  let ok = false;
  for (const m of mirrors) {
    const r = await get(m);
    if (r.status === 200 && r.body.length > 500000) {
      const dir = path.join('C:/Users/zewei/workspace/ds_quant', 'lib');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'echarts.min.js'), r.body);
      console.log('ECharts 下载成功:', m, '大小', (r.body.length / 1024).toFixed(0) + 'KB');
      ok = true;
      break;
    }
    console.log('源失败(' + r.status + ', ' + r.body.length + 'B):', m);
  }
  if (!ok) console.log('⚠️ 所有 CDN 均失败，dashboard 将使用 CDN 引用');

  // 检查数据文件
  console.log('\n=== 数据文件状态 ===');
  const D = 'C:/Users/zewei/workspace/ds_quant/data';
  for (const f of ['600737_daily.csv', 'SR0_daily.csv', 'ICE_sugar_daily.csv', 'ONI_enso.txt', 'fx_usdcny.json']) {
    const p = path.join(D, f);
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
      console.log(f, '| 行数', lines.length, '| 最新行:', lines[lines.length - 1].slice(0, 60));
    } else {
      console.log(f, '| 缺失');
    }
  }
})();
