/**
 * WebSocket 实时消息服务器
 * 功能：JWT认证、房间订阅、心跳机制、消息广播
 */

import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { randomUUID } from 'crypto'
import type {
  WSMessage,
  ClientInfo,
  WSServerConfig,
  AuthPayload,
  SubscribePayload,
  UnsubscribePayload,
  MessagePayload,
  JWTPayload,
} from './types'

// 服务器配置
const config: WSServerConfig = {
  port: parseInt(process.env.WS_PORT || '3001', 10),
  pingInterval: 30000,      // 30秒心跳
  pongTimeout: 35000,       // 35秒超时
  maxMessageSize: 1048576,  // 1MB
  maxConnections: 1000,
  jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
}

// 客户端连接池
const clients = new Map<string, ClientInfo>()

// 房间订阅映射（roomId -> Set<userId>）
const roomSubscriptions = new Map<string, Set<string>>()

// 创建 HTTP 服务器（用于健康检查）
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      connections: clients.size,
      rooms: roomSubscriptions.size,
      timestamp: Date.now(),
    }))
  } else {
    res.writeHead(404)
    res.end()
  }
})

// 创建 WebSocket 服务器
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: config.maxMessageSize,
})

console.log(`🚀 WebSocket 服务器启动中...`)
console.log(`📡 端口: ${config.port}`)
console.log(`💓 心跳间隔: ${config.pingInterval}ms`)
console.log(`⏱️  超时时间: ${config.pongTimeout}ms`)

/**
 * 验证 JWT Token（简化版，实际应使用 jsonwebtoken 库）
 * 注意：这里使用简化验证，生产环境需要使用 jsonwebtoken.verify()
 */
function verifyToken(token: string): JWTPayload | null {
  try {
    // 解析 JWT（格式：header.payload.signature）
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // 解码 payload（Base64URL）
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    )

    // 验证过期时间
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.log('❌ Token 已过期')
      return null
    }

    return payload as JWTPayload
  } catch (error) {
    console.error('❌ Token 验证失败:', error)
    return null
  }
}

/**
 * 验证用户是否是房间成员（需要查询数据库）
 * 注意：这里简化处理，实际应查询 Supabase
 */
async function verifyRoomMembership(userId: string, roomId: string): Promise<boolean> {
  // TODO: 查询 Supabase room_members 表
  // 目前暂时返回 true，允许所有认证用户订阅任何房间
  return true
}

/**
 * 发送消息给客户端
 */
