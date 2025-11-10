'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/ToastProvider'
import { useSocket } from '@/hooks/useSocket'
import AddMemberDialog from '@/components/AddMemberDialog'
import MessageInput from '@/components/MessageInput'
import MessageList from '@/components/MessageList'
import MessageSearch from '@/components/MessageSearch'  // {{ AURA: Add - 消息搜索组件 }}
import { getChatRoom, getRoomMembers, checkRoomMembership, joinChatRoom, leaveChatRoom, removeRoomMember, updateMemberRole, deleteMessage, editMessage, addMessageReaction, removeMessageReaction, uploadFile, markRoomAsRead, getPinnedMessages } from '@/lib/chatRoomApi'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface RoomMemberData {
  id: string
  user_id: string
  role: string
  joined_at: string
  users: Array<{
    id: string
    nickname: string
    avatar_url: string | null
    signature: string | null
    is_admin?: boolean  // {{ AURA: Add - 系统管理员标识 }}
  }>
}

interface ChatRoomDetail {
  id: string
  name: string
  description: string | null
  creator_id: string
  created_at: string
  last_activity_at: string
  creator: {
    id: string
    nickname: string
    avatar_url: string | null
  }
}

interface Message {
  id: string
  roomId: string
  userId: string
  content: string
  messageType: string
  replyTo?: string
  replyMessage?: Message  // {{ AURA: Add - 被回复的消息详情 }}
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
  reactions?: Record<string, { count: number; users: string[]; userIds: string[] }>  // {{ AURA: Add - 消息反应 }}
  readBy?: string[]  // {{ AURA: Add - 已读用户ID列表 }}
  isPinned?: boolean  // {{ AURA: Add - 是否置顶 }}
  pinnedAt?: string  // {{ AURA: Add - 置顶时间 }}
  pinnedBy?: string  // {{ AURA: Add - 置顶操作者ID }}
}

