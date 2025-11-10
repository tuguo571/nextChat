# Next.js + Socket.IO 集成完成！

## ✅ 已完成的工作

### 1. 服务器端
- **server.js**: 自定义 Next.js 服务器，集成 Socket.IO
- **socketHandlers.js**: Socket.IO 事件处理器（认证、房间管理、消息广播）

### 2. 客户端
- **src/hooks/useSocket.ts**: Socket.IO 客户端 Hook

### 3. 配置文件
- **package.json**: 更新启动脚本和依赖

## 🚀 启动方式

### 第一步：安装依赖（需要管理员权限或修改执行策略）

```powershell
# 方法1：使用 CMD（推荐）
cmd
cd d:\GitHub\chat
npm install socket.io socket.io-client

# 方法2：临时允许脚本执行
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
npm install socket.io socket.io-client
```

### 第二步：启动服务器

```bash
npm run dev
```

就这么简单！**一个命令启动 Next.js + Socket.IO**

## 📊 架构说明

```
┌─────────────────────────────────────┐
│     http://localhost:3000           │
├─────────────────────────────────────┤
│                                     │
│  Next.js Pages/API                  │  ← HTTP 请求
│  ─────────────────                  │
│                                     │
│  Socket.IO Server                   │  ← WebSocket 连接
│  ─────────────────                  │
│  • 认证 (JWT)                       │
│  • 房间管理                         │
│  • 消息广播                         │
│  • 数据库持久化                     │
│                                     │
└─────────────────────────────────────┘
         ↓                    ↓
    同一端口              同一进程
```

## 🔌 API 使用示例

### 在组件中使用 Socket.IO

```tsx
'use client'

import { useSocket } from '@/hooks/useSocket'
import { useEffect, useState } from 'react'

export default function ChatRoom({ roomId }: { roomId: string }) {
  const socket = useSocket()
  const [messages, setMessages] = useState([])

  useEffect(() => {
    if (!socket.isConnected || !socket.isAuthenticated) return

    // 加入房间
    socket.joinRoom(roomId, (error, response) => {
      if (error) {
        console.error('加入失败:', error)
      } else {
        console.log('加入成功:', response)
      }
    })

    // 监听新消息
    const unsubscribe = socket.on('message', (message) => {
      setMessages((prev) => [...prev, message])
    })

    // 监听用户加入
    socket.on('user-joined', (data) => {
      console.log('用户加入:', data)
    })

    return () => {
      socket.leaveRoom(roomId)
      unsubscribe()
    }
  }, [socket.isConnected, socket.isAuthenticated, roomId])

  const sendMessage = () => {
    socket.sendMessage(
      {
        roomId,
        content: 'Hello World!',
        messageType: 'text',
      },
      (error, response) => {
        if (error) {
          console.error('发送失败:', error)
        } else {
          console.log('发送成功:', response)
        }
      }
    )
  }

  return (
    <div>
      <p>连接状态: {socket.isConnected ? '已连接' : '未连接'}</p>
      <p>认证状态: {socket.isAuthenticated ? '已认证' : '未认证'}</p>
      <button onClick={sendMessage}>发送消息</button>
    </div>
  )
}
```

## 📡 Socket.IO 事件

### 客户端发送的事件

| 事件 | 参数 | 回调 | 说明 |
|------|------|------|------|
| `authenticate` | token | (error, response) | 认证用户 |
| `join-room` | roomId | (error, response) | 加入房间 |
| `leave-room` | roomId | (error, response) | 离开房间 |
| `send-message` | messageData | (error, response) | 发送消息 |
| `typing` | roomId | - | 正在输入 |
| `stop-typing` | roomId | - | 停止输入 |

### 客户端接收的事件

| 事件 | 数据 | 说明 |
|------|------|------|
| `authenticated` | { userId, email } | 认证成功 |
| `message` | Message 对象 | 收到新消息 |
| `user-joined` | { userId, email, roomId } | 用户加入房间 |
| `user-left` | { userId, email, roomId } | 用户离开房间 |
| `user-typing` | { userId, email, roomId } | 用户正在输入 |
| `user-stop-typing` | { userId, roomId } | 用户停止输入 |
| `error` | { code, message } | 错误消息 |

## 🔐 特性

### ✅ 已实现

1. **JWT 认证**
   - 使用 Supabase token 认证
   - 自动验证用户身份

2. **房间管理**
   - 基于 Supabase 数据库验证成员身份
   - Socket.IO 原生房间功能

3. **消息持久化**
   - 自动保存到 `messages` 表
   - 关联用户信息

4. **实时广播**
   - 房间内所有成员实时接收
   - 包含用户信息

5. **自动重连**
   - 最多重连 5 次
   - 重连间隔 3 秒

6. **正在输入状态**
   - 实时显示输入状态
   - 自动清理

### 🎯 优势

相比原生 WebSocket：

| 特性 | 原生 WebSocket | Socket.IO |
|------|----------------|-----------|
| 自动重连 | 需手动实现 | ✅ 内置 |
| 房间管理 | 需手动实现 | ✅ 内置 |
| 事件系统 | 需手动解析 | ✅ 内置 |
| 回调确认 | 不支持 | ✅ 支持 |
| 降级方案 | 不支持 | ✅ 自动 polling |
| 跨浏览器 | 兼容性问题 | ✅ 完美兼容 |

## 📂 文件结构

```
d:/GitHub/chat/
├── server.js                    # Next.js + Socket.IO 服务器
├── socketHandlers.js            # Socket.IO 事件处理
├── src/
│   └── hooks/
│       └── useSocket.ts         # 客户端 Hook
├── package.json                 # 依赖和脚本
└── .env.local                   # 环境变量
```

## 🐛 调试

### 查看服务器日志

```
✅ 用户认证成功: user@example.com (uuid)
👥 当前在线: 3 个用户
🔔 用户 user@example.com 加入房间 room-id
📊 房间 room-id 在线成员: 5 人
💬 消息发送: user@example.com -> 房间 room-id
```

### 客户端调试

```javascript
console.log('连接状态:', socket.isConnected)
console.log('认证状态:', socket.isAuthenticated)
console.log('错误信息:', socket.error)
```

## 🚨 注意事项

1. **开发模式热重载**
   - Next.js 页面修改会自动刷新
   - Socket.IO 连接会自动重连

2. **生产部署**
   - 先执行 `npm run build`
   - 再执行 `npm start`

3. **环境变量**
   - 确保 `.env.local` 包含所有必要配置
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 📝 下一步

- [ ] 创建消息输入组件 (MessageInput.tsx)
- [ ] 创建消息列表组件 (MessageList.tsx)
- [ ] 集成到聊天室详情页
- [ ] 添加文件上传功能
- [ ] 实现消息编辑/删除

---

**集成完成！一个命令启动，开箱即用！** 🎉
