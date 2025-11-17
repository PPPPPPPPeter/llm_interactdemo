import { ref } from 'vue'
// import { ChatOpenAI } from '@langchain/openai'
// import { BufferMemory } from 'langchain/memory'
// import { ConversationChain } from 'langchain/chains'

export const useLangChain = () => {
    const messages = ref([])
    const isStreaming = ref(false)
    const currentStreamingMessage = ref('')

    // 发送消息
    const sendMessage = async (userMessage) => {
        if (!userMessage.trim() || isStreaming.value) return

        // 添加用户消息
        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            content: userMessage,
            timestamp: new Date(),
        }
        messages.value.push(userMsg)

        // 准备AI响应
        isStreaming.value = true
        currentStreamingMessage.value = ''

        const assistantMsg = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
        }
        messages.value.push(assistantMsg)

        try {
            // 构建对话历史
            const chatMessages = messages.value
                .filter(m => m.role !== 'assistant' || m.content)
                .map(m => ({
                    role: m.role,
                    content: m.content
                }))

            // 调用后端流式接口
            const response = await fetch('http://localhost:3000/api/chat-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: chatMessages
                }),
            })

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') {
                            break
                        }
                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.content) {
                                currentStreamingMessage.value += parsed.content
                                assistantMsg.content = currentStreamingMessage.value
                            }
                        } catch (e) {
                            console.error('Parse error:', e)
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error sending message:', error)
            assistantMsg.content = 'Sorry, an error occurred. Please try again.'
        } finally {
            isStreaming.value = false
            currentStreamingMessage.value = ''
        }
    }

    // 编辑消息（撤回到输入框）
    const editMessage = (messageId) => {
        const index = messages.value.findIndex((m) => m.id === messageId)
        if (index === -1) return null

        const message = messages.value[index]
        // 删除该消息及之后的所有消息
        messages.value = messages.value.slice(0, index)

        return message.content
    }

    // 清空对话
    const clearChat = () => {
        messages.value = []
    }

    return {
        messages,
        isStreaming,
        currentStreamingMessage,
        sendMessage,
        editMessage,
        clearChat,
    }
}