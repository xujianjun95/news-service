const { fetchAllSources } = require('./fetcher');
const { filterAndSummarize } = require('./filter');

let cachedNews = null;
let lastUpdated = null;

const UPDATE_INTERVAL = 20 * 60 * 1000; // 20 分钟

async function refreshNews() {
  console.log('[news] 开始刷新资讯...');
  try {
    const rawItems = await fetchAllSources();
    console.log(`[news] 抓取到 ${rawItems.length} 条原始资讯`);

    const filtered = await filterAndSummarize(rawItems);
    console.log(`[news] AI 筛选后 ${filtered.length} 条`);

    cachedNews = filtered;
    lastUpdated = new Date().toISOString();
    console.log('[news] 资讯刷新完成');
  } catch (err) {
    console.error('[news] 刷新失败:', err.message);
  }
}

function getCachedNews() {
  return {
    updatedAt: lastUpdated,
    items: cachedNews || [],
  };
}

function startAutoRefresh() {
  refreshNews();
  setInterval(refreshNews, UPDATE_INTERVAL);
}

module.exports = { getCachedNews, startAutoRefresh, refreshNews };
