// 深挖 UNICA 英文站 resultados 页：找双周报告和制糖比例
const https = require('https');
function get(url, headers) {
  return new Promise((resolve) => {
    const q = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8', ...(headers || {}) } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location, headers).then(resolve); return; }
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    });
    q.on('error', (e) => resolve({ s: 0, b: '' }));
  });
}

(async () => {
  console.log('=== UNICA resultados 页内容 ===');
  const r = await get('https://unica.com.br/en/resultados/');
  console.log('status', r.s, 'len', r.b.length);
  if (r.s !== 200) return;
  // 提取文本，找报告标题和百分比
  const txt = r.b.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&ccedil;|&atilde;|&ouml;/gi, ' ').replace(/\s+/g, ' ');
  // 找含 sugar/production/mix/% 的句子
  const sentences = txt.split(/[.!?]/);
  const relevant = sentences.filter(s => /sugar|production|mix|cane|ethanol|%|thousand|million/i.test(s) && s.length > 30).slice(0, 15);
  relevant.forEach(s => console.log('  ·', s.trim().slice(0, 130)));
  if (!relevant.length) console.log('  无相关内容，开头:', txt.slice(0, 200));

  // 找链接
  console.log('\n链接（含report/safra/harvest）:');
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{5,90})<\/a>/gi;
  let m;
  while ((m = re.exec(r.b))) links.push(m[2].trim() + ' → ' + m[1]);
  links.filter(l => /report|safra|harvest|milling|press|comunicado/i.test(l)).slice(0, 10).forEach(l => console.log('  ·', l.slice(0, 110)));
})();
