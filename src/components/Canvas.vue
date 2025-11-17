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

      <!-- 连接模式切换按钮 -->
      <button
          @click="toggleConnectionMode"
          :class="['btn', 'connection-mode-btn', { 'active': isConnectionMode }]"
      >
        <span class="icon">🔗</span>
        <span>{{ isConnectionMode ? 'Connecting...' : 'Connect Features' }}</span>
      </button>

      <div class="zoom-controls">
        <button @click="zoomOut" class="btn btn-icon">-</button>
        <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
        <button @click="zoomIn" class="btn btn-icon">+</button>
      </div>
      <div class="info">
        Features: {{ rectangles.length }} | Connections: {{ connections.length }}
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
        <!-- SVG层 - 绘制连接线 -->
        <svg class="connections-layer" :style="svgStyle">
          <defs>
            <!-- 定义圆圈标记 -->
            <marker
                id="circle-end"
                markerWidth="12"
                markerHeight="12"
                refX="6"
                refY="6"
                orient="auto"
            >
              <circle cx="6" cy="6" r="5" fill="#666" stroke="white" stroke-width="2"/>
            </marker>
          </defs>

          <!-- 绘制所有连接线 -->
          <g
              v-for="conn in visibleConnections"
              :key="conn.id"
              class="connection-group"
              @click="handleConnectionClick(conn)"
          >
            <!-- 透明的宽路径用于点击检测 -->
            <path
                :d="getConnectionPath(conn)"
                stroke="transparent"
                stroke-width="20"
                fill="none"
                class="connection-hit-area"
                style="cursor: pointer;"
            />
            <!-- 实际显示的路径 -->
            <path
                :d="getConnectionPath(conn)"
                :stroke="getConnectionColor(conn.fromId)"
                :stroke-width="selectedConnection === conn.id ? 4 : 3"
                fill="none"
                marker-end="url(#circle-end)"
                :class="['connection-line', { 'selected': selectedConnection === conn.id }]"
                style="pointer-events: none;"
            />
          </g>
        </svg>

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
            :isConnectionMode="isConnectionMode"
            :isConnectionSource="connectionState.sourceId === rect.id"
            @update="updateFeature"
            @delete="deleteFeature"
            @start-drag="startDrag"
            @drag="drag"
            @end-drag="endDrag"
            @start-resize="startResize"
            @resize="resize"
            @end-resize="endResize"
            @click-for-connection="handleFeatureConnectionClick"
        />
      </div>
    </div>

    <!-- 删除连接确认提示 -->
    <transition name="fade">
      <div v-if="selectedConnection !== null" class="delete-hint">
        <span>Connection selected</span>
        <button @click="deleteSelectedConnection" class="delete-connection-btn">
          Delete Connection
        </button>
        <button @click="clearSelection" class="cancel-btn">
          Cancel
        </button>
      </div>
    </transition>

    <!-- 浮动聊天窗口 -->
    <FloatingChatWindow />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
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

// 连接列表
const connections = ref([])
let nextConnectionId = 1

// 选中的连接
const selectedConnection = ref(null)

// 连接模式状态
const isConnectionMode = ref(false)
const connectionState = reactive({
  sourceId: null,
  targetId: null,
})

// 颜色池
const colorPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#FF8E53', '#6C5CE7', '#00B894', '#FDCB6E',
  '#E17055', '#74B9FF', '#A29BFE', '#FD79A8',
  '#FF7675', '#55EFC4', '#81ECEC', '#FAB1A0'
]
let colorIndex = 0

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

// SVG层样式
const svgStyle = computed(() => ({
  width: `${CANVAS_WIDTH}px`,
  height: `${CANVAS_HEIGHT}px`,
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'auto',
  zIndex: 0,
}))

