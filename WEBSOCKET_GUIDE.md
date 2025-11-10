# WebSocket 实时通信系统文档

## 📋 架构概览

WebSocket 系统采用客户端-服务器架构，实现实时双向通信：

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Browser   │ ←──────────────────────→  │  WS Server  │
│  (Client)   │    ws://localhost:3001     │  (Node.js)  │
└─────────────┘                             └─────────────┘
      ↓                                            ↓
 useWebSocket Hook                          房间订阅管理
      ↓                                            ↓
  React组件                                   消息广播
```

## 🚀 快速开始

### 1. 启动服务器

```bash
# 方式1：单独启动 WebSocket 服务器
npm run dev:ws

# 方式2：同时启动 Next.js 和 WebSocket 服务器（需要安装 concurrently）
npm install -D concurrently tsx
npm run dev:all
```

### 2. 在组件中使用

```tsx
'use client'

import { useWebSocket } from '@/hooks/useWebSocket'
import { useEffect } from 'react'

export default function ChatRoom({ roomId }: { roomId: string }) {
  const ws = useWebSocket()

  useEffect(() => {
    if (!ws.isConnected) return

    // 订阅房间
    ws.subscribe(roomId)

    // 监听消息
    const unsubscribe = ws.on('message', (data) => {
      console.log('收到新消息:', data)
    })

    return () => {
      ws.unsubscribe(roomId)
      unsubscribe()
    }
  }, [ws.isConnected, roomId])

  const sendMessage = () => {
    ws.sendMessage({
      roomId,
      content: 'Hello World',
      messageType: 'text',
    })
  }

  return (
    <div>
      <p>连接状态: {ws.isConnected ? '已连接' : '未连接'}</p>
      <button onClick={sendMessage}>发送消息</button>
    </div>
  )
}
```

## 🔌 API 参考

### useWebSocket Hook

```typescript
const {
  isConnected,      // 是否已连接
  isConnecting,     // 是否正在连接
  error,            // 错误信息
  connect,          // 手动连接
  disconnect,       // 断开连接
  subscribe,        // 订阅房间
  unsubscribe,      // 取消订阅
  sendMessage,      // 发送消息
  on,               // 注册消息处理器
} = useWebSocket(options)
```

#### Options

```typescript
interface UseWebSocketOptions {
  autoConnect?: boolean           // 自动连接（默认 true）
  reconnectInterval?: number      // 重连间隔（默认 3000ms）
  maxReconnectAttempts?: number   // 最大重连次数（默认 5）
}
```

### 消息协议

#### 1. 认证消息（自动发送）

```typescript
{
  type: 'auth',
  payload: {
    token: string  // Supabase JWT token
  },
  timestamp: number
}
```

#### 2. 订阅房间

```typescript
ws.subscribe(roomId)

// 发送消息：
{
  type: 'subscribe',
  payload: {
    roomId: string
  },
  timestamp: number
}
```

#### 3. 取消订阅

```typescript
ws.unsubscribe(roomId)

// 发送消息：
{
  type: 'unsubscribe',
  payload: {
    roomId: string
  },
  timestamp: number
}
```

#### 4. 发送聊天消息

```typescript
ws.sendMessage({
  roomId: string
  content: string
  messageType?: 'text' | 'image' | 'file' | 'voice'
  replyTo?: string       // 回复消息ID
  fileUrl?: string       // 文件URL
  fileName?: string      // 文件名
  fileSize?: number      // 文件大小
})
```

#### 5. 接收消息

```typescript
// 监听所有消息
const unsubscribe = ws.on('*', (message) => {
  console.log('收到消息:', message)
})

// 监听特定类型消息
const unsubscribe = ws.on('message', (payload) => {
  console.log('聊天消息:', payload)
})

const unsubscribe = ws.on('error', (payload) => {
  console.error('错误:', payload)
})

const unsubscribe = ws.on('success', (payload) => {
  console.log('成功:', payload)
})

// 取消监听
unsubscribe()
```

## 💓 心跳机制

服务器每 30 秒发送一次 `ping`，客户端自动响应 `pong`：

```
Server ─(ping)→ Client
Server ←(pong)─ Client
```

- **超时时间**：35 秒
- **超时后**：服务器主动断开连接
- **客户端行为**：自动重连（最多 5 次）

## 🔐 安全机制

### 1. JWT 认证

- 连接建立后必须先通过认证
- 使用 Supabase JWT token
- 验证 token 有效性和过期时间

### 2. 房间权限验证

- 订阅房间前验证成员身份
- 非成员无法订阅房间（TODO：需实现数据库查询）

### 3. 消息大小限制

- 最大消息大小：1MB
- 超出限制的消息将被拒绝

### 4. 连接数限制

- 最大同时连接数：1000
- 超出限制的新连接将被拒绝

## 🏗️ 文件结构

```
d:/GitHub/chat/
├── server/
│   ├── types.ts              # WebSocket 类型定义
│   └── websocket.ts          # WebSocket 服务器
├── src/
│   ├── hooks/
│   │   └── useWebSocket.ts   # 客户端 Hook
│   └── ...
├── .env.local               # 环境变量
└── package.json             # 启动脚本
```

## 📊 服务器状态监控

访问健康检查接口：

```bash
curl http://localhost:3001/health
```

响应：

```json
{
  "status": "ok",
  "connections": 5,
  "rooms": 3,
  "timestamp": 1699999999999
}
```

## 🐛 调试

### 查看服务器日志

```
✅ 用户认证成功: user@example.com (uuid)
👥 当前在线: 1 个连接
🔔 用户 uuid 订阅房间 room-id
📊 房间 room-id 订阅者: 3 人
💬 消息发送: user@example.com -> 房间 room-id
📢 广播到房间 room-id，发送给 2 个客户端
🔕 用户 uuid 取消订阅房间 room-id
🔌 连接断开: user@example.com (uuid)
💔 客户端超时: user@example.com
```

### 客户端日志

```javascript
console.log('WebSocket 状态:', ws.isConnected)
console.log('错误信息:', ws.error)
```

## 🔧 环境变量

在 `.env.local` 中配置：

```bash
# WebSocket 服务器端口
WS_PORT=3001

# 客户端 WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Supabase JWT 密钥（用于验证 token）
SUPABASE_JWT_SECRET=your-jwt-secret
```

## 📝 TODO

- [ ] 实现房间成员身份验证（查询 Supabase）
- [ ] 消息持久化到数据库
- [ ] 消息历史加载
- [ ] 已读/未读状态同步
- [ ] 正在输入状态广播
- [ ] 用户上线/离线通知
- [ ] 消息撤回功能
- [ ] 文件上传进度同步

## 🚨 已知限制

1. **简化的 JWT 验证**：当前使用简化的 token 解析，生产环境应使用 `jsonwebtoken.verify()`
2. **房间权限验证**：暂时允许所有认证用户订阅任何房间，需实现数据库查询
3. **消息未持久化**：消息仅在内存中广播，未保存到数据库

## 🎯 下一步计划

1. 创建消息输入组件（MessageInput.tsx）
2. 创建消息列表组件（MessageList.tsx）
3. 集成到聊天室详情页
4. 实现消息持久化
5. 添加消息类型支持（Markdown、代码、文件）

---

**文档版本**：v1.0
**最后更新**：2025年11月9日
