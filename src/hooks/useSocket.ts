'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

interface UseSocketOptions {
  autoConnect?: boolean
}

interface SocketState {
  isConnected: boolean
  isAuthenticated: boolean
  error: string | null
}

interface MessageData {
  roomId: string
  content: string
  messageType?: 'text' | 'image' | 'file' | 'voice'
  replyTo?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mentionedUserIds?: string[]  // {{ AURA: Add - 被提及的用户ID数组 }}
}

interface Message {
  id: string
  roomId: string
  userId: string
  content: string
  messageType: string
  replyTo?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  isEdited: boolean
  createdAt: string
  user: {
    id: string
    nickname: string
    avatar_url: string | null
  }
}

export function useSocket(options: UseSocketOptions = {}) {
  const { autoConnect = true } = options
  const { user } = useAuth()

  const [state, setState] = useState<SocketState>({
    isConnected: false,
    isAuthenticated: false,
    error: null,
  })

  const socketRef = useRef<Socket | null>(null)
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())
  // {{ AURA: Add - 存储 access token 以便重连时使用 }}
  const accessTokenRef = useRef<string | null>(null)

  // {{ AURA: Modify - 改为返回 Promise，确保认证完成后再继续 }}
  // 认证函数
  const authenticate = useCallback((socket: Socket, token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('🔐 开始认证...')
      socket.emit('authenticate', token, (error: any, response: any) => {
        if (error) {
          console.error('❌ 认证失败:', error)
          setState((prev) => ({ ...prev, error: error.message, isAuthenticated: false }))
          reject(error)
        } else {
          console.log('✅ 认证成功:', response)
          setState((prev) => ({ ...prev, isAuthenticated: true }))
          resolve()
        }
      })
    })
  }, [])

  // 初始化 Socket.IO 连接
  const connect = useCallback(async () => {
    if (!user) {
      console.log('❌ 未登录，无法连接')
      return
    }

    // {{ AURA: Modify - 检查现有连接，避免重复创建 }}
    if (socketRef.current) {
      if (socketRef.current.connected) {
        console.log('✅ Socket.IO 已连接')
        return
      }
      // 如果 socket 存在但未连接，尝试重新连接
      if (!socketRef.current.connected) {
        console.log('🔄 尝试重新连接现有 socket...')
        socketRef.current.connect()
        return
      }
    }

    try {
      // 获取 token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('❌ 无法获取 token')
        return
      }

      // {{ AURA: Modify - 保存 token 到 ref }}
      accessTokenRef.current = session.access_token

      // 创建 Socket.IO 连接
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000'
      console.log('🔌 连接到 Socket.IO 服务器:', wsUrl)
      
      const socket = io(wsUrl, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
      })

      socketRef.current = socket

      // {{ AURA: Modify - 使用 async/await 确保认证完成 }}
      // 连接成功
      socket.on('connect', async () => {
        console.log('✅ Socket.IO 连接成功')
        setState((prev) => ({ ...prev, isConnected: true, error: null }))

        // 自动认证（等待完成）
        if (accessTokenRef.current) {
          try {
            await authenticate(socket, accessTokenRef.current)
            console.log('🎊 认证流程完成，可以加入房间了')
          } catch (error) {
            console.error('🚫 认证流程失败:', error)
          }
        }
      })

      // {{ AURA: Modify - 重连事件也使用 async/await }}
      // 重新连接成功
      socket.on('reconnect', async (attemptNumber) => {
        console.log(`🔄 重新连接成功 (尝试 ${attemptNumber} 次)`)
        // 重新认证（等待完成）
        if (accessTokenRef.current) {
          try {
            await authenticate(socket, accessTokenRef.current)
            console.log('🎊 重连后认证流程完成')
          } catch (error) {
            console.error('🚫 重连后认证流程失败:', error)
          }
        }
      })

      // 连接错误
      socket.on('connect_error', (error) => {
        console.error('❌ 连接错误:', error.message)
        setState((prev) => ({ ...prev, error: error.message }))
      })

      // 断开连接
      socket.on('disconnect', (reason) => {
        console.log('🔌 连接断开:', reason)
        setState((prev) => ({ 
          ...prev, 
          isConnected: false, 
          isAuthenticated: false 
        }))
      })

      // 认证成功事件
      socket.on('authenticated', (data) => {
        console.log('🎉 已认证:', data)
        triggerHandlers('authenticated', data)
      })

      // 错误事件
      socket.on('error', (error) => {
        console.error('❌ Socket 错误:', error)
        setState((prev) => ({ ...prev, error: error.message }))
        triggerHandlers('error', error)
      })

      // 消息事件
      socket.on('message', (message: Message) => {
        triggerHandlers('message', message)
      })

      // 用户加入
      socket.on('user-joined', (data) => {
        triggerHandlers('user-joined', data)
      })

      // 用户离开
      socket.on('user-left', (data) => {
        triggerHandlers('user-left', data)
      })

      // 用户正在输入
      socket.on('user-typing', (data) => {
        triggerHandlers('user-typing', data)
      })

      // 用户停止输入
      socket.on('user-stop-typing', (data) => {
        triggerHandlers('user-stop-typing', data)
      })

      // 连接
      socket.connect()

    } catch (error) {
      console.error('❌ 连接异常:', error)
      setState((prev) => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '连接失败' 
      }))
    }
  }, [user])

  // 断开连接
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setState({ isConnected: false, isAuthenticated: false, error: null })
  }, [])

  // 加入房间
  const joinRoom = useCallback(async (roomId: string, callback?: (error: any, response?: any) => void) => {
    // {{ AURA: Modify - 添加系统管理员预检查，确保权限验证完成 }}
    console.log('🔍 joinRoom 被调用:', {
      socketConnected: socketRef.current?.connected,
      roomId
    })

    if (!socketRef.current?.connected) {
      console.error('❌ Socket 未连接')
      callback?.({ code: 'NOT_CONNECTED', message: 'Socket 未连接' })
      return
    }

    // {{ AURA: Add - 预检查系统管理员身份，减少服务器端验证延迟 }}
    try {
      console.log('🔍 开始系统管理员预检查...')
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        console.log('🔍 获取到用户会话:', session.user.id)
        // 检查是否是系统管理员
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('❌ 获取用户配置失败:', profileError)
        } else {
          console.log('🔍 用户配置:', userProfile)
        }

        if (userProfile?.is_admin) {
          console.log('🔑 客户端预检查：用户是系统管理员，直接加入房间')
          // {{ AURA: Modify - 修复参数顺序：(roomId, adminFlag, callback) }}
          socketRef.current.emit('join-room', roomId, { isSystemAdmin: true }, (error: any, response: any) => {
            if (error) {
              console.error('❌ 系统管理员加入房间失败:', error)
              socketRef.current?.emit('error', error)
            } else {
              console.log('✅ 系统管理员加入房间成功:', response)
            }
            callback?.(error, response)
          })
          return
        } else {
          console.log('🔍 用户不是系统管理员，使用常规流程')
        }
      } else {
        console.log('🔍 未获取到用户会话')
      }
    } catch (error) {
      console.warn('⚠️ 系统管理员预检查失败，使用常规流程:', error)
    }

    console.log('📤 发送 join-room 事件:', roomId)
    socketRef.current.emit('join-room', roomId, (error: any, response: any) => {
      if (error) {
        console.error('❌ 加入房间失败:', error)
      } else {
        console.log('✅ 加入房间成功:', response)
      }
      callback?.(error, response)
    })
  }, [])

  // 离开房间
  const leaveRoom = useCallback((roomId: string, callback?: (error: any, response?: any) => void) => {
    if (!socketRef.current?.connected) {
      console.error('❌ 未连接')
      return
    }

    socketRef.current.emit('leave-room', roomId, (error: any, response: any) => {
      if (error) {
        console.error('❌ 离开房间失败:', error)
      } else {
        console.log('✅ 离开房间成功:', response)
      }
      callback?.(error, response)
    })
  }, [])

  // 发送消息
  const sendMessage = useCallback((messageData: MessageData, callback?: (error: any, response?: any) => void) => {
    // {{ AURA: Modify - 移除客户端认证检查，由服务器端验证 }}
    if (!socketRef.current?.connected) {
      console.error('❌ Socket 未连接')
      callback?.({ code: 'NOT_CONNECTED', message: 'Socket 未连接' })
      return
    }

    socketRef.current.emit('send-message', messageData, (error: any, response: any) => {
      if (error) {
        console.error('❌ 发送消息失败:', error)
      } else {
        console.log('✅ 消息发送成功:', response)
      }
      callback?.(error, response)
    })
  }, [])

  // 发送正在输入
  const sendTyping = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', roomId)
    }
  }, [])

  // 发送停止输入
  const sendStopTyping = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stop-typing', roomId)
    }
  }, [])

  // {{ AURA: Add - 标记消息已读 }}
  const markMessageRead = useCallback((messageId: string, roomId: string, callback?: (error: any, response?: any) => void) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Socket 未连接')
      callback?.({ code: 'NOT_CONNECTED', message: 'Socket 未连接' })
      return
    }

    socketRef.current.emit('mark-message-read', { messageId, roomId }, (error: any, response: any) => {
      if (error) {
        console.error('❌ 标记消息已读失败:', error)
      } else {
        console.log('✅ 消息已标记为已读:', response)
      }
      callback?.(error, response)
    })
  }, [])

  // {{ AURA: Add - 批量标记消息已读 }}
  const markMessagesRead = useCallback((messageIds: string[], roomId: string, callback?: (error: any, response?: any) => void) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Socket 未连接')
      callback?.({ code: 'NOT_CONNECTED', message: 'Socket 未连接' })
      return
    }

    if (!messageIds || messageIds.length === 0) {
      callback?.(null, { success: true })
      return
    }

    socketRef.current.emit('mark-messages-read', { messageIds, roomId }, (error: any, response: any) => {
      if (error) {
        console.error('❌ 批量标记消息已读失败:', error)
      } else {
        console.log('✅ 消息已批量标记为已读:', response)
      }
      callback?.(error, response)
    })
  }, [])

  // {{ AURA: Add - 置顶消息 }}
  const pinMessage = useCallback((messageId: string, roomId: string, callback?: (error: any, response?: any) => void) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Socket 未连接')
      callback?.({ code: 'NOT_CONNECTED', message: 'Socket 未连接' })
      return
    }

    socketRef.current.emit('pin-message', { messageId, roomId }, (error: any, response: any) => {
      if (error) {
        console.error('❌ 置顶消息失败:', error)
      } else {
        console.log('✅ 消息已置顶:', response)
      }
      callback?.(error, response)
    })
  }, [])

  // {{ AURA: Add - 取消置顶消息 }}
  const unpinMessage = useCallback((messageId: string, roomId: string, callback?: (error: any, response?: any) => void) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Socket 未连接')
      callback?.({ code: 'NOT_CONNECTED', message: 'Socket 未连接' })
      return
    }

    socketRef.current.emit('unpin-message', { messageId, roomId }, (error: any, response: any) => {
      if (error) {
        console.error('❌ 取消置顶失败:', error)
      } else {
        console.log('✅ 已取消置顶:', response)
      }
      callback?.(error, response)
    })
  }, [])

  // 注册事件处理器
  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set())
    }
    eventHandlersRef.current.get(event)!.add(handler)

    // 返回取消注册函数
    return () => {
      const handlers = eventHandlersRef.current.get(event)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          eventHandlersRef.current.delete(event)
        }
      }
    }
  }, [])

  // 触发事件处理器
  const triggerHandlers = useCallback((event: string, data: any) => {
    const handlers = eventHandlersRef.current.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }
  }, [])

  // 自动连接
  useEffect(() => {
    if (autoConnect && user) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, user, connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    sendStopTyping,
    markMessageRead,
    markMessagesRead,
    pinMessage,
    unpinMessage,
    on,
  }
}
