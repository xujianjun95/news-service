require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getCachedNews, startAutoRefresh } = require('./news/cache');

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/news', (req, res) => {
  res.json(getCachedNews());
});

app.listen(port, () => {
  console.log(`📰 资讯服务已启动，端口: ${port}`);
  startAutoRefresh();
});