// 画布样式
const canvasStyle = computed(() => {
  const displayWidth = CANVAS_WIDTH * scale.value
  const displayHeight = CANVAS_HEIGHT * scale.value

  return {
    width: `${CANVAS_WIDTH}px`,
    height: `${CANVAS_HEIGHT}px`,
    transform: `scale(${scale.value})`,
    transformOrigin: '0 0',
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

  let canvasX = (creationState.currentX - rect.left + scrollLeft) / scale.value
  let canvasY = (creationState.currentY - rect.top + scrollTop) / scale.value

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

// 计算可见的连接（排除正在编辑的矩形的连接）
const visibleConnections = computed(() => {
  const editingRects = rectangles.value.filter(r => r.isEditing)
  const editingIds = new Set(editingRects.map(r => r.id))

  return connections.value.filter(conn =>
      !editingIds.has(conn.fromId) && !editingIds.has(conn.toId)
  )
})

// 获取连接线路径
const getConnectionPath = (connection) => {
  const fromRect = rectangles.value.find(r => r.id === connection.fromId)
  const toRect = rectangles.value.find(r => r.id === connection.toId)

  if (!fromRect || !toRect) return ''

  // 计算起点和终点（矩形中心）
  const fromX = fromRect.x + fromRect.width / 2
  const fromY = fromRect.y + fromRect.height / 2
  const toX = toRect.x + toRect.width / 2
  const toY = toRect.y + toRect.height / 2

  // 计算连接点（矩形边缘）
  const fromPoint = getEdgePoint(fromRect, toX, toY)
  const toPoint = getEdgePoint(toRect, fromX, fromY)

  // 使用三次贝塞尔曲线创建平滑路径
  const dx = toPoint.x - fromPoint.x
  const dy = toPoint.y - fromPoint.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const controlOffset = Math.min(distance * 0.3, 100)

  // 控制点
  const cp1x = fromPoint.x + (dx > 0 ? controlOffset : -controlOffset)
  const cp1y = fromPoint.y
  const cp2x = toPoint.x - (dx > 0 ? controlOffset : -controlOffset)
  const cp2y = toPoint.y

  return `M ${fromPoint.x} ${fromPoint.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPoint.x} ${toPoint.y}`
}

// 获取矩形边缘上的点
const getEdgePoint = (rect, targetX, targetY) => {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  // 计算角度
  const angle = Math.atan2(targetY - centerY, targetX - centerX)

  // 计算与矩形边缘的交点
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // 计算各边的交点
  let x, y

  if (Math.abs(cos) > Math.abs(sin)) {
    // 与左右边相交
    if (cos > 0) {
      // 右边
      x = rect.x + rect.width
      y = centerY + (x - centerX) * sin / cos
    } else {
      // 左边
      x = rect.x
      y = centerY + (x - centerX) * sin / cos
    }
  } else {
    // 与上下边相交
    if (sin > 0) {
      // 下边
      y = rect.y + rect.height
      x = centerX + (y - centerY) * cos / sin
    } else {
      // 上边
      y = rect.y
      x = centerX + (y - centerY) * cos / sin
    }
  }

  return { x, y }
}

// 根据feature ID获取连接线颜色
const getConnectionColor = (featureId) => {
  const feature = rectangles.value.find(r => r.id === featureId)
  return feature ? feature.color : '#666'
}

// 检查两个feature之间是否已存在连接
const hasConnection = (fromId, toId) => {
  return connections.value.some(
      conn => conn.fromId === fromId && conn.toId === toId
  )
}

// 切换连接模式
const toggleConnectionMode = () => {
  isConnectionMode.value = !isConnectionMode.value
  if (!isConnectionMode.value) {
    // 退出连接模式，重置状态
    connectionState.sourceId = null
    connectionState.targetId = null
  }
  // 清除选中的连接
  selectedConnection.value = null
}

// 处理Feature的连接点击
const handleFeatureConnectionClick = (featureId) => {
  if (!isConnectionMode.value) return

  if (connectionState.sourceId === null) {
    // 第一次点击，设置源
    connectionState.sourceId = featureId
  } else if (connectionState.sourceId === featureId) {
    // 点击同一个，取消选择
    connectionState.sourceId = null
  } else {
    // 第二次点击，检查是否已存在连接
    if (hasConnection(connectionState.sourceId, featureId)) {
      // 已存在连接，提示用户
      alert('Connection already exists between these features!')
    } else {
      // 创建新连接
      connectionState.targetId = featureId
      createConnection(connectionState.sourceId, connectionState.targetId)
    }

    // 重置状态
    connectionState.sourceId = null
    connectionState.targetId = null
  }
}

// 处理连接线的点击
const handleConnectionClick = (conn) => {
  if (isConnectionMode.value) return // 连接模式下不能选择连接线

  // 选中或取消选中连接
  if (selectedConnection.value === conn.id) {
    selectedConnection.value = null
  } else {
    selectedConnection.value = conn.id
  }
}

// 删除选中的连接
const deleteSelectedConnection = () => {
  if (selectedConnection.value !== null) {
    connections.value = connections.value.filter(
        conn => conn.id !== selectedConnection.value
    )
    selectedConnection.value = null
  }
}

// 清除选择
const clearSelection = () => {
  selectedConnection.value = null
}

// 创建连接
const createConnection = (fromId, toId) => {
  connections.value.push({
    id: nextConnectionId++,
    fromId,
    toId,
  })
}

// 删除与特定feature相关的所有连接
const deleteFeatureConnections = (featureId) => {
  connections.value = connections.value.filter(
      conn => conn.fromId !== featureId && conn.toId !== featureId
  )
}

// 开始创建矩形
const startCreateFeature = (e) => {
  e.preventDefault()

  // 清除选中的连接
  selectedConnection.value = null

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

        canvasX = Math.max(100, Math.min(CANVAS_WIDTH - 100, canvasX))
        canvasY = Math.max(75, Math.min(CANVAS_HEIGHT - 75, canvasY))

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
    content: 'Double click to edit',
    isEditing: false,
  }

  if (isPositionValid(newRect.id, newRect.x, newRect.y, newRect.width, newRect.height)) {
    rectangles.value.push(newRect)
  } else {
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
    // 删除相关连接
    deleteFeatureConnections(id)
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
  // 清除选中的连接
  selectedConnection.value = null

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
  // 清除选中的连接
  selectedConnection.value = null

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
  } else if (e.key === 'Escape') {
    if (isConnectionMode.value) {
      // ESC 退出连接模式
      toggleConnectionMode()
    } else if (selectedConnection.value !== null) {
      // ESC 取消选择
      clearSelection()
    }
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConnection.value !== null) {
    // Delete/Backspace 删除选中的连接
    e.preventDefault()
    deleteSelectedConnection()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
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

.connection-mode-btn {
  padding: 8px 16px;
  background: white;
  border: 2px solid #e0e0e0;
  color: #666;
}

.connection-mode-btn.active {
  background: #FFA07A;
  border-color: #FFA07A;
  color: white;
}

.connection-mode-btn:hover {
  border-color: #FFA07A;
  color: #FFA07A;
}

.connection-mode-btn.active:hover {
  background: #ff8e5d;
  border-color: #ff8e5d;
  color: white;
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

.connections-layer {
  position: absolute;
}

.connection-group {
  cursor: pointer;
}

.connection-hit-area {
  pointer-events: stroke;
}

.connection-line {
  transition: stroke-width 0.2s;
  pointer-events: none;
}

.connection-line.selected {
  filter: drop-shadow(0 0 6px rgba(255, 160, 122, 0.8));
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    stroke-width: 4;
  }
  50% {
    stroke-width: 5;
  }
}

.delete-hint {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.delete-hint span {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.delete-connection-btn {
  padding: 8px 16px;
  background: #ff4757;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-connection-btn:hover {
  background: #ee2f3b;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3);
}

.cancel-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  color: #666;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e0e0e0;
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

.fade-enter-active, .fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>