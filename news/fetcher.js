const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

const RSSHUB_BASE = process.env.RSSHUB_URL || 'https://rsshub.app';

const SOURCES = [
  { name: '机器之心', url: `${RSSHUB_BASE}/jiqizhixin`, category: 'AI' },
  { name: '量子位', url: `${RSSHUB_BASE}/qbitai`, category: 'AI' },
  { name: '36kr', url: `${RSSHUB_BASE}/36kr/motif/452`, category: '科技' },
];

async function fetchAllSources() {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        return feed.items.slice(0, 15).map((item) => ({
          title: item.title || '',
          description: (item.contentSnippet || item.content || '').slice(0, 300),
          source: source.name,
          category: source.category,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          url: item.link || '',
        }));
      } catch (err) {
        console.error(`[fetcher] ${source.name} 抓取失败:`, err.message);
        return [];
      }
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

module.exports = { fetchAllSources };
