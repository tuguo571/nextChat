// 用户类型定义
export interface User {
  id: string
  email: string
  nickname: string
  avatar_url?: string
  signature?: string
  is_admin?: boolean  // {{ AURA: Add - 系统级管理员标识 }}
  created_at: string
  updated_at: string
}

// 聊天室类型定义
export interface ChatRoom {
  id: string
  name: string
  description?: string
  creator_id: string
  created_at: string
  updated_at: string
  last_activity_at: string
  member_count: number
}

// 聊天室成员类型定义
export interface RoomMember {
  id: string
  room_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  user?: User
}

// 消息类型定义
export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'system'

export interface Message {
  id: string
  room_id: string
  user_id: string
  content: string
  message_type: MessageType
  reply_to?: string
  file_url?: string
  file_name?: string
  file_size?: number
  is_edited: boolean
  created_at: string
  updated_at: string
  user?: User
  reply_message?: Message
  reactions?: MessageReaction[]
}

// 消息反应类型定义
export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

// 文件类型定义
export interface FileMetadata {
  id: string
  room_id: string
  user_id: string
  file_name: string
  file_size: number
  file_type: string
  webdav_path: string
  thumbnail_path?: string
  created_at: string
  user?: User
}

// 通知类型定义
export type NotificationType = 'mention' | 'announcement' | 'system' | 'security'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  content: string
  related_id?: string
  is_read: boolean
  created_at: string
}

// WebSocket消息类型定义
export interface WSMessage {
  type: 'message' | 'typing' | 'online' | 'offline' | 'ping' | 'pong'
  payload: any
  timestamp: number
}

// 用户状态类型定义
export interface UserStatus {
  user_id: string
  status: 'online' | 'offline' | 'typing'
  room_id?: string
  last_seen: string
}
