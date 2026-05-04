const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

const RSSHUB_BASE = process.env.RSSHUB_URL || 'http://localhost:1200';

async function fetchSummary(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const match = html.match(/"summary":"([^"]*)"/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

async function fetchNews() {
  try {
    const feed = await parser.parseURL(`${RSSHUB_BASE}/36kr/information/AI`);
    const items = feed.items.slice(0, 10);

    const results = await Promise.all(
      items.map(async (item) => {
        const summary = await fetchSummary(item.link);
        return {
          title: item.title || '',
          summary: summary || (item.contentSnippet || '').slice(0, 50),
          source: '36kr',
          category: 'AI',
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          url: item.link || '',
        };
      })
    );

    return results;
  } catch (err) {
    console.error('[fetcher] 36kr AI 抓取失败:', err.message);
    return [];
  }
}

module.exports = { fetchNews };
