<template>
  <div class="canvas-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div
          class="add-feature-btn"
          @mousedown="startCreateFeature"
          draggable="false"
      >
        <span class="icon">+</span>
        <span>Drag to add a feature</span>
      </div>

      <div class="zoom-controls">
        <button @click="zoomOut" class="btn btn-icon">-</button>
        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
        <button @click="zoomIn" class="btn btn-icon">+</button>
      </div>
      <div class="info">
        Features: {{ rectangles.length }}
      </div>
    </div>

    <!-- 画布区域 -->
    <div
        class="canvas-wrapper"
        ref="canvasWrapper"
        @wheel="handleWheel"
    >
      <div
          class="canvas"
          :style="canvasStyle"
          ref="canvas"
      >
        <!-- 预览矩形（拖动创建时） -->
        <div
            v-if="creationState.isCreating"
            class="rectangle preview-rectangle"
            :style="previewFeatureStyle"
        >
          <div class="rectangle-header">
            <h3 class="title">New Feature</h3>
          </div>
        </div>

        <!-- 矩形组件 -->
        <FeatureComponent
            v-for="rect in rectangles"
            :key="rect.id"
            :feature="rect"
            :scale="scale"
            :canvasWidth="CANVAS_WIDTH"
            :canvasHeight="CANVAS_HEIGHT"
            @update="updateFeature"
            @delete="deleteFeature"
            @start-drag="startDrag"
            @drag="drag"
            @end-drag="endDrag"
            @start-resize="startResize"
            @resize="resize"
            @end-resize="endResize"
        />
      </div>
    </div>
    <!-- 浮动聊天窗口 -->
    <FloatingChatWindow />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import FeatureComponent from './FeatureComponent.vue'
import FloatingChatWindow from './FloatingChatWindow.vue'

// 画布尺寸限制
const CANVAS_WIDTH = 8000
const CANVAS_HEIGHT = 7000

// 画布状态
const canvasWrapper = ref(null)
const canvas = ref(null)
const scale = ref(1)

// 矩形列表
const rectangles = ref([])
let nextId = 1

// 颜色池 - 每个feature使用不同颜色
const colorPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#FF8E53', '#6C5CE7', '#00B894', '#FDCB6E',
  '#E17055', '#74B9FF', '#A29BFE', '#FD79A8',
  '#FF7675', '#55EFC4', '#81ECEC', '#FAB1A0'
]
let colorIndex = 0

// 获取下一个颜色
const getNextColor = () => {
  const color = colorPalette[colorIndex % colorPalette.length]
  colorIndex++
  return color
}

// 创建矩形状态
const creationState = reactive({
  isCreating: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
})

// 拖动和调整大小状态
const dragState = reactive({
  isDragging: false,
  isResizing: false,
  currentRect: null,
  startX: 0,
  startY: 0,
  resizeDirection: null
})

// 画布样式 - 修复缩放问题
const canvasStyle = computed(() => {
  // 画布的实际显示尺寸
  const displayWidth = CANVAS_WIDTH * scale.value
  const displayHeight = CANVAS_HEIGHT * scale.value

  return {
    width: `${CANVAS_WIDTH}px`,
    height: `${CANVAS_HEIGHT}px`,
    transform: `scale(${scale.value})`,
    transformOrigin: '0 0',
    // 确保容器能够容纳缩放后的画布
    minWidth: `${displayWidth}px`,
    minHeight: `${displayHeight}px`,
  }
})

// 预览矩形样式
const previewFeatureStyle = computed(() => {
  if (!creationState.isCreating) return {}

  const wrapper = canvasWrapper.value
  if (!wrapper) return {}

  const rect = wrapper.getBoundingClientRect()
  const scrollLeft = wrapper.scrollLeft
  const scrollTop = wrapper.scrollTop

  // 计算画布坐标
  let canvasX = (creationState.currentX - rect.left + scrollLeft) / scale.value
  let canvasY = (creationState.currentY - rect.top + scrollTop) / scale.value

  // 限制在画布范围内
  canvasX = Math.max(100, Math.min(CANVAS_WIDTH - 100, canvasX))
  canvasY = Math.max(75, Math.min(CANVAS_HEIGHT - 75, canvasY))

  return {
    left: `${canvasX - 100}px`,
    top: `${canvasY - 75}px`,
    width: '200px',
    height: '150px',
    background: colorPalette[colorIndex % colorPalette.length],
    opacity: 0.7
  }
})

