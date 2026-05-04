const { fetchNews } = require('./fetcher');

let cachedNews = null;
let lastUpdated = null;

const UPDATE_INTERVAL = 2 * 60 * 60 * 1000; // 2 小时

function isQuietHours() {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 8;
}

async function refreshNews() {
  if (isQuietHours()) {
    console.log('[news] 静默时段（0:00-8:00），跳过更新');
    return;
  }

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
