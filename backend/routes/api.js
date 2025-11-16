const express = require('express');
const router = express.Router();

// 示例 API 路由
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: '后端服务正常运行',
        timestamp: new Date().toISOString()
    });
});

// 获取示例数据
router.get('/data', (req, res) => {
    res.json({
        items: [
            { id: 1, name: '项目 A', value: 100 },
            { id: 2, name: '项目 B', value: 200 },
            { id: 3, name: '项目 C', value: 300 }
        ]
    });
});

// 接收数据示例
router.post('/message', (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: '消息内容不能为空' });
    }

    res.json({
        received: message,
        response: `已收到你的消息: "${message}"`,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;