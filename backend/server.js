const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 路由
app.use('/api', apiRoutes);

// 基础路由
app.get('/', (req, res) => {
    res.json({
        message: 'LLM Intera 后端服务器运行中!',
        timestamp: new Date().toISOString()
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 后端服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 环境: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;