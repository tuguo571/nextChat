'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/ToastProvider'
import { useSocket } from '@/hooks/useSocket'  // {{ AURA: Add - Socket.IO支持 }}
import CreateRoomDialog from '@/components/CreateRoomDialog'
import { getUserChatRooms, joinChatRoom, leaveChatRoom, searchChatRooms, getUnreadCounts } from '@/lib/chatRoomApi'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface ChatRoomWithRole {
  id: string
  name: string
  description: string | null
  member_count: number
  last_activity_at: string
  created_at: string
  userRole?: string
}

export default function ChatPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const socket = useSocket()  // {{ AURA: Add - Socket.IO }}

  const [rooms, setRooms] = useState<ChatRoomWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<ChatRoomWithRole[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})  // {{ AURA: Add - 未读消息数 }}

  // 未登录重定向
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // 加载用户的聊天室列表
  const loadRooms = async () => {
    setLoading(true)
    const { data, error } = await getUserChatRooms()
    
    if (error) {
      showToast('加载聊天室列表失败', 'error')
    } else {
      setRooms(data || [])
    }
    
    // {{ AURA: Add - 加载未读消息数 }}
    const { data: unreadData } = await getUnreadCounts()
    if (unreadData) {
      setUnreadCounts(unreadData)
    }
    
    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      loadRooms()
    }
  }, [user])

  // {{ AURA: Add - 监听新消息以更新未读数 }}
  useEffect(() => {
    if (!socket.isConnected || !socket.isAuthenticated) return

    const unsubscribeMessage = socket.on('message', (data: any) => {
      // 如果消息不是当前用户发送的，增加对应房间的未读数
      if (data.userId !== user?.id && data.roomId) {
        setUnreadCounts(prev => ({
          ...prev,
          [data.roomId]: (prev[data.roomId] || 0) + 1
        }))
      }
    })

    return () => {
      unsubscribeMessage()
    }
  }, [socket.isConnected, socket.isAuthenticated, user?.id])

  // 搜索聊天室
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const { data, error } = await searchChatRooms(searchKeyword.trim())
    
    if (error) {
      showToast('搜索失败', 'error')
    } else {
      setSearchResults(data || [])
    }
    
    setIsSearching(false)
  }

  // 加入聊天室
  const handleJoinRoom = async (roomId: string) => {
    const { error } = await joinChatRoom(roomId)
    
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('加入聊天室成功！', 'success')
      loadRooms()
      setSearchResults([])
      setSearchKeyword('')
    }
  }

  // 退出聊天室
  const handleLeaveRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`确定要退出"${roomName}"聊天室吗？`)) {
      return
    }

    const { error } = await leaveChatRoom(roomId)
    
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('已退出聊天室', 'success')
      loadRooms()
    }
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* {{ AURA: Modify - 现代化顶部导航栏 }} */}
      <nav className="sticky top-0 z-10 backdrop-blur-lg bg-white/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  实时聊天室
                </h1>
                {profile?.is_admin && (
                  <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-full inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                    管理员
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
                欢迎, <span className="font-semibold">{profile.nickname}</span>
              </span>
              <Link
                href="/profile"
                className="group p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                title="个人中心"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.nickname}
                    className="w-9 h-9 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-600 group-hover:border-blue-500 transition-colors"
                  />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm group-hover:scale-110 transition-transform">
                    {profile.nickname?.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* {{ AURA: Modify - 主内容区优化 }} */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* {{ AURA: Modify - 搜索和创建区域优化 }} */}
        <div className="mb-8">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                    placeholder="搜索聊天室名称或描述..."
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-6 py-3.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
                >
                  {isSearching ? (
                    <span className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      搜索中
                    </span>
                  ) : '搜索'}
                </button>
              </div>
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center group"
              >
                <svg className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                创建聊天室
              </button>
            </div>
          </div>
        </div>

        {/* {{ AURA: Modify - 搜索结果区域优化 }} */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                搜索结果
                <span className="text-lg text-gray-500 dark:text-gray-400">({searchResults.length})</span>
              </h2>
              <button
                onClick={() => {
                  setSearchResults([])
                  setSearchKeyword('')
                }}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                清除
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchResults.map((room) => (
                <div
                  key={room.id}
                  className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden transform hover:-translate-y-1"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <span className="text-2xl text-white font-bold">
                          {room.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                        可加入
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {room.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">
                      {room.description || '暂无描述'}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        {room.member_count} 成员
                      </span>
                      <button
                        onClick={() => handleJoinRoom(room.id)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                      >
                        加入
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* {{ AURA: Modify - 我的聊天室区域优化 }} */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
              {profile?.is_admin ? '所有聊天室' : '我的聊天室'}
              <span className="text-lg text-gray-500 dark:text-gray-400">({rooms.length})</span>
            </h2>
            {profile?.is_admin && rooms.length > 0 && (
              <span className="text-sm px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-full flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                管理员权限
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">加载聊天室...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-lg p-16 text-center border border-gray-200/50 dark:border-gray-700/50">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                还没有加入任何聊天室
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                创建一个新聊天室开始聊天，或搜索现有聊天室加入
              </p>
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                创建第一个聊天室
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden group"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <span className="text-2xl text-white font-bold">
                          {room.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {unreadCounts[room.id] > 0 && (
                        <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[24px] text-center shadow-md animate-pulse">
                          {unreadCounts[room.id] > 99 ? '99+' : unreadCounts[room.id]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1">
                        {room.name}
                      </h3>
                      {room.userRole === 'admin' && (
                        <span className="px-2.5 py-1 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg shadow-sm">
                          管理员
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px] leading-relaxed">
                      {room.description || '暂无描述'}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-5 py-3 border-t border-b border-gray-100 dark:border-gray-700/50">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        {room.member_count} 人
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {room.last_activity_at 
                          ? formatDistanceToNow(new Date(room.last_activity_at), { 
                              addSuffix: true, 
                              locale: zhCN 
                            })
                          : '暂无活动'}
                      </span>
                    </div>
                    
                    <div className="flex gap-2.5">
                      <Link
                        href={`/chat/${room.id}`}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-center rounded-xl font-semibold transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                      >
                        进入聊天
                      </Link>
                      {room.userRole !== 'admin' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleLeaveRoom(room.id, room.name);
                          }}
                          className="px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 rounded-xl transition-all font-medium"
                        >
                          退出
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 创建聊天室对话框 */}
      <CreateRoomDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={loadRooms}
      />
    </div>
  )
}