// 开始创建矩形
const startCreateFeature = (e) => {
  e.preventDefault()
  creationState.isCreating = true
  creationState.startX = e.clientX
  creationState.startY = e.clientY
  creationState.currentX = e.clientX
  creationState.currentY = e.clientY

  const handleMouseMove = (e) => {
    if (creationState.isCreating) {
      creationState.currentX = e.clientX
      creationState.currentY = e.clientY
    }
  }

  const handleMouseUp = (e) => {
    if (creationState.isCreating) {
      const wrapper = canvasWrapper.value
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect()
        const scrollLeft = wrapper.scrollLeft
        const scrollTop = wrapper.scrollTop

        let canvasX = (e.clientX - rect.left + scrollLeft) / scale.value
        let canvasY = (e.clientY - rect.top + scrollTop) / scale.value

        // 限制在画布范围内
        canvasX = Math.max(100, Math.min(CANVAS_WIDTH - 100, canvasX))
        canvasY = Math.max(75, Math.min(CANVAS_HEIGHT - 75, canvasY))

        // 创建矩形
        addFeatureAt(canvasX - 100, canvasY - 75)
      }
    }

    creationState.isCreating = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 在指定位置添加矩形
const addFeatureAt = (x, y) => {
  const newRect = {
    id: nextId++,
    x: Math.max(0, Math.min(x, CANVAS_WIDTH - 200)),
    y: Math.max(0, Math.min(y, CANVAS_HEIGHT - 150)),
    width: 300,
    height: 200,
    color: getNextColor(),
    title: `Feature ${rectangles.value.length + 1}`,
    content: 'Double click to edit'
  }

  // 检查位置是否有效
  if (isPositionValid(newRect.id, newRect.x, newRect.y, newRect.width, newRect.height)) {
    rectangles.value.push(newRect)
  } else {
    // 如果位置重叠，尝试偏移
    let offset = 20
    let attempts = 0
    while (attempts < 10) {
      const newX = Math.max(0, Math.min(x + offset * attempts, CANVAS_WIDTH - 200))
      const newY = Math.max(0, Math.min(y + offset * attempts, CANVAS_HEIGHT - 150))
      newRect.x = newX
      newRect.y = newY
      if (isPositionValid(newRect.id, newRect.x, newRect.y, newRect.width, newRect.height)) {
        rectangles.value.push(newRect)
        break
      }
      attempts++
    }
  }
}

// 删除矩形
const deleteFeature = (id) => {
  const index = rectangles.value.findIndex(r => r.id === id)
  if (index !== -1) {
    rectangles.value.splice(index, 1)
  }
}

// 更新矩形
const updateFeature = (id, updates) => {
  const rect = rectangles.value.find(r => r.id === id)
  if (rect) {
    Object.assign(rect, updates)
  }
}

// 检查矩形是否重叠
const checkOverlap = (rect1, rect2) => {
  const margin = 5
  return !(
      rect1.x + rect1.width + margin <= rect2.x ||
      rect2.x + rect2.width + margin <= rect1.x ||
      rect1.y + rect1.height + margin <= rect2.y ||
      rect2.y + rect2.height + margin <= rect1.y
  )
}

// 检查位置是否与其他矩形重叠
const isPositionValid = (id, x, y, width, height) => {
  // 检查是否在画布范围内
  if (x < 0 || y < 0 || x + width > CANVAS_WIDTH || y + height > CANVAS_HEIGHT) {
    return false
  }

  const tempRect = { x, y, width, height }
  return !rectangles.value.some(rect =>
      rect.id !== id && checkOverlap(tempRect, rect)
  )
}

// 开始拖动
const startDrag = ({ id, startX, startY }) => {
  dragState.isDragging = true
  dragState.currentRect = rectangles.value.find(r => r.id === id)
  dragState.startX = startX
  dragState.startY = startY
}

// 拖动中
const drag = ({ clientX, clientY }) => {
  if (!dragState.isDragging || !dragState.currentRect) return

  const deltaX = (clientX - dragState.startX) / scale.value
  const deltaY = (clientY - dragState.startY) / scale.value

  const newX = dragState.currentRect.x + deltaX
  const newY = dragState.currentRect.y + deltaY

  if (isPositionValid(
      dragState.currentRect.id,
      newX,
      newY,
      dragState.currentRect.width,
      dragState.currentRect.height
  )) {
    dragState.currentRect.x = newX
    dragState.currentRect.y = newY
  }

  dragState.startX = clientX
  dragState.startY = clientY
}

// 结束拖动
const endDrag = () => {
  dragState.isDragging = false
  dragState.currentRect = null
}

// 开始调整大小
const startResize = ({ id, direction, startX, startY }) => {
  dragState.isResizing = true
  dragState.currentRect = rectangles.value.find(r => r.id === id)
  dragState.resizeDirection = direction
  dragState.startX = startX
  dragState.startY = startY
}

// 调整大小中
const resize = ({ clientX, clientY }) => {
  if (!dragState.isResizing || !dragState.currentRect) return

  const deltaX = (clientX - dragState.startX) / scale.value
  const deltaY = (clientY - dragState.startY) / scale.value

  const rect = dragState.currentRect
  const direction = dragState.resizeDirection

  let newX = rect.x
  let newY = rect.y
  let newWidth = rect.width
  let newHeight = rect.height

  const minWidth = 250
  const minHeight = 180

  if (direction.includes('e')) {
    newWidth = Math.max(minWidth, rect.width + deltaX)
  }
  if (direction.includes('w')) {
    const potentialWidth = Math.max(minWidth, rect.width - deltaX)
    if (potentialWidth >= minWidth) {
      newX = rect.x + deltaX
      newWidth = potentialWidth
    }
  }
  if (direction.includes('s')) {
    newHeight = Math.max(minHeight, rect.height + deltaY)
  }
  if (direction.includes('n')) {
    const potentialHeight = Math.max(minHeight, rect.height - deltaY)
    if (potentialHeight >= minHeight) {
      newY = rect.y + deltaY
      newHeight = potentialHeight
    }
  }

  if (isPositionValid(rect.id, newX, newY, newWidth, newHeight)) {
    rect.x = newX
    rect.y = newY
    rect.width = newWidth
    rect.height = newHeight
    dragState.startX = clientX
    dragState.startY = clientY
  }
}

// 结束调整大小
const endResize = () => {
  dragState.isResizing = false
  dragState.currentRect = null
  dragState.resizeDirection = null
}

// 缩放控制
let lastWheelTime = 0
let wheelDeltaBuffer = 0
const WHEEL_THROTTLE = 30
const SCALE_SENSITIVITY = 0.003

const handleWheel = (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()

    const now = Date.now()
    wheelDeltaBuffer += e.deltaY

    if (now - lastWheelTime < WHEEL_THROTTLE) {
      return
    }

    lastWheelTime = now

    const delta = -wheelDeltaBuffer * SCALE_SENSITIVITY
    wheelDeltaBuffer = 0

    const oldScale = scale.value
    const newScale = Math.min(Math.max(0.1, scale.value + delta), 3)

    if (oldScale === newScale) return

    const wrapper = canvasWrapper.value
    if (!wrapper) return

    const rect = wrapper.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const scrollLeft = wrapper.scrollLeft
    const scrollTop = wrapper.scrollTop

    const scaleRatio = newScale / oldScale

    const newScrollLeft = (scrollLeft + mouseX) * scaleRatio - mouseX
    const newScrollTop = (scrollTop + mouseY) * scaleRatio - mouseY

    scale.value = newScale

    requestAnimationFrame(() => {
      wrapper.scrollLeft = newScrollLeft
      wrapper.scrollTop = newScrollTop
    })
  }
}

