const { fetchNews } = require('./fetcher');

let cachedNews = null;
let lastUpdated = null;

const UPDATE_INTERVAL = 20 * 60 * 1000; // 20 分钟

async function refreshNews() {
  console.log('[news] 开始刷新资讯...');
  try {
    const items = await fetchNews();
    console.log(`[news] 获取到 ${items.length} 条资讯`);

    cachedNews = items;
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
