const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API 配置
const API_KEYS = {
    deepseek: 'sk-a38801e819a64a6aa126692dab71c76e', // DeepSeek API Key
    openai: '',   // OpenAI API Key
    google: ''    // Google API Key
};

// API 端点配置
const API_ENDPOINTS = {
    deepseek: 'https://api.deepseek.com/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions',
    google: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// 模型到提供商的映射
const MODEL_PROVIDER_MAP = {
    'deepseek-chat': 'deepseek',
    'deepseek-reasoner': 'deepseek',
    'gpt-4': 'openai',
    'gpt-4-turbo': 'openai',
    'gpt-3.5-turbo': 'openai',
    'gemini-2.0-flash-exp': 'google',
    'gemini-1.5-pro': 'google',
    'gemini-1.5-flash': 'google'
};

// LLM 聊天 API 调用路由
app.post('/api/chat', async (req, res) => {
    try {
        const { model, messages, stream = false } = req.body;

        if (!model || !messages) {
            return res.status(400).json({ error: '缺少必要参数: model 和 messages' });
        }

        const provider = MODEL_PROVIDER_MAP[model];
        if (!provider) {
            return res.status(400).json({ error: `不支持的模型: ${model}` });
        }

        const apiKey = API_KEYS[provider];
        if (!apiKey) {
            return res.status(500).json({ error: `未配置 ${provider} 的 API Key` });
        }

        const endpoint = API_ENDPOINTS[provider];

        // 根据不同提供商调用 API
        let response;
        if (provider === 'google') {
            response = await callGoogleAPI(endpoint, apiKey, model, messages);
        } else {
            response = await callOpenAICompatibleAPI(endpoint, apiKey, model, messages, stream);
        }

        res.json(response);
    } catch (error) {
        console.error('LLM API 调用错误:', error);
        res.status(500).json({
            error: 'API 调用失败',
            details: error.message
        });
    }
});

// 调用 OpenAI 兼容的 API (DeepSeek, OpenAI)
async function callOpenAICompatibleAPI(endpoint, apiKey, model, messages, stream) {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            stream
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

// 调用 Google API
async function callGoogleAPI(endpoint, apiKey, model, messages) {
    const fetch = (await import('node-fetch')).default;

    // 转换消息格式为 Google 格式
    const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const googleEndpoint = `${endpoint}/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(googleEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API 请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 转换回 OpenAI 格式以保持一致性
    return {
        choices: [{
            message: {
                role: 'assistant',
                content: data.candidates[0]?.content?.parts[0]?.text || ''
            }
        }]
    };
}

// 获取可用模型列表
app.get('/api/models', (req, res) => {
    const models = Object.keys(MODEL_PROVIDER_MAP).map(modelName => ({
        id: modelName,
        provider: MODEL_PROVIDER_MAP[modelName],
        available: !!API_KEYS[MODEL_PROVIDER_MAP[modelName]]
    }));

    res.json({
        models,
        timestamp: new Date().toISOString()
    });
});

// 基础路由
app.get('/', (req, res) => {
    res.json({
        message: 'LLM Intera 后端服务器运行中!',
        timestamp: new Date().toISOString(),
        endpoints: {
            chat: 'POST /api/chat - LLM 聊天接口',
            models: 'GET /api/models - 获取可用模型列表',
            health: 'GET /api/health - 健康检查',
            data: 'GET /api/data - 获取示例数据',
            message: 'POST /api/message - 消息接收示例'
        }
    });
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: '后端服务正常运行',
        timestamp: new Date().toISOString()
    });
});

// 获取示例数据（保留原有路由）
app.get('/api/data', (req, res) => {
    res.json({
        items: [
            { id: 1, name: '项目 A', value: 100 },
            { id: 2, name: '项目 B', value: 200 },
            { id: 3, name: '项目 C', value: 300 }
        ]
    });
});

// 接收数据示例（保留原有路由）
app.post('/api/message', (req, res) => {
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

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 后端服务器运行在 http://localhost:${PORT}`);
    Object.keys(MODEL_PROVIDER_MAP).forEach(model => {
        const provider = MODEL_PROVIDER_MAP[model];
        const status = API_KEYS[provider] ? '✅' : '❌';
        console.log(`   ${status} ${model} (${provider})`);
    });
});

module.exports = app;