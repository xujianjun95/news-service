const cache = new Map();

function extractText(html) {
  // Remove script/style tags and their content
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, 4000);
}

async function fetchArticleText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(30000),
  });
  const html = await res.text();
  return extractText(html);
}

async function summarize(url, title) {
  if (cache.has(url)) return cache.get(url);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  let articleText = '';
  try {
    articleText = await fetchArticleText(url);
  } catch {
    // Hacker News 等讨论页无法抓取正文，用标题生成摘要
  }

  const prompt = articleText
    ? `你是一个资讯摘要助手。请根据以下文章内容，用中文写一篇 200-300 字的摘要，概括文章核心要点。要求分段输出，每段讲一个要点，段与段之间用换行符分隔。不要加标题，直接输出摘要正文。\n\n文章标题：${title}\n文章内容：${articleText}`
    : `你是一个资讯摘要助手。请根据以下标题，用中文写一篇 100-150 字的摘要，推测文章核心要点。要求分段输出，段与段之间用换行符分隔。不要加标题，直接输出摘要正文。\n\n标题：${title}`;

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const summary = data.choices?.[0]?.message?.content?.trim() || '';

  cache.set(url, summary);
  return summary;
}

module.exports = { summarize };
