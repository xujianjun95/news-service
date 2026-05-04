require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getCachedNews, startAutoRefresh } = require('./news/cache');
const { summarize } = require('./news/summarizer');

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/news', (req, res) => {
  res.json(getCachedNews());
});

app.post('/api/summarize', async (req, res) => {
  const { url, title } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const summary = await summarize(url, title || '');
    res.json({ summary });
  } catch (err) {
    console.error('[summarize] 错误:', err.message);
    res.status(500).json({ error: '总结生成失败，请稍后再试' });
  }
});

app.listen(port, () => {
  console.log(`📰 资讯服务已启动，端口: ${port}`);
  startAutoRefresh();
});
