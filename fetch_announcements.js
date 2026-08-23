// 中粮糖业公告抓取（巨潮资讯）+ 药用糖等关键词过滤
const http = require('http');
const https = require('https');

function postForm(url, formData) {
  const mod = url.startsWith('https') ? https : http;
  const body = Object.entries(formData).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  return new Promise((resolve) => {
    const req = mod.request(url, {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'Referer': 'http://www.cninfo.com.cn/' }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    req.on('error', (e) => resolve({ s: 0, b: 'ERR ' + e.message }));
    req.write(body);
    req.end();
  });
}

(async () => {
  // 1. 搜索 orgId
  const r1 = await postForm('http://www.cninfo.com.cn/new/information/topSearch/query', { keyWord: '中粮糖业', maxNum: '10' });
  console.log('搜索 status', r1.s, '内容:', r1.b.slice(0, 300));
  let orgId = null;
  try {
    const j = JSON.parse(r1.b);
    const item = (Array.isArray(j) ? j : (j.data || []))[0];
    if (item) { orgId = item.orgId; console.log('orgId:', orgId, '代码:', item.code); }
  } catch (e) { console.log('搜索解析失败'); }

  if (!orgId) return;

  // 2. 按日期段抓取 2025 年公告（药用糖事件密集期）
  const r2 = await postForm('http://www.cninfo.com.cn/new/hisAnnouncement/query', {
    pageNum: '1', pageSize: '100', column: 'sse', tabName: 'fulltext', plate: '',
    stock: '600737,' + orgId, searchkey: '', secid: '', category: '', trade: '',
    seDate: '2025-01-01~2025-09-30', sortName: '', sortType: '', isHLtitle: 'true'
  });
  try {
    const j = JSON.parse(r2.b);
    const list = j.announcements || [];
    console.log('\n2025年1-9月公告（' + list.length + ' 条）：');
    for (const a of list) {
      const title = (a.announcementTitle || '').replace(/<[^>]+>/g, '');
      const date = a.announcementTime ? new Date(a.announcementTime).toISOString().slice(0, 10) : '?';
      console.log('  [' + date + '] ' + title);
    }
  } catch (e) { console.log('解析失败', r2.b.slice(0, 150)); }
})();
