<template>
  <div
      class="feature"
      :class="{
        'editing-mode': isEditingScenarios,
        'connection-mode': isConnectionMode,
        'connection-source': isConnectionSource
      }"
      :style="featureStyle"
      @mousedown="handleMouseDown"
      @click="handleClick"
  >
    <!-- 调整大小手柄 - 仅4个角，编辑模式和连接模式下隐藏 -->
    <div
        v-if="!isEditingScenarios && !isConnectionMode"
        v-for="direction in cornerHandles"
        :key="direction"
        :class="['resize-handle', `resize-${direction}`]"
        @mousedown.stop="handleResizeStart($event, direction)"
    ></div>

    <!-- 连接模式指示器 -->
    <div v-if="isConnectionMode" class="connection-indicator">
      {{ isConnectionSource ? '✓ Selected' : 'Click to connect' }}
    </div>

    <!-- 内容区域 -->
    <div class="feature-header">
      <!-- 撤销/重做按钮 -->
      <div class="history-controls" v-if="!isConnectionMode">
        <button
            @click="undo"
            :disabled="!canUndo"
            class="history-btn"
            title="Undo (Cmd/Ctrl+Z)"
        >
          ↶
        </button>
        <button
            @click="redo"
            :disabled="!canRedo"
            class="history-btn"
            title="Redo (Cmd/Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      <input
          v-if="isEditingTitle"
          v-model="localTitle"
          @blur="saveTitle"
          @keyup.enter="saveTitle"
          class="title-input"
          ref="titleInput"
      />
      <h3 v-else @dblclick="editTitle" class="title">
        {{ feature.title }}
      </h3>

      <!-- Edit Scenarios / Confirm 按钮 -->
      <button
          v-if="!isConnectionMode"
          @click="toggleEditScenarios"
          :class="['edit-scenarios-btn', { 'confirm-btn': isEditingScenarios }]"
      >
        {{ isEditingScenarios ? 'Confirm' : 'Edit' }}
      </button>

      <button
          v-if="!isConnectionMode"
          @click="$emit('delete', feature.id)"
          class="delete-btn"
      >
        ×
      </button>
    </div>

    <div class="feature-content">
      <textarea
          v-model="localContent"
          @input="onContentChange"
          class="content-input"
          ref="contentInput"
          placeholder="Enter your content here..."
          :disabled="isConnectionMode"
      ></textarea>
    </div>

    <div class="feature-footer">
      {{ feature.width.toFixed(0) }} × {{ feature.height.toFixed(0) }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  feature: {
    type: Object,
    required: true
  },
  scale: {
    type: Number,
    default: 1
  },
  canvasWidth: {
    type: Number,
    required: true
  },
  canvasHeight: {
    type: Number,
    required: true
  },
  isConnectionMode: {
    type: Boolean,
    default: false
  },
  isConnectionSource: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update',
  'delete',
  'start-drag',
  'drag',
  'end-drag',
  'start-resize',
  'resize',
  'end-resize',
  'click-for-connection'
])

const cornerHandles = ['ne', 'se', 'sw', 'nw']

const isEditingTitle = ref(false)
const isEditingScenarios = ref(false)
const localTitle = ref(props.feature.title)
const localContent = ref(props.feature.content)
const titleInput = ref(null)
const contentInput = ref(null)

// 历史记录管理
const history = ref([])
const historyIndex = ref(-1)
const maxHistorySize = 50

// 保存编辑模式前的状态
const beforeEditState = ref(null)

// 计算属性
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const featureStyle = computed(() => ({
  left: `${props.feature.x}px`,
  top: `${props.feature.y}px`,
  width: `${props.feature.width}px`,
  height: `${props.feature.height}px`,
  background: props.feature.color,
  zIndex: isEditingScenarios.value ? 1000 : (props.isConnectionMode ? 10 : 1),
  cursor: props.isConnectionMode ? 'pointer' : (isEditingScenarios.value ? 'default' : 'move')
}))

// 初始化历史记录
const initHistory = () => {
  history.value = [{
    title: localTitle.value,
    content: localContent.value
  }]
  historyIndex.value = 0
}