const zoomIn = () => {
  const wrapper = canvasWrapper.value
  if (!wrapper) return

  const oldScale = scale.value
  const newScale = Math.min(3, scale.value * 1.2)

  const centerX = wrapper.clientWidth / 2
  const centerY = wrapper.clientHeight / 2

  const scrollLeft = wrapper.scrollLeft
  const scrollTop = wrapper.scrollTop

  const scaleRatio = newScale / oldScale

  const newScrollLeft = (scrollLeft + centerX) * scaleRatio - centerX
  const newScrollTop = (scrollTop + centerY) * scaleRatio - centerY

  scale.value = newScale

  requestAnimationFrame(() => {
    wrapper.scrollLeft = newScrollLeft
    wrapper.scrollTop = newScrollTop
  })
}

const zoomOut = () => {
  const wrapper = canvasWrapper.value
  if (!wrapper) return

  const oldScale = scale.value
  const newScale = Math.max(0.1, scale.value / 1.2)

  const centerX = wrapper.clientWidth / 2
  const centerY = wrapper.clientHeight / 2

  const scrollLeft = wrapper.scrollLeft
  const scrollTop = wrapper.scrollTop

  const scaleRatio = newScale / oldScale

  const newScrollLeft = (scrollLeft + centerX) * scaleRatio - centerX
  const newScrollTop = (scrollTop + centerY) * scaleRatio - centerY

  scale.value = newScale

  requestAnimationFrame(() => {
    wrapper.scrollLeft = newScrollLeft
    wrapper.scrollTop = newScrollTop
  })
}


// 键盘快捷键
const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    zoomIn()
  } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault()
    zoomOut()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  // 添加初始feature作为示例
  addFeatureAt(100, 100)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.add-feature-btn {
  padding: 8px 16px;
  border: 2px dashed #4ECDC4;
  border-radius: 6px;
  cursor: grab;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  background: white;
  color: #4ECDC4;
  transition: all 0.2s;
  user-select: none;
}

.add-feature-btn:hover {
  background: #f0fffe;
  border-color: #45b8b0;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(78, 205, 196, 0.3);
}

.add-feature-btn:active {
  cursor: grabbing;
  transform: translateY(0);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}


.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  background: white;
  border: 1px solid #e0e0e0;
  font-size: 18px;
  font-weight: bold;
}

.btn-icon:hover {
  background: #f5f5f5;
  border-color: #4ECDC4;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.zoom-level {
  min-width: 50px;
  text-align: center;
  font-weight: 600;
  color: #666;
}

.info {
  color: #666;
  font-size: 14px;
}

.icon {
  font-size: 16px;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
  background: #d0d0d0;
  scroll-behavior: smooth;
}

.canvas-wrapper::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.canvas-wrapper::-webkit-scrollbar-track {
  background: #f0f0f0;
}

.canvas-wrapper::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 6px;
}

.canvas-wrapper::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}

.canvas {
  position: relative;
  transform-origin: 0 0;
  will-change: transform;
  background: #d0d0d0;
}

.preview-rectangle {
  pointer-events: none;
  border: 2px dashed rgba(255, 255, 255, 0.5);
}

.rectangle {
  position: absolute;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  user-select: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.rectangle-header {
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
}
</style>