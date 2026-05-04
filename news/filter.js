require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

async function filterAndSummarize(items) {
  if (!items.length) return [];

  const itemList = items
    .map((item, i) => `${i + 1}. [${item.source}] ${item.title}\n   ${item.description}`)
    .join('\n');

  const prompt = `你是一个 AI 资讯编辑。以下是 ${items.length} 条最新资讯，请从中筛选出最有价值的 20 条。

筛选标准：
- 优先选择影响力大的内容（大公司发布、重大技术突破、行业趋势）
- 去掉水文、广告、重复内容
- 保持 AI 和泛科技的平衡

对每条筛选出的资讯，请生成：
1. 一个分类标签（从以下选择：AI、硬件、应用、研究、行业、开源）
2. 50 字以内的中文总结

资讯列表：
${itemList}

请严格按以下 JSON 格式返回，不要输出其他内容：
{
  "selected": [
    {
      "index": 1,
      "category": "AI",
      "summary": "50字以内的总结"
    }
  ]
}`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[filter] DeepSeek API error:', response.status, errorText);
      return items.slice(0, 20).map((item) => ({
        ...item,
        category: item.category || 'AI',
        summary: item.description.slice(0, 50),
      }));
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[filter] 无法解析 AI 返回的 JSON');
      return items.slice(0, 20).map((item) => ({
        ...item,
        category: item.category || 'AI',
        summary: item.description.slice(0, 50),
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.selected || [])
      .filter((s) => s.index >= 1 && s.index <= items.length)
      .map((s) => ({
        ...items[s.index - 1],
        category: s.category || 'AI',
        summary: (s.summary || '').slice(0, 50),
      }));
  } catch (err) {
    console.error('[filter] 筛选失败:', err.message);
    return items.slice(0, 20).map((item) => ({
      ...item,
      category: item.category || 'AI',
      summary: item.description.slice(0, 50),
    }));
  }
}

module.exports = { filterAndSummarize };