export default function ChatRoomPage({ params }: { params: { roomId: string } }) {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const socket = useSocket()

  const [room, setRoom] = useState<ChatRoomDetail | null>(null)
  const [members, setMembers] = useState<RoomMemberData[]>([])
  const [membership, setMembership] = useState<{ isMember: boolean; role: string | null }>({ isMember: false, role: null })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'settings' | 'search'>('chat')  // {{ AURA: Modify - 添加search标签 }}
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])  // {{ AURA: Add - 在线用户列表 }}
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)  // {{ AURA: Add - 回复状态 }}
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([])  // {{ AURA: Add - 置顶消息列表 }}
  const [showPinnedMessages, setShowPinnedMessages] = useState(true)  // {{ AURA: Add - 是否显示置顶消息区域 }}
  const [typingUsers, setTypingUsers] = useState<Map<string, { userId: string; nickname: string; timestamp: number }>>(new Map())  // {{ AURA: Add - 正在打字的用户 }}
  const [isPageVisible, setIsPageVisible] = useState(true)  // {{ AURA: Add - 页面可见性状态 }}
  const [backgroundMessageCount, setBackgroundMessageCount] = useState(0)  // {{ AURA: Add - 后台接收的消息数 }}
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)  // {{ AURA: Add - 加载超时定时器 }}
  const hasLoadedRef = useRef(false)  // {{ AURA: Add - 是否已加载过，防止重复加载 }}
  const isLoadingRef = useRef(false)  // {{ AURA: Add - 是否正在加载中 }}

  // {{ AURA: Add - 页面可见性监听 }}
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden
      
      console.log(`👁️ 页面可见性变化: ${visible ? '可见' : '隐藏'}, loading=${loading}`)
      
      // {{ AURA: Add - 只更新状态，不触发重新渲染 }}
      setIsPageVisible(visible)
      
      if (visible) {
        // {{ AURA: Add - 页面从后台切换回前台 }}
        console.log(`✅ 页面恢复可见`)
        
        // {{ AURA: Add - 延迟3秒后清除后台消息计数提示 }}
        if (backgroundMessageCount > 0) {
          console.log(`📬 后台收到 ${backgroundMessageCount} 条新消息`)
          setTimeout(() => {
            setBackgroundMessageCount(0)
          }, 3000)  // 3秒后自动清除提示
          
          // {{ AURA: Add - 标记消息为已读 }}
          if (membership.isMember) {
            markRoomAsRead(params.roomId)
          }
        }
        
        // {{ AURA: Add - 重置文档标题 }}
        if (room?.name) {
          document.title = room.name
        }
      } else {
        console.log(`⚠️ 页面已隐藏`)
      }
    }

    // {{ AURA: Add - 立即检查当前状态 }}
    const currentVisible = !document.hidden
    console.log(`🔍 初始页面状态: ${currentVisible ? '可见' : '隐藏'}`)
    setIsPageVisible(currentVisible)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [backgroundMessageCount, membership.isMember, params.roomId, room?.name])

  // {{ AURA: Add - 网络状态监听 }}
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 网络已恢复，重新加载数据...')
      showToast('网络已恢复', 'success')
      if (user && membership.isMember) {
        loadMessages()
        loadPinnedMessages()
      }
    }

    const handleOffline = () => {
      console.log('📡 网络已断开')
      showToast('网络连接已断开', 'warning')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [user, membership.isMember, params.roomId])

  useEffect(() => {
    if (user && !hasLoadedRef.current && !isLoadingRef.current) {
      console.log('🔄 首次加载聊天室数据')
      hasLoadedRef.current = true
      loadRoomData()
    }
  }, [user, params.roomId])

  // {{ AURA: Add - 自动清理超过5秒的打字状态 }}
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setTypingUsers((prev) => {
        const newMap = new Map(prev)
        let hasChanges = false
        
        Array.from(newMap.entries()).forEach(([userId, data]) => {
          if (now - data.timestamp > 5000) {  // 5秒超时
            newMap.delete(userId)
            hasChanges = true
          }
        })
        
        return hasChanges ? newMap : prev
      })
    }, 1000)  // 每秒检查一次

    return () => clearInterval(interval)
  }, [])

  const loadRoomData = async () => {
    // {{ AURA: Add - 防止重复加载 }}
    if (isLoadingRef.current) {
      console.log('⏳ 已有加载任务进行中，跳过')
      return
    }

    isLoadingRef.current = true
    setLoading(true)
    
    // {{ AURA: Add - 设置加载超时保护（15秒） }}
    loadingTimeoutRef.current = setTimeout(() => {
      console.warn('⚠️ 加载超时，强制结束加载状态')
      setLoading(false)
      setLoadingMessages(false)
      isLoadingRef.current = false
      showToast('加载超时，部分数据可能未加载完成', 'warning')
    }, 15000)

    try {
      // 加载聊天室信息
      const { data: roomData, error: roomError } = await getChatRoom(params.roomId)
      if (roomError) {
        showToast('加载聊天室失败', 'error')
        // {{ AURA: Fix - 跳转前清除加载状态 }}
        setLoading(false)
        isLoadingRef.current = false
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
          loadingTimeoutRef.current = null
        }
        router.push('/chat')
        return
      }
      setRoom(roomData)

      // {{ AURA: Modify - 检查成员身份，支持系统管理员 }}
      const { isMember, role, isSystemAdmin } = await checkRoomMembership(params.roomId)
      
      // {{ AURA: Add - 系统管理员直接设置为成员，无需加入 }}
      if (isSystemAdmin) {
        console.log('🔑 系统管理员访问，拥有所有权限')
        setMembership({ isMember: true, role: 'admin' })
        showToast('以管理员身份访问', 'info')
      } else {
        setMembership({ isMember, role })
        
        // {{ AURA: Modify - 只有非系统管理员才需要加入流程 }}
        if (!isMember) {
          console.log('⚠️ 用户不是成员，尝试自动加入...')
          const { data: joinData, error: joinError } = await joinChatRoom(params.roomId)
          
          if (joinError) {
            console.error('❌ 自动加入失败:', joinError)
            showToast('无法加入该聊天室', 'error')
            // {{ AURA: Fix - 跳转前清除加载状态 }}
            setLoading(false)
            isLoadingRef.current = false
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current)
              loadingTimeoutRef.current = null
            }
            router.push('/chat')
            return
          }
          
          console.log('✅ 已自动加入聊天室，验证成员身份...')
          
          // {{ AURA: Add - 轮询验证成员身份，最多尝试5次，每次间隔200ms }}
          let recheckAttempts = 0
          let recheckMember = false
          let recheckRole = null
          
          while (recheckAttempts < 5 && !recheckMember) {
            await new Promise(resolve => setTimeout(resolve, 200))
            const result = await checkRoomMembership(params.roomId)
            recheckMember = result.isMember
            recheckRole = result.role
            recheckAttempts++
            
            if (!recheckMember) {
              console.log(`⏳ 第 ${recheckAttempts} 次验证失败，继续尝试...`)
            }
          }
          
          if (!recheckMember) {
            console.error('❌ 成员身份验证超时')
            showToast('加入聊天室失败，请刷新页面重试', 'error')
            // {{ AURA: Fix - 跳转前清除加载状态 }}
            setLoading(false)
            isLoadingRef.current = false
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current)
              loadingTimeoutRef.current = null
            }
            router.push('/chat')
            return
          }
          
          console.log(`✅ 成员身份验证成功 (第 ${recheckAttempts} 次尝试)`)
          showToast('已加入聊天室', 'success')
          // 更新成员身份
          setMembership({ isMember: true, role: recheckRole || 'member' })
        }
      }

      // 加载成员列表
      const { data: membersData } = await getRoomMembers(params.roomId)
      setMembers(membersData || [])

      // 加载历史消息
      await loadMessages()

      // {{ AURA: Add - 加载置顶消息 }}
      await loadPinnedMessages()

      // {{ AURA: Add - 标记房间消息为已读 }}
      await markRoomAsRead(params.roomId)

    } catch (error) {
      console.error('❌ 加载聊天室数据失败:', error)
      showToast('加载失败，请刷新页面重试', 'error')
    } finally {
      // {{ AURA: Add - 清除加载超时定时器和加载标志 }}
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      setLoading(false)
      isLoadingRef.current = false
      console.log('✅ 加载流程完成')
    }
  }

  const loadMessages = async () => {
    setLoadingMessages(true)
    try {
      // {{ AURA: Modify - 加载消息及其反应数据 }}
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          users:user_id (
            id,
            nickname,
            avatar_url
          )
        `)
        .eq('room_id', params.roomId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        console.error('加载消息失败:', error)
        showToast('加载消息失败', 'error')
        return
      }

      // {{ AURA: Add - 获取所有消息的反应数据 }}
      const messageIds = (data || []).map((msg: any) => msg.id)
      let reactionsMap: Record<string, any> = {}
      let readsMap: Record<string, string[]> = {}
      
      if (messageIds.length > 0) {
        // 获取反应数据
        const { data: reactionsData, error: reactionsError } = await supabase
          .from('message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', messageIds)
        
        if (!reactionsError && reactionsData) {
          // 按消息ID和emoji聚合反应
          reactionsData.forEach((reaction: any) => {
            if (!reactionsMap[reaction.message_id]) {
              reactionsMap[reaction.message_id] = {}
            }
            if (!reactionsMap[reaction.message_id][reaction.emoji]) {
              reactionsMap[reaction.message_id][reaction.emoji] = {
                count: 0,
                users: [],
                userIds: []
              }
            }
            reactionsMap[reaction.message_id][reaction.emoji].count++
            reactionsMap[reaction.message_id][reaction.emoji].userIds.push(reaction.user_id)
          })
        }

        // {{ AURA: Add - 获取已读数据 }}
        const { data: readsData, error: readsError } = await supabase
          .from('message_reads')
          .select('message_id, user_id')
          .in('message_id', messageIds)

        if (!readsError && readsData) {
          readsData.forEach((read: any) => {
            if (!readsMap[read.message_id]) {
              readsMap[read.message_id] = []
            }
            readsMap[read.message_id].push(read.user_id)
          })
        }
      }

      // {{ AURA: Modify - 转换数据格式，添加反应、回复消息和已读数据 }}
      const formattedMessages: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        roomId: msg.room_id,
        userId: msg.user_id,
        content: msg.content,
        messageType: msg.message_type,
        replyTo: msg.reply_to,
        replyMessage: msg.reply_message ? {
          id: msg.reply_message.id,
          roomId: msg.room_id,
          userId: msg.reply_message.user_id || '',
          content: msg.reply_message.content,
          messageType: msg.reply_message.message_type,
          fileUrl: msg.reply_message.file_url,
          fileName: msg.reply_message.file_name,
          isEdited: false,
          createdAt: msg.reply_message.created_at,
          user: msg.reply_message.users?.[0] || { id: '', nickname: '未知用户', avatar_url: null },
        } : undefined,
        fileUrl: msg.file_url,
        fileName: msg.file_name,
        fileSize: msg.file_size,
        isEdited: msg.is_edited,
        createdAt: msg.created_at,
        user: msg.users[0] || { id: msg.user_id, nickname: '未知用户', avatar_url: null },
        reactions: reactionsMap[msg.id] || {},
        readBy: readsMap[msg.id] || [],
      }))

      setMessages(formattedMessages)
    } catch (error) {
      console.error('加载消息异常:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  // {{ AURA: Add - 加载置顶消息 }}
  const loadPinnedMessages = async () => {
    try {
      const { data, error } = await getPinnedMessages(params.roomId)
      if (error) {
        console.error('加载置顶消息失败:', error)
        return
      }

      // 转换格式
      const formattedPinned: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        roomId: msg.room_id,
        userId: msg.user_id,
        content: msg.content,
        messageType: msg.message_type,
        replyTo: msg.reply_to,
        fileUrl: msg.file_url,
        fileName: msg.file_name,
        fileSize: msg.file_size,
        isEdited: msg.is_edited,
        createdAt: msg.created_at,
        user: msg.users?.[0] || { id: msg.user_id, nickname: '未知用户', avatar_url: null },
        isPinned: msg.is_pinned,
        pinnedAt: msg.pinned_at,
        pinnedBy: msg.pinned_by,
      }))

      setPinnedMessages(formattedPinned)
    } catch (error) {
      console.error('加载置顶消息异常:', error)
    }
  }

  // {{ AURA: Add - 自动标记消息为已读 }}
  useEffect(() => {
    if (!socket.isConnected || !socket.isAuthenticated || messages.length === 0) {
      return
    }

    // 标记所有未读消息为已读（排除自己发送的消息）
    const unreadMessageIds = messages
      .filter(msg => msg.userId !== user?.id && !msg.readBy?.includes(user?.id || ''))
      .map(msg => msg.id)

    if (unreadMessageIds.length > 0) {
      console.log(`📖 自动标记 ${unreadMessageIds.length} 条消息为已读`)
      socket.markMessagesRead(unreadMessageIds, params.roomId)
    }
  }, [messages, socket.isConnected, socket.isAuthenticated, user?.id, params.roomId])

  // {{ AURA: Modify - 改为事件驱动，确保成员身份验证完成后再加入 }}
  // Socket.IO 集成 - 连接和事件监听
  useEffect(() => {
    if (!socket.isConnected) {
      console.log('⏳ Socket 未连接，等待连接...')
      return
    }

    // {{ AURA: Add - 检查成员身份，只有确认是成员才加入 Socket 房间 }}
    if (!membership.isMember) {
      console.log('⏳ 等待成员身份验证完成...')
      return
    }

    console.log('✅ Socket 已连接且用户是成员，设置事件监听器')

    // {{ AURA: Modify - 优化加入房间逻辑，支持系统管理员快速加入 }}
    const joinRoomHandler = async () => {
      console.log('🚀 开始加入房间流程...')
      
      // 对于系统管理员，使用优化后的joinRoom方法
      socket.joinRoom(params.roomId, (error, response) => {
        if (error) {
          console.error('❌ 加入房间失败:', error)
          // 如果是系统管理员权限问题，提供更详细的错误信息
          if (error.code === 'NOT_MEMBER') {
            showToast('权限验证失败，请刷新页面重试', 'error')
          } else {
            showToast('加入房间失败', 'error')
          }
        } else {
          console.log('✅ 加入房间成功:', response)
          if (response?.isSystemAdmin) {
            showToast('以管理员身份加入聊天室', 'success')
          } else {
            showToast('已加入聊天室', 'success')
          }
        }
      })
    }

    // 监听认证成功事件
    const unsubscribeAuth = socket.on('authenticated', (data: any) => {
      console.log('🎊 收到认证成功事件，准备加入房间')
      joinRoomHandler()
    })

    // 如果已经认证过了（重连等情况），直接加入
    if (socket.isAuthenticated) {
      console.log('✅ 已认证，直接加入房间')
      joinRoomHandler()
    }

    // 监听新消息
    // {{ AURA: Modify - 转换消息格式，包含回复消息数据，并处理后台消息计数 }}
    const unsubscribeMessage = socket.on('message', (message: any) => {
      const formattedMessage: Message = {
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        content: message.content,
        messageType: message.messageType,
        replyTo: message.replyTo,
        replyMessage: message.replyMessage ? {
          id: message.replyMessage.id,
          roomId: message.roomId,
          userId: message.replyMessage.user_id || message.replyMessage.users?.[0]?.id || '',
          content: message.replyMessage.content,
          messageType: message.replyMessage.message_type,
          fileUrl: message.replyMessage.file_url,
          fileName: message.replyMessage.file_name,
          isEdited: false,
          createdAt: message.replyMessage.created_at,
          user: message.replyMessage.users?.[0] || { id: '', nickname: '未知用户', avatar_url: null },
        } : undefined,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        isEdited: message.isEdited,
        createdAt: message.createdAt,
        user: message.user,
      }
      
      setMessages((prev) => [...prev, formattedMessage])
      
      // {{ AURA: Add - 页面在后台时增加消息计数 }}
      if (!isPageVisible && message.userId !== user?.id) {
        setBackgroundMessageCount((prev) => {
          const newCount = prev + 1
          console.log(`📬 后台收到新消息，计数: ${newCount}`)
          
          // {{ AURA: Add - 更新文档标题显示未读消息数 }}
          document.title = `(${newCount}) ${room?.name || '聊天室'}`
          
          return newCount
        })
      }
    })

    // 监听用户加入
    const unsubscribeJoined = socket.on('user-joined', (data: any) => {
      if (data.isSystemAdmin) {
        showToast(`系统管理员 ${data.email} 加入了聊天室`, 'info')
      } else {
        showToast(`${data.email} 加入了聊天室`, 'info')
      }
    })

    // 监听用户离开
    const unsubscribeLeft = socket.on('user-left', (data: any) => {
      showToast(`${data.email} 离开了聊天室`, 'info')
    })

    // {{ AURA: Add - 监听消息删除 }}
    const unsubscribeDeleted = socket.on('message-deleted', (data: any) => {
      console.log('🗑️ 收到消息删除事件:', data)
      setMessages((prev) => prev.filter(msg => msg.id !== data.messageId))
      if (data.deletedBy !== user?.id) {
        showToast('一条消息已被删除', 'info')
      }
    })

    // {{ AURA: Add - 监听消息编辑 }}
    const unsubscribeEdited = socket.on('message-edited', (data: any) => {
      console.log('✏️ 收到消息编辑事件:', data)
      setMessages((prev) =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: data.newContent, isEdited: true }
            : msg
        )
      )
      if (data.editedBy !== user?.id) {
        showToast('消息已更新', 'info')
      }
    })

    // {{ AURA: Add - 监听在线用户列表更新 }}
    const unsubscribeOnlineUsers = socket.on('online-users-updated', (data: any) => {
      console.log('👥 在线用户列表更新:', data)
      if (data.roomId === params.roomId) {
        setOnlineUsers(data.onlineUsers || [])
      }
    })

    // {{ AURA: Add - 监听反应添加 }}
    const unsubscribeReactionAdded = socket.on('reaction-added', (data: any) => {
      console.log('👍 收到反应添加事件:', data)
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            const reactions = msg.reactions || {}
            const emoji = data.emoji
            if (!reactions[emoji]) {
              reactions[emoji] = { count: 0, users: [], userIds: [] }
            }
            reactions[emoji].count++
            reactions[emoji].userIds.push(data.userId)
            return { ...msg, reactions: { ...reactions } }
          }
          return msg
        })
      )
    })

    // {{ AURA: Add - 监听反应移除 }}
    const unsubscribeReactionRemoved = socket.on('reaction-removed', (data: any) => {
      console.log('👎 收到反应移除事件:', data)
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            const reactions = { ...(msg.reactions || {}) }
            const emoji = data.emoji
            if (reactions[emoji]) {
              reactions[emoji].count--
              reactions[emoji].userIds = reactions[emoji].userIds.filter((id: string) => id !== data.userId)
              if (reactions[emoji].count === 0) {
                delete reactions[emoji]
              }
            }
            return { ...msg, reactions }
          }
          return msg
        })
      )
    })

    // {{ AURA: Add - 监听@提及通知 }}
    const unsubscribeMention = socket.on('mention-notification', (data: any) => {
      console.log('📢 收到@提及通知:', data)
      showToast(`${data.fromUser.nickname} 在消息中@了你`, 'info')
    })

    // {{ AURA: Add - 监听消息已读回执 }}
    const unsubscribeMessageRead = socket.on('message-read', (data: any) => {
      console.log('📖 收到已读回执:', data)
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            const readBy = msg.readBy || []
            if (!readBy.includes(data.userId)) {
              return { ...msg, readBy: [...readBy, data.userId] }
            }
          }
          return msg
        })
      )
    })

    // {{ AURA: Add - 监听消息置顶 }}
    const unsubscribeMessagePinned = socket.on('message-pinned', (data: any) => {
      console.log('📌 收到置顶通知:', data)
      showToast('消息已置顶', 'info')
      // 重新加载置顶消息列表
      loadPinnedMessages()
      // 更新消息列表中的置顶状态
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, isPinned: true, pinnedAt: data.pinnedAt, pinnedBy: data.pinnedBy }
            : msg
        )
      )
    })

    // {{ AURA: Add - 监听取消置顶 }}
    const unsubscribeMessageUnpinned = socket.on('message-unpinned', (data: any) => {
      console.log('📌 收到取消置顶通知:', data)
      showToast('已取消置顶', 'info')
      // 从置顶列表中移除
      setPinnedMessages((prev) => prev.filter((msg) => msg.id !== data.messageId))
      // 更新消息列表中的置顶状态
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, isPinned: false, pinnedAt: undefined, pinnedBy: undefined }
            : msg
        )
      )
    })

    // {{ AURA: Add - 监听用户正在输入 }}
    const unsubscribeUserTyping = socket.on('user-typing', (data: any) => {
      console.log('⌨️ 用户正在输入:', data)
      if (data.userId !== user?.id) {
        // 找到该用户的昵称
        const member = members.find(m => m.user_id === data.userId)
        const nickname = member?.users?.[0]?.nickname || data.email || '某用户'
        
        setTypingUsers((prev) => {
          const newMap = new Map(prev)
          newMap.set(data.userId, {
            userId: data.userId,
            nickname,
            timestamp: Date.now(),
          })
          return newMap
        })
      }
    })

    // {{ AURA: Add - 监听用户停止输入 }}
    const unsubscribeUserStopTyping = socket.on('user-stop-typing', (data: any) => {
      console.log('⌨️ 用户停止输入:', data)
      setTypingUsers((prev) => {
        const newMap = new Map(prev)
        newMap.delete(data.userId)
        return newMap
      })
    })

    return () => {
      socket.leaveRoom(params.roomId)
      unsubscribeAuth()
      unsubscribeMessage()
      unsubscribeJoined()
      unsubscribeLeft()
      unsubscribeDeleted()
      unsubscribeEdited()
      unsubscribeOnlineUsers()
      unsubscribeReactionAdded()
      unsubscribeReactionRemoved()
      unsubscribeMention()
      unsubscribeMessageRead()
      unsubscribeMessagePinned()
      unsubscribeMessageUnpinned()
      unsubscribeUserTyping()
      unsubscribeUserStopTyping()
    }
  }, [socket.isConnected, socket.isAuthenticated, params.roomId, membership.isMember])

  // {{ AURA: Modify - 发送消息，支持@提及和回复 }}
  const handleSendMessage = async (content: string, messageType: 'text', mentionedUserIds?: string[], replyTo?: string) => {
    return new Promise<void>((resolve, reject) => {
      socket.sendMessage(
        {
          roomId: params.roomId,
          content,
          messageType,
          mentionedUserIds,  // {{ AURA: Add - 传递被提及的用户ID }}
          replyTo,  // {{ AURA: Add - 传递被回复的消息ID }}
        },
        (error, response) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
      )
    })
  }

  // 正在输入
  const handleTyping = () => {
    socket.sendTyping(params.roomId)
  }

  // 停止输入
  const handleStopTyping = () => {
    socket.sendStopTyping(params.roomId)
  }

  // {{ AURA: Add - 删除消息 }}
  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await deleteMessage(messageId, params.roomId)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('消息已删除', 'success')
      // 从本地状态中移除消息
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    }
  }

  // {{ AURA: Add - 编辑消息 }}
  const handleEditMessage = async (messageId: string, newContent: string) => {
    const { error } = await editMessage(messageId, newContent)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('消息已更新', 'success')
      // 更新本地状态中的消息
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: newContent, isEdited: true }
            : msg
        )
      )
    }
  }

  // {{ AURA: Add - 添加消息反应 }}
  const handleAddReaction = async (messageId: string, emoji: string) => {
    const { error } = await addMessageReaction(messageId, emoji)
    if (error) {
      if (!error.message.includes('已经添加')) {
        showToast(error.message, 'error')
      }
    }
  }

  // {{ AURA: Add - 移除消息反应 }}
  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    const { error } = await removeMessageReaction(messageId, emoji)
    if (error) {
      showToast(error.message, 'error')
    }
  }

  // {{ AURA: Add - 置顶消息 }}
  const handlePinMessage = (messageId: string) => {
    socket.pinMessage(messageId, params.roomId, (error, response) => {
      if (error) {
        showToast(error.message || '置顶失败', 'error')
      } else {
        showToast('消息已置顶', 'success')
      }
    })
  }

  // {{ AURA: Add - 取消置顶消息 }}
  const handleUnpinMessage = (messageId: string) => {
    socket.unpinMessage(messageId, params.roomId, (error, response) => {
      if (error) {
        showToast(error.message || '取消置顶失败', 'error')
      } else {
        showToast('已取消置顶', 'success')
      }
    })
  }

  // {{ AURA: Add - 发送文件 }}
  const handleSendFile = async (file: File) => {
    try {
      // 上传文件
      const { data, error } = await uploadFile(file, params.roomId)
      
      if (error) {
        showToast(error.message, 'error')
        throw error
      }

      if (!data) {
        throw new Error('文件上传失败')
      }

      // 通过Socket发送文件消息
      return new Promise<void>((resolve, reject) => {
        socket.sendMessage(
          {
            roomId: params.roomId,
            content: `[文件] ${data.fileName}`,
            messageType: 'file',
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
          },
          (error, response) => {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          }
        )
      })
    } catch (error) {
      console.error('发送文件失败:', error)
      throw error
    }
  }

  // {{ AURA: Add - 处理回复消息 }}
  const handleReply = (message: Message) => {
    setReplyingTo(message)
  }

  // {{ AURA: Add - 取消回复 }}
  const handleCancelReply = () => {
    setReplyingTo(null)
  }

  const handleLeaveRoom = async () => {
    if (!room) return

    if (room.creator_id === user?.id) {
      showToast('创建者不能退出聊天室，请删除聊天室', 'error')
      return
    }

    if (!confirm(`确定要退出"${room.name}"聊天室吗？`)) {
      return
    }

    const { error } = await leaveChatRoom(params.roomId)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('已退出聊天室', 'success')
      router.push('/chat')
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`确定要移除成员"${memberName}"吗？`)) {
      return
    }

    const { error } = await removeRoomMember(params.roomId, memberId)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('成员已移除', 'success')
      loadRoomData()
    }
  }

  const handleToggleRole = async (memberId: string, currentRole: string, memberName: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    const action = newRole === 'admin' ? '设为管理员' : '取消管理员'

    if (!confirm(`确定要将"${memberName}"${action}吗？`)) {
      return
    }

    const { error } = await updateMemberRole(params.roomId, memberId, newRole)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(`已${action}`, 'success')
      loadRoomData()
    }
  }

  if (loading) {
    console.log('🔄 显示加载界面, isLoadingRef:', isLoadingRef.current, 'hasLoadedRef:', hasLoadedRef.current)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
          <p className="text-xs text-gray-400 mt-2">
            页面可见: {isPageVisible ? '是' : '否'} | 
            已加载: {hasLoadedRef.current ? '是' : '否'}
          </p>
        </div>
      </div>
    )
  }

  console.log('✅ 显示正常界面, loading:', loading, 'room:', !!room, 'hasLoaded:', hasLoadedRef.current)

  if (!room) {
    console.warn('⚠️ room 为 null，但 loading 为 false')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">聊天室数据加载失败</p>
          <button 
            onClick={() => router.push('/chat')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回聊天列表
          </button>
        </div>
      </div>
    )
  }

  const isAdmin = membership.role === 'admin'
  const isCreator = room.creator_id === user?.id

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航栏 */}
      <nav className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/chat"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {room.name}
              </h1>
              {/* {{ AURA: Add - 显示系统管理员或房间管理员标识 }} */}
              {profile?.is_admin && (
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs font-semibold rounded flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  系统管理员
                </span>
              )}
              {isAdmin && !profile?.is_admin && (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">
                  房间管理员
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {members.length} 名成员
              </span>
              {!isCreator && (
                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  退出聊天室
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 标签页 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              💬 聊天
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              👥 成员 ({members.length})
            </button>
            {/* {{ AURA: Add - 搜索标签 }} */}
            <button
              onClick={() => setActiveTab('search')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'search'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              🔍 搜索
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                ⚙️ 设置
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      {activeTab === 'chat' ? (
        // {{ AURA: Modify - 优化聊天界面布局，改善整体视觉效果 }}
        <div className="fixed top-16 bottom-0 left-0 right-0 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col">
          {/* Socket 连接状态提示 */}
          {!socket.isConnected && (
            <div className="bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 animate-pulse">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>正在连接实时服务器...</span>
              </p>
            </div>
          )}

          {/* {{ AURA: Add - 后台消息数量提示（页面可见时显示） }} */}
          {isPageVisible && backgroundMessageCount > 0 && (
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 border-b border-blue-600 dark:border-blue-700 px-4 py-2 shadow-md">
              <div className="flex items-center justify-between max-w-7xl mx-auto">
                <p className="text-sm text-white font-medium flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <span>刚刚在后台收到 {backgroundMessageCount} 条新消息</span>
                </p>
                <button
                  onClick={() => setBackgroundMessageCount(0)}
                  className="text-white hover:text-blue-100 text-sm underline transition-colors"
                >
                  知道了
                </button>
              </div>
            </div>
          )}

          {/* {{ AURA: Modify - 消息列表，添加反应、回复、已读回执和置顶功能回调 }} */}
          <MessageList
            messages={messages}
            currentUserId={user?.id}
            loading={loadingMessages}
            isSystemAdmin={profile?.is_admin}
            isRoomAdmin={membership.role === 'admin'}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
            onReply={handleReply}
            onPinMessage={handlePinMessage}
            onUnpinMessage={handleUnpinMessage}
            roomMembers={members}
            pinnedMessages={pinnedMessages}
            showPinnedMessages={showPinnedMessages}
          />

          {/* {{ AURA: Add - 打字指示器 }} */}
          {typingUsers.size > 0 && (
            <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750 border-t border-gray-200 dark:border-gray-700 shadow-inner">
              <div className="flex items-center space-x-3 max-w-7xl mx-auto">
                {/* 跳动的圆点动画 */}
                <div className="flex space-x-1">
                  <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}></span>
                  <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }}></span>
                  <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }}></span>
                </div>
                
                {/* 显示正在输入的用户 */}
                <div className="flex items-center space-x-2">
                  {Array.from(typingUsers.values()).slice(0, 3).map((typingUser, index) => (
                    <div
                      key={typingUser.userId}
                      className="flex items-center space-x-1"
                    >
                      {index > 0 && <span className="text-gray-400 dark:text-gray-500">、</span>}
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {typingUser.nickname}
                      </span>
                    </div>
                  ))}
                  {typingUsers.size > 3 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      等{typingUsers.size}人
                    </span>
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    正在输入...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* {{ AURA: Modify - 消息输入框，添加文件上传和回复支持 }} */}
          <MessageInput
            roomId={params.roomId}
            onSend={handleSendMessage}
            onSendFile={handleSendFile}
            onTyping={handleTyping}
            onStopTyping={handleStopTyping}
            disabled={!socket.isConnected || !socket.isAuthenticated}
            roomMembers={members}
            replyingTo={replyingTo as any}
            onCancelReply={handleCancelReply}
          />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 成员标签页 */}
          {activeTab === 'members' && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    聊天室成员
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    共 {members.length} 名成员
                  </p>
                </div>
              
              {/* 添加成员按钮（仅管理员） */}
              {isAdmin && (
                <button
                  onClick={() => setShowAddMemberDialog(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>添加成员</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar pr-2">
              {members.map((member) => {
                const userData = member.users[0]
                if (!userData) return null
                const isOnline = onlineUsers.includes(member.user_id)  // {{ AURA: Add - 检查在线状态 }}

                return (
                  <div
                    key={member.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {/* {{ AURA: Modify - 添加在线状态指示器和真实头像 }} */}
                        <div className="relative">
                          {userData.avatar_url ? (
                            <img
                              src={userData.avatar_url}
                              alt={userData.nickname}
                              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 shadow-md"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                              {userData.nickname.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {isOnline && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {userData.nickname}
                            {/* {{ AURA: Add - 在线状态文本 }} */}
                            {isOnline && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ● 在线
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDistanceToNow(new Date(member.joined_at), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </p>
                        </div>
                      </div>
                      {/* {{ AURA: Add - 区分系统管理员和房间管理员 }} */}
                      {userData.is_admin && (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs font-semibold rounded flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                          系统管理员
                        </span>
                      )}
                      {member.role === 'admin' && !userData.is_admin && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">
                          房间管理员
                        </span>
                      )}
                    </div>

                    {userData.signature && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {userData.signature}
                      </p>
                    )}

                    {/* 管理员操作 */}
                    {isAdmin && member.user_id !== user?.id && member.user_id !== room.creator_id && (
                      <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => handleToggleRole(member.user_id, member.role, userData.nickname)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          {member.role === 'admin' ? '取消管理员' : '设为管理员'}
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.user_id, userData.nickname)}
                          className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          移除
                        </button>
                      </div>
                    )}

                    {/* 创建者标识 */}
                    {member.user_id === room.creator_id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          👑 聊天室创建者
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* {{ AURA: Add - 搜索标签页内容区域 }} */}
        {activeTab === 'search' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md" style={{ height: 'calc(100vh - 250px)' }}>
            <MessageSearch
              roomId={params.roomId}
              onMessageClick={(messageId) => {
                // 点击搜索结果后切换回聊天标签
                setActiveTab('chat')
                // TODO: 可以添加滚动到特定消息的逻辑
              }}
            />
          </div>
        )}

        {/* 设置标签页 */}
        {activeTab === 'settings' && isAdmin && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                聊天室设置
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                管理聊天室信息和权限
              </p>
            </div>

            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  基本信息
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      聊天室名称
                    </label>
                    <p className="text-gray-900 dark:text-white">{room.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      描述
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {room.description || '暂无描述'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      创建者
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {room.creator.nickname}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      创建时间
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(room.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 编辑功能（占位符） */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-blue-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                      编辑功能即将推出
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      聊天室信息编辑、删除聊天室等功能正在开发中。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* 添加成员对话框 */}
      <AddMemberDialog
        isOpen={showAddMemberDialog}
        onClose={() => setShowAddMemberDialog(false)}
        roomId={params.roomId}
        existingMemberIds={members.map(m => m.user_id)}
        onMemberAdded={loadRoomData}
      />
    </div>
  )
}
