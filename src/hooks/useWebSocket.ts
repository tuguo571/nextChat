'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { WSMessage, MessagePayload } from '../../server/types'

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options

  const { user } = useAuth()
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const subscribedRoomsRef = useRef<Set<string>>(new Set())
  const messageHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())
  const tokenRef = useRef<string | null>(null)

  // 发送消息
  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.error('WebSocket 未连接')
    }
  }, [])

  // 连接到 WebSocket 服务器
  const connect = useCallback(async () => {
    // 获取当前 session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      console.log('未登录，跳过 WebSocket 连接')
      return
    }

    tokenRef.current = session.access_token

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket 已连接')
      return
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }))

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('✅ WebSocket 连接成功')
      reconnectAttemptsRef.current = 0
      setState({ isConnected: true, isConnecting: false, error: null })

      // 发送认证消息
      send({
        type: 'auth',
        payload: { token: tokenRef.current },
        timestamp: Date.now(),
      })

      // 重新订阅之前的房间
      subscribedRoomsRef.current.forEach((roomId) => {
        send({
          type: 'subscribe',
          payload: { roomId },
          timestamp: Date.now(),
        })
      })
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)

        // 处理心跳
        if (message.type === 'ping') {
          send({ type: 'pong', timestamp: Date.now() })
          return
        }

        // 触发消息处理器
        const handlers = messageHandlersRef.current.get(message.type)
        if (handlers) {
          handlers.forEach((handler) => handler(message.payload))
        }

        // 触发通用消息处理器
        const allHandlers = messageHandlersRef.current.get('*')
        if (allHandlers) {
          allHandlers.forEach((handler) => handler(message))
        }
      } catch (error) {
        console.error('消息解析失败:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket 错误:', error)
      setState((prev) => ({ ...prev, error: 'WebSocket 连接错误' }))
    }

    ws.onclose = () => {
      console.log('🔌 WebSocket 连接关闭')
      setState({ isConnected: false, isConnecting: false, error: null })
      wsRef.current = null

      // {{ AURA: Add - 检查是否在线，离线时不重连 }}
      if (!navigator.onLine) {
        console.log('📡 网络离线，停止重连尝试')
        setState((prev) => ({ ...prev, error: '网络连接已断开' }))
        return
      }

      // 尝试重连
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++
        console.log(
          `🔄 尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
        )

        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectInterval)
      } else {
        setState((prev) => ({
          ...prev,
          error: `重连失败，已达最大尝试次数 (${maxReconnectAttempts})`,
        }))
      }
    }

    wsRef.current = ws
  }, [send, reconnectInterval, maxReconnectAttempts])

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setState({ isConnected: false, isConnecting: false, error: null })
  }, [])

  // 订阅房间
  const subscribe = useCallback(
    (roomId: string) => {
      subscribedRoomsRef.current.add(roomId)

      if (state.isConnected) {
        send({
          type: 'subscribe',
          payload: { roomId },
          timestamp: Date.now(),
        })
      }
    },
    [state.isConnected, send]
  )

  // 取消订阅房间
  const unsubscribe = useCallback(
    (roomId: string) => {
      subscribedRoomsRef.current.delete(roomId)

      if (state.isConnected) {
        send({
          type: 'unsubscribe',
          payload: { roomId },
          timestamp: Date.now(),
        })
      }
    },
    [state.isConnected, send]
  )

  // 发送消息
  const sendMessage = useCallback(
    (payload: MessagePayload) => {
      if (!state.isConnected) {
        console.error('WebSocket 未连接，无法发送消息')
        return
      }

      send({
        type: 'message',
        payload,
        timestamp: Date.now(),
      })
    },
    [state.isConnected, send]
  )

  // 注册消息处理器
  const on = useCallback((type: string, handler: (data: any) => void) => {
    if (!messageHandlersRef.current.has(type)) {
      messageHandlersRef.current.set(type, new Set())
    }
    messageHandlersRef.current.get(type)!.add(handler)

    // 返回取消注册函数
    return () => {
      const handlers = messageHandlersRef.current.get(type)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(type)
        }
      }
    }
  }, [])

  // 自动连接
  useEffect(() => {
    if (autoConnect && user) {
      connect()
    }

    // {{ AURA: Add - 监听网络状态，自动重连 }}
    const handleOnline = () => {
      console.log('🌐 网络恢复，尝试重新连接...')
      reconnectAttemptsRef.current = 0  // 重置重连次数
      connect()
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
      disconnect()
    }
  }, [autoConnect, user, connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage,
    on,
  }
}