// 添加历史记录
const addToHistory = (title, content) => {
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push({ title, content })

  if (history.value.length > maxHistorySize) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

// 撤销
const undo = () => {
  if (canUndo.value) {
    historyIndex.value--
    const state = history.value[historyIndex.value]
    localTitle.value = state.title
    localContent.value = state.content
    emit('update', props.feature.id, {
      title: state.title,
      content: state.content
    })
  }
}

// 重做
const redo = () => {
  if (canRedo.value) {
    historyIndex.value++
    const state = history.value[historyIndex.value]
    localTitle.value = state.title
    localContent.value = state.content
    emit('update', props.feature.id, {
      title: state.title,
      content: state.content
    })
  }
}

// 切换编辑模式
const toggleEditScenarios = () => {
  if (!isEditingScenarios.value) {
    // 进入编辑模式
    beforeEditState.value = {
      x: props.feature.x,
      y: props.feature.y,
      width: props.feature.width,
      height: props.feature.height
    }

    // 放大到1000x650
    emit('update', props.feature.id, {
      width: 1000,
      height: 650,
      isEditing: true
    })

    isEditingScenarios.value = true

    nextTick(() => {
      contentInput.value?.focus()
    })
  } else {
    // 退出编辑模式
    confirmEdit()
  }
}

// 确认编辑
const confirmEdit = () => {
  if (beforeEditState.value) {
    emit('update', props.feature.id, {
      x: beforeEditState.value.x,
      y: beforeEditState.value.y,
      width: beforeEditState.value.width,
      height: beforeEditState.value.height,
      isEditing: false
    })
    beforeEditState.value = null
  }
  isEditingScenarios.value = false
}

// 内容变化时添加到历史记录
let contentChangeTimer = null
const onContentChange = () => {
  clearTimeout(contentChangeTimer)
  contentChangeTimer = setTimeout(() => {
    addToHistory(localTitle.value, localContent.value)
    emit('update', props.feature.id, { content: localContent.value })
  }, 500)
}

// 键盘快捷键
const handleKeyDown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  }
  else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
    e.preventDefault()
    redo()
  }
  else if (e.key === 'Enter' && isEditingScenarios.value && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    confirmEdit()
  }
}

// 处理点击（用于连接模式）
const handleClick = (e) => {
  if (props.isConnectionMode) {
    e.stopPropagation()
    emit('click-for-connection', props.feature.id)
  }
}

// 拖动
const handleMouseDown = (e) => {
  // 连接模式或编辑模式下禁止拖动
  if (props.isConnectionMode || isEditingScenarios.value) return

  if (e.target.closest('.resize-handle') ||
      e.target.closest('.delete-btn') ||
      e.target.closest('.edit-scenarios-btn') ||
      e.target.closest('.history-btn') ||
      e.target.closest('input') ||
      e.target.closest('textarea')) {
    return
  }

  e.preventDefault()
  emit('start-drag', {
    id: props.feature.id,
    startX: e.clientX,
    startY: e.clientY
  })

  const handleMouseMove = (e) => {
    emit('drag', {
      clientX: e.clientX,
      clientY: e.clientY
    })
  }

  const handleMouseUp = () => {
    emit('end-drag')
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 调整大小
const handleResizeStart = (e, direction) => {
  e.preventDefault()
  e.stopPropagation()

  emit('start-resize', {
    id: props.feature.id,
    direction,
    startX: e.clientX,
    startY: e.clientY
  })

  const handleMouseMove = (e) => {
    emit('resize', {
      clientX: e.clientX,
      clientY: e.clientY
    })
  }

  const handleMouseUp = () => {
    emit('end-resize')
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 编辑标题
const editTitle = () => {
  if (props.isConnectionMode) return

  isEditingTitle.value = true
  nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
  })
}

const saveTitle = () => {
  isEditingTitle.value = false
  if (localTitle.value.trim() && localTitle.value !== props.feature.title) {
    addToHistory(localTitle.value, localContent.value)
    emit('update', props.feature.id, { title: localTitle.value })
  }
}

// 监听props变化
watch(() => props.feature.title, (newVal) => {
  localTitle.value = newVal
})

watch(() => props.feature.content, (newVal) => {
  localContent.value = newVal
})

onMounted(() => {
  initHistory()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  clearTimeout(contentChangeTimer)
})
</script>

<style scoped>
.feature {
  position: absolute;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: move;
  user-select: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s, z-index 0s;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.feature.editing-mode {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  cursor: default;
}

.feature.connection-mode {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature.connection-mode:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 24px rgba(78, 205, 196, 0.4);
}

.feature.connection-source {
  border: 3px solid #FFA07A;
  box-shadow: 0 0 0 4px rgba(255, 160, 122, 0.3);
}

.feature:hover:not(.connection-mode):not(.editing-mode) {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.connection-indicator {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: #FFA07A;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  z-index: 1000;
}

.resize-handle {
  position: absolute;
  background: white;
  border: 2px solid #333;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  z-index: 10;
  transition: all 0.2s;
}

.resize-handle:hover {
  background: #4ECDC4;
  border-color: #4ECDC4;
  transform: scale(1.2);
}

.resize-ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.resize-se {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.resize-sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.resize-nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.feature-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.history-controls {
  display: flex;
  gap: 4px;
}

.history-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 16px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  padding: 0;
}

.history-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.history-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
  flex: 1;
  cursor: text;
}

.title-input {
  flex: 1;
  background: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 16px;
  font-weight: 600;
  outline: none;
}

.edit-scenarios-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-weight: 500;
}

.edit-scenarios-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.edit-scenarios-btn.confirm-btn {
  background: rgba(76, 175, 80, 0.8);
}

.edit-scenarios-btn.confirm-btn:hover {
  background: rgba(76, 175, 80, 1);
}

.delete-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 24px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  line-height: 1;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: rgba(244, 67, 54, 0.8);
  transform: scale(1.1);
}

.feature-content {
  flex: 1;
  padding: 16px;
  overflow: auto;
  background: white;
}

.content-input {
  width: 100%;
  height: 100%;
  background: white;
  border: none;
  padding: 0;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;
  color: #333;
}

.content-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.content-input::placeholder {
  color: #999;
}

.feature-footer {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  text-align: right;
}
</style>