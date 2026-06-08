const Parser = require('rss-parser');

const RSSHUB_BASE = process.env.RSSHUB_URL || 'http://localhost:1200';
const AIHOT_FEATURED_FEED_URL = process.env.AIHOT_FEATURED_FEED_URL || 'https://aihot.virxact.com/feed.xml';
const MAX_NEWS_ITEMS = Number(process.env.MAX_NEWS_ITEMS) || 10;

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'PMTOOLS news-service/1.0 (+https://pmtools.com.cn)',
  },
});

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

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

async function generateSummary(title) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) return '';

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: `用中文写一句话摘要，不超过30字，直接输出摘要：${title}`,
        }],
        max_tokens: 50,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch {
    return '';
  }
}

async function fetch36kr() {
  try {
    const feed = await parser.parseURL(`${RSSHUB_BASE}/36kr/information/AI`);
    const items = feed.items.slice(0, 10);

    return await Promise.all(
      items.map(async (item) => {
        let summary = await fetchSummary(item.link);
        if (!summary || summary.length < 10) {
          summary = await generateSummary(item.title);
        }
        return {
          id: item.guid || item.link || item.title || '',
          title: item.title || '',
          summary: summary || (item.contentSnippet || '').slice(0, 50),
          source: '36kr',
          category: 'AI',
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          url: item.link || '',
        };
      })
    );
  } catch (err) {
    console.error('[fetcher] 36kr AI 抓取失败:', err.message);
    return [];
  }
}

function normalizeAIHotSource(author) {
  const text = cleanText(author);
  const match = text.match(/^[^(]*\((.*)\)$/);
  return match ? match[1] : text || 'AI HOT';
}

function normalizeAIHotItem(item) {
  const title = cleanText(item.title);
  const summary = cleanText(item.contentSnippet || item.content || item.description);
  const url = item.link || item.guid || '';

  return {
    id: item.guid || url || title,
    title,
    summary,
    source: normalizeAIHotSource(item.author || item.creator),
    category: 'AI',
    publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    url,
  };
}

async function fetchAIHotFeatured() {
  try {
    const feed = await parser.parseURL(AIHOT_FEATURED_FEED_URL);
    return feed.items.slice(0, 20).map(normalizeAIHotItem);
  } catch (err) {
    console.error('[fetcher] AI HOT 精选抓取失败:', err.message);
    return [];
  }
}

function dedup(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = cleanText(item.url || item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchNews() {
  const [news36kr, newsAIHot] = await Promise.all([
    fetch36kr(),
    fetchAIHotFeatured(),
  ]);

  return dedup([...news36kr, ...newsAIHot])
    .filter((item) => item.title && item.url)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_NEWS_ITEMS);
}

module.exports = { fetchNews };