function sendMessage(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

/**
 * 发送错误消息
 */
function sendError(ws: WebSocket, code: string, message: string) {
  sendMessage(ws, {
    type: 'error',
    payload: { code, message },
    timestamp: Date.now(),
  })
}

/**
 * 发送成功消息
 */
function sendSuccess(ws: WebSocket, message: string, data?: any) {
  sendMessage(ws, {
    type: 'success',
    payload: { message, data },
    timestamp: Date.now(),
  })
}

/**
 * 广播消息到房间内所有订阅者
 */
function broadcastToRoom(roomId: string, message: WSMessage, excludeUserId?: string) {
  const subscribers = roomSubscriptions.get(roomId)
  if (!subscribers) return

  let sentCount = 0
  subscribers.forEach((userId) => {
    if (excludeUserId && userId === excludeUserId) return

    const client = clients.get(userId)
    if (client && client.ws.readyState === WebSocket.OPEN) {
      sendMessage(client.ws, message)
      sentCount++
    }
  })

  console.log(`📢 广播到房间 ${roomId}，发送给 ${sentCount} 个客户端`)
}

/**
 * 处理认证消息
 */
async function handleAuth(ws: WebSocket, payload: AuthPayload) {
  const { token } = payload

  // 验证 token
  const jwtPayload = verifyToken(token)
  if (!jwtPayload) {
    sendError(ws, 'AUTH_FAILED', '认证失败：无效的 token')
    ws.close()
    return
  }

  const userId = jwtPayload.sub
  const email = jwtPayload.email

  // 检查连接数限制
  if (clients.size >= config.maxConnections) {
    sendError(ws, 'MAX_CONNECTIONS', '服务器连接数已达上限')
    ws.close()
    return
  }

  // 存储客户端信息
  clients.set(userId, {
    ws,
    userId,
    email,
    subscribedRooms: new Set(),
    isAlive: true,
    lastPing: Date.now(),
  })

  console.log(`✅ 用户认证成功: ${email} (${userId})`)
  console.log(`👥 当前在线: ${clients.size} 个连接`)

  sendSuccess(ws, '认证成功', { userId, email })
}

/**
 * 处理订阅房间消息
 */
async function handleSubscribe(userId: string, payload: SubscribePayload) {
  const { roomId } = payload
  const client = clients.get(userId)

  if (!client) {
    console.error('❌ 客户端不存在:', userId)
    return
  }

  // 验证房间成员身份
  const isMember = await verifyRoomMembership(userId, roomId)
  if (!isMember) {
    sendError(client.ws, 'NOT_MEMBER', '您不是该房间的成员')
    return
  }

  // 添加到房间订阅
  if (!roomSubscriptions.has(roomId)) {
    roomSubscriptions.set(roomId, new Set())
  }
  roomSubscriptions.get(roomId)!.add(userId)

  // 添加到客户端订阅列表
  client.subscribedRooms.add(roomId)

  console.log(`🔔 用户 ${userId} 订阅房间 ${roomId}`)
  console.log(`📊 房间 ${roomId} 订阅者: ${roomSubscriptions.get(roomId)!.size} 人`)

  sendSuccess(client.ws, '订阅成功', { roomId })

  // 通知房间其他成员
  broadcastToRoom(
    roomId,
    {
      type: 'message',
      payload: {
        roomId,
        content: `用户 ${client.email} 加入了聊天`,
        messageType: 'system',
      },
      timestamp: Date.now(),
    },
    userId
  )
}

/**
 * 处理取消订阅消息
 */
function handleUnsubscribe(userId: string, payload: UnsubscribePayload) {
  const { roomId } = payload
  const client = clients.get(userId)

  if (!client) return

  // 从房间订阅中移除
  const subscribers = roomSubscriptions.get(roomId)
  if (subscribers) {
    subscribers.delete(userId)
    if (subscribers.size === 0) {
      roomSubscriptions.delete(roomId)
    }
  }

  // 从客户端订阅列表移除
  client.subscribedRooms.delete(roomId)

  console.log(`🔕 用户 ${userId} 取消订阅房间 ${roomId}`)

  sendSuccess(client.ws, '取消订阅成功', { roomId })
}

/**
 * 处理聊天消息
 */
async function handleMessage(userId: string, payload: MessagePayload) {
  const { roomId, content, messageType = 'text', replyTo, fileUrl, fileName, fileSize } = payload
  const client = clients.get(userId)

  if (!client) return

  // 验证是否订阅了该房间
  if (!client.subscribedRooms.has(roomId)) {
    sendError(client.ws, 'NOT_SUBSCRIBED', '请先订阅该房间')
    return
  }

  // 生成消息ID
  const messageId = randomUUID()

  // TODO: 保存消息到数据库（Supabase messages 表）

  // 广播消息到房间
  const message: WSMessage = {
    type: 'message',
    payload: {
      messageId,
      roomId,
      userId,
      email: client.email,
      content,
      messageType,
      replyTo,
      fileUrl,
      fileName,
      fileSize,
      createdAt: new Date().toISOString(),
    },
    timestamp: Date.now(),
  }

  broadcastToRoom(roomId, message)

  console.log(`💬 消息发送: ${client.email} -> 房间 ${roomId}`)
}

/**
 * 处理心跳响应
 */
function handlePong(userId: string) {
  const client = clients.get(userId)
  if (client) {
    client.isAlive = true
    client.lastPing = Date.now()
  }
}

/**
 * 清理断开的连接
 */
function cleanupClient(userId: string) {
  const client = clients.get(userId)
  if (!client) return

  // 从所有订阅的房间中移除
  client.subscribedRooms.forEach((roomId) => {
    const subscribers = roomSubscriptions.get(roomId)
    if (subscribers) {
      subscribers.delete(userId)
      if (subscribers.size === 0) {
        roomSubscriptions.delete(roomId)
      }
    }
  })

  // 移除客户端
  clients.delete(userId)

  console.log(`🔌 连接断开: ${client.email} (${userId})`)
  console.log(`👥 当前在线: ${clients.size} 个连接`)
}

// WebSocket 连接处理
wss.on('connection', (ws: WebSocket) => {
  console.log('🔗 新连接建立')

  let currentUserId: string | null = null

  // 接收消息
  ws.on('message', async (data: Buffer) => {
    try {
      const message: WSMessage = JSON.parse(data.toString())

      switch (message.type) {
        case 'auth':
          await handleAuth(ws, message.payload as AuthPayload)
          // 从客户端映射中找到 userId
          for (const entry of Array.from(clients.entries())) {
            const [userId, client] = entry
            if (client.ws === ws) {
              currentUserId = userId
              break
            }
          }
          break

        case 'subscribe':
          if (currentUserId) {
            await handleSubscribe(currentUserId, message.payload as SubscribePayload)
          } else {
            sendError(ws, 'NOT_AUTHENTICATED', '请先认证')
          }
          break

        case 'unsubscribe':
          if (currentUserId) {
            handleUnsubscribe(currentUserId, message.payload as UnsubscribePayload)
          }
          break

        case 'message':
          if (currentUserId) {
            await handleMessage(currentUserId, message.payload as MessagePayload)
          } else {
            sendError(ws, 'NOT_AUTHENTICATED', '请先认证')
          }
          break

        case 'pong':
          if (currentUserId) {
            handlePong(currentUserId)
          }
          break

        default:
          sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `未知的消息类型: ${message.type}`)
      }
    } catch (error) {
      console.error('❌ 消息处理错误:', error)
      sendError(ws, 'MESSAGE_ERROR', '消息处理失败')
    }
  })

  // 连接关闭
  ws.on('close', () => {
    if (currentUserId) {
      cleanupClient(currentUserId)
    }
  })

  // 连接错误
  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error)
  })
})

// 心跳检测
const heartbeatInterval = setInterval(() => {
  const now = Date.now()

  clients.forEach((client, userId) => {
    // 检查是否超时
    if (now - client.lastPing > config.pongTimeout) {
      console.log(`💔 客户端超时: ${client.email}`)
      client.ws.terminate()
      cleanupClient(userId)
      return
    }

    // 发送 ping
    if (client.ws.readyState === WebSocket.OPEN) {
      sendMessage(client.ws, {
        type: 'ping',
        timestamp: now,
      })
      client.isAlive = false
    }
  })
}, config.pingInterval)

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 信号，准备关闭服务器...')

  clearInterval(heartbeatInterval)

  wss.clients.forEach((ws) => {
    ws.close()
  })

  wss.close(() => {
    console.log('✅ WebSocket 服务器已关闭')
    process.exit(0)
  })
})

// 启动服务器
httpServer.listen(config.port, () => {
  console.log(`✅ WebSocket 服务器运行在 ws://localhost:${config.port}`)
  console.log(`🏥 健康检查: http://localhost:${config.port}/health`)
})
