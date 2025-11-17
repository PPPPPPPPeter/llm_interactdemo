<template>
  <div class="floating-chat-container">
    <!-- 聊天按钮（收起状态） -->
    <transition name="fade">
      <button
          v-if="!isExpanded"
          class="chat-toggle-btn"
          @click="toggleChat"
          :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      >
        <span class="chat-icon">💬</span>
        <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
      </button>
    </transition>

    <!-- 聊天窗口（展开状态） -->
    <transition name="slide-up">
      <div
          v-if="isExpanded"
          class="chat-window"
          :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      >
        <!-- 头部 - 可拖动 -->
        <div
            class="chat-header"
            @mousedown="startDrag"
        >
          <div class="chat-title">
            <span class="ai-icon">🤖</span>
            <h3>AI Assistant</h3>
          </div>
          <div class="chat-actions">
            <button
                @click="handleClearChat"
                class="action-btn"
                title="Clear chat"
            >
              🗑️
            </button>
            <button
                @click="toggleChat"
                class="action-btn close-btn"
                title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- 消息列表 -->
        <div class="messages-container" ref="messagesContainer">
          <div
              v-for="message in messages"
              :key="message.id"
              :class="['message', message.role]"
          >
            <div class="message-bubble">
              <div class="message-content">{{ message.content }}</div>
              <div class="message-footer">
                <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                <button
                    v-if="message.role === 'user'"
                    @click="handleEditMessage(message.id)"
                    class="edit-btn"
                    title="Edit and resend"
                >
                  ✏️
                </button>
              </div>
            </div>
          </div>

          <!-- 流式输入中的消息 -->
          <div v-if="isStreaming" class="message assistant">
            <div class="message-bubble">
              <div class="message-content">
                {{ currentStreamingMessage }}
                <span class="typing-cursor">|</span>
              </div>
            </div>
          </div>

          <!-- Thinking 动画 -->
          <div v-if="isStreaming && !currentStreamingMessage" class="thinking-indicator">
            <div class="thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-container">
          <textarea
              v-model="inputMessage"
              @keydown="handleKeydown"
              placeholder="Type your message..."
              rows="1"
              ref="inputTextarea"
              :disabled="isStreaming"
          ></textarea>
          <button
              @click="handleSendMessage"
              class="send-btn"
              :disabled="!inputMessage.trim() || isStreaming"
          >
            <span v-if="!isStreaming">Send</span>
            <span v-else class="spinner">⏳</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useLangChain } from '../composables/useLangChain'

const {
  messages,
  isStreaming,
  currentStreamingMessage,
  sendMessage,
  editMessage,
  clearChat,
} = useLangChain()

// 窗口状态
const isExpanded = ref(false)
const inputMessage = ref('')
const messagesContainer = ref(null)
const inputTextarea = ref(null)
const unreadCount = ref(0)

// 窗口位置
const position = ref({
  x: window.innerWidth - 480, // 右下角
  y: window.innerHeight - 680,
})

// 拖动状态
const dragState = ref({
  isDragging: false,
  startX: 0,
  startY: 0,
  initialX: 0,
  initialY: 0,
})

// 切换聊天窗口
const toggleChat = () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    unreadCount.value = 0
    nextTick(() => {
      inputTextarea.value?.focus()
      scrollToBottom()
    })
  }
}

// 发送消息
const handleSendMessage = async () => {
  if (!inputMessage.value.trim() || isStreaming.value) return

  const message = inputMessage.value
  inputMessage.value = ''

  // 自动调整textarea高度
  if (inputTextarea.value) {
    inputTextarea.value.style.height = 'auto'
  }

  await sendMessage(message)
  scrollToBottom()
}

// 编辑消息
const handleEditMessage = (messageId) => {
  const content = editMessage(messageId)
  if (content) {
    inputMessage.value = content
    nextTick(() => {
      inputTextarea.value?.focus()
      autoResizeTextarea()
    })
  }
}

// 清空聊天
const handleClearChat = () => {
  if (confirm('Are you sure you want to clear the chat history?')) {
    clearChat()
  }
}

// 键盘事件
const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}

// 自动调整textarea高度
const autoResizeTextarea = () => {
  const textarea = inputTextarea.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// 格式化时间
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 拖动功能
const startDrag = (e) => {
  dragState.value.isDragging = true
  dragState.value.startX = e.clientX
  dragState.value.startY = e.clientY
  dragState.value.initialX = position.value.x
  dragState.value.initialY = position.value.y

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e) => {
  if (!dragState.value.isDragging) return

  const deltaX = e.clientX - dragState.value.startX
  const deltaY = e.clientY - dragState.value.startY

  position.value.x = dragState.value.initialX + deltaX
  position.value.y = dragState.value.initialY + deltaY

  // 限制在窗口范围内
  position.value.x = Math.max(0, Math.min(position.value.x, window.innerWidth - 400))
  position.value.y = Math.max(0, Math.min(position.value.y, window.innerHeight - 600))
}

const stopDrag = () => {
  dragState.value.isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 监听输入变化自动调整高度
watch(inputMessage, () => {
  autoResizeTextarea()
})

// 监听消息更新滚动到底部
watch(
    () => messages.value.length,
    () => {
      scrollToBottom()
    }
)

// 监听流式消息更新
watch(currentStreamingMessage, () => {
  scrollToBottom()
})

// 监听新消息（窗口收起时显示未读数）
watch(
    () => messages.value.length,
    (newLength, oldLength) => {
      if (!isExpanded.value && newLength > oldLength) {
        unreadCount.value++
      }
    }
)

// 窗口大小调整
const handleResize = () => {
  position.value.x = Math.min(position.value.x, window.innerWidth - 400)
  position.value.y = Math.min(position.value.y, window.innerHeight - 600)
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.floating-chat-container {
  position: fixed;
  z-index: 9999;
}

/* 聊天按钮 */
.chat-toggle-btn {
  position: fixed;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 10000;
}

.chat-toggle-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(78, 205, 196, 0.6);
}

.chat-icon {
  font-size: 28px;
}

.unread-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff4757;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  border: 2px solid white;
}

/* 聊天窗口 */
.chat-window {
  position: fixed;
  width: 400px;
  height: 600px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10000;
}

/* 头部 */
.chat-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-icon {
  font-size: 24px;
}

.chat-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.chat-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

/* 消息容器 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

/* 消息气泡 */
.message {
  display: flex;
  animation: fadeIn 0.3s ease-in;
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
}

.message.user .message-bubble {
  background: #4ECDC4;
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-bubble {
  background: white;
  color: #333;
  border: 1px solid #e0e0e0;
  border-bottom-left-radius: 4px;
}

.message-content {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.typing-cursor {
  animation: blink 1s infinite;
  font-weight: bold;
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  gap: 8px;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
}

.edit-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.edit-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* Thinking 动画 */
.thinking-indicator {
  display: flex;
  justify-content: flex-start;
  padding: 12px 16px;
}

.thinking-dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
}

.thinking-dots span {
  width: 8px;
  height: 8px;
  background: #4ECDC4;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.thinking-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.thinking-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

/* 输入区域 */
.input-container {
  padding: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 8px;
}

textarea {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  max-height: 120px;
  min-height: 40px;
}

textarea:focus {
  border-color: #4ECDC4;
}

textarea:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-btn {
  padding: 0 20px;
  background: #4ECDC4;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: #45b8b0;
  transform: translateY(-1px);
}

.send-btn:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 过渡动画 */
.fade-enter-active, .fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>