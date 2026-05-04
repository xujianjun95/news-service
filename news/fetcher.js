const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

const RSSHUB_BASE = process.env.RSSHUB_URL || 'http://localhost:1200';

async function fetchNews() {
  try {
    const feed = await parser.parseURL(`${RSSHUB_BASE}/36kr/information/AI`);
    return feed.items.slice(0, 10).map((item) => ({
      title: item.title || '',
      summary: (item.contentSnippet || '').slice(0, 100),
      source: '36kr',
      category: 'AI',
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      url: item.link || '',
    }));
  } catch (err) {
    console.error('[fetcher] 36kr AI 抓取失败:', err.message);
    return [];
  }
}

module.exports = { fetchNews };
