/**
 * WebSocket 服务器类型定义
 */

import { WebSocket } from 'ws'

// WebSocket 消息类型
export type WSMessageType = 
  | 'auth'           // 认证
  | 'subscribe'      // 订阅房间
  | 'unsubscribe'    // 取消订阅
  | 'message'        // 发送消息
  | 'ping'           // 心跳请求
  | 'pong'           // 心跳响应
  | 'error'          // 错误消息
  | 'success'        // 成功响应

// WebSocket 消息结构
export interface WSMessage {
  type: WSMessageType
  payload?: any
  timestamp: number
  messageId?: string
}

// 认证消息负载
export interface AuthPayload {
  token: string  // Supabase JWT token
}

// 订阅消息负载
export interface SubscribePayload {
  roomId: string
}

// 取消订阅消息负载
export interface UnsubscribePayload {
  roomId: string
}

// 聊天消息负载
export interface MessagePayload {
  roomId: string
  content: string
  messageType?: 'text' | 'image' | 'file' | 'voice'
  replyTo?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
}

// 错误消息负载
export interface ErrorPayload {
  code: string
  message: string
}

// 成功消息负载
export interface SuccessPayload {
  message: string
  data?: any
}

// 客户端连接信息
export interface ClientInfo {
  ws: WebSocket
  userId: string
  email: string
  subscribedRooms: Set<string>
  isAlive: boolean
  lastPing: number
}

// JWT 解码后的用户信息
export interface JWTPayload {
  sub: string  // user_id
  email: string
  aud: string
  exp: number
  iat: number
  iss: string
  role: string
}

// 房间成员信息（用于验证）
export interface RoomMembership {
  room_id: string
  user_id: string
  role: 'admin' | 'member'
}

// WebSocket 服务器配置
export interface WSServerConfig {
  port: number
  pingInterval: number  // 心跳间隔（毫秒）
  pongTimeout: number   // 心跳超时（毫秒）
  maxMessageSize: number // 最大消息大小（字节）
  maxConnections: number // 最大连接数
  jwtSecret: string     // JWT 密钥
}
