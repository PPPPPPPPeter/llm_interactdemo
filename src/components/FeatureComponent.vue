<template>
  <div
      class="feature"
      :style="featureStyle"
      @mousedown="handleMouseDown"
  >
    <!-- 调整大小手柄 - 仅4个角 -->
    <div
        v-for="direction in cornerHandles"
        :key="direction"
        :class="['resize-handle', `resize-${direction}`]"
        @mousedown.stop="handleResizeStart($event, direction)"
    ></div>

    <!-- 内容区域 -->
    <div class="feature-header">
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
      <button @click="$emit('delete', feature.id)" class="delete-btn">
        ×
      </button>
    </div>

    <div class="feature-content">
      <textarea
          v-if="isEditingContent"
          v-model="localContent"
          @blur="saveContent"
          class="content-input"
          ref="contentInput"
      ></textarea>
      <p v-else @dblclick="editContent" class="content">
        {{ feature.content }}
      </p>
    </div>

    <div class="feature-footer">
      {{ feature.width.toFixed(0) }} × {{ feature.height.toFixed(0) }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

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
  'end-resize'
])

// 仅保留4个角的调整手柄
const cornerHandles = ['ne', 'se', 'sw', 'nw']

const isEditingTitle = ref(false)
const isEditingContent = ref(false)
const localTitle = ref(props.feature.title)
const localContent = ref(props.feature.content)
const titleInput = ref(null)
const contentInput = ref(null)

const featureStyle = computed(() => ({
  left: `${props.feature.x}px`,
  top: `${props.feature.y}px`,
  width: `${props.feature.width}px`,
  height: `${props.feature.height}px`,
  background: props.feature.color
}))

// 拖动
const handleMouseDown = (e) => {
  if (e.target.closest('.resize-handle') ||
      e.target.closest('.delete-btn') ||
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
  isEditingTitle.value = true
  localTitle.value = props.feature.title
  nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
  })
}

const saveTitle = () => {
  isEditingTitle.value = false
  if (localTitle.value.trim()) {
    emit('update', props.feature.id, { title: localTitle.value })
  }
}

// 编辑内容
const editContent = () => {
  isEditingContent.value = true
  localContent.value = props.feature.content
  nextTick(() => {
    contentInput.value?.focus()
  })
}

const saveContent = () => {
  isEditingContent.value = false
  if (localContent.value.trim()) {
    emit('update', props.feature.id, { content: localContent.value })
  }
}
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
  transition: box-shadow 0.2s;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.feature:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
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
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
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
}

.delete-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.feature-content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.content {
  margin: 0;
  color: white;
  font-size: 14px;
  line-height: 1.6;
  cursor: text;
  white-space: pre-wrap;
}

.content-input {
  width: 100%;
  height: 100%;
  background: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;
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