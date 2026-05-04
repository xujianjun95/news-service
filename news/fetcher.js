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

async function fetchAIBase() {
  try {
    const feed = await parser.parseURL(`${RSSHUB_BASE}/aibase/daily`);
    const items = feed.items.slice(0, 10);

    return await Promise.all(
      items.map(async (item) => {
        const title = (item.title || '').replace(/^AI日报[：:]\s*/, '');
        let summary = (item.contentSnippet || '').slice(0, 80);
        if (!summary || summary.length < 10) {
          summary = await generateSummary(title);
        }
        return {
          title,
          summary,
          source: 'AIBase',
          category: 'AI',
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          url: item.link || '',
        };
      })
    );
  } catch (err) {
    console.error('[fetcher] AIBase 抓取失败:', err.message);
    return [];
  }
}

const AI_KEYWORDS = /\b(ai|artificial.intelligence|llm|gpt|openai|anthropic|claude|gemini|deepseek|machine.learning|deep.learning|neural|transformer|diffusion|stable.diffusion|midjourney|copilot|chatbot|model|推理|大模型|人工智能)\b/i;

function isAIRelated(title) {
  return AI_KEYWORDS.test(title);
}

async function translateToChinese(text) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) return text;

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
          content: `将以下英文翻译成中文，直接输出翻译结果：${text}`,
        }],
        max_tokens: 100,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

async function fetchHackerNews() {
  try {
    const feed = await parser.parseURL(`${RSSHUB_BASE}/hackernews`);
    const aiItems = feed.items.filter((item) => isAIRelated(item.title)).slice(0, 5);

    return await Promise.all(
      aiItems.map(async (item) => {
        const originalTitle = item.title || '';
        const title = await translateToChinese(originalTitle);
        const summary = await generateSummary(title);
        return {
          title,
          summary: summary || (item.contentSnippet || '').slice(0, 50),
          source: 'Hacker News',
          category: 'AI',
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          url: item.link || '',
        };
      })
    );
  } catch (err) {
    console.error('[fetcher] Hacker News 抓取失败:', err.message);
    return [];
  }
}

function dedup(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.title.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchNews() {
  const [news36kr, newsAIBase, newsHN] = await Promise.all([
    fetch36kr(),
    fetchAIBase(),
    fetchHackerNews(),
  ]);

  return dedup([...news36kr, ...newsAIBase, ...newsHN])
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 10);
}

module.exports = { fetchNews };
