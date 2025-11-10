'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

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
  pinnedBy?: string  // {{ AURA: Add - 置顶者ID }}
}

interface MessageListProps {
  messages: Message[]
  currentUserId?: string
  loading?: boolean
  isSystemAdmin?: boolean  // {{ AURA: Add - 系统管理员标识 }}
  isRoomAdmin?: boolean  // {{ AURA: Add - 房间管理员标识 }}
  onDeleteMessage?: (messageId: string) => void  // {{ AURA: Add - 删除消息回调 }}
  onEditMessage?: (messageId: string, newContent: string) => void  // {{ AURA: Add - 编辑消息回调 }}
  onAddReaction?: (messageId: string, emoji: string) => void  // {{ AURA: Add - 添加反应回调 }}
  onRemoveReaction?: (messageId: string, emoji: string) => void  // {{ AURA: Add - 移除反应回调 }}
  onReply?: (message: Message) => void  // {{ AURA: Add - 回复消息回调 }}
  onPinMessage?: (messageId: string) => void  // {{ AURA: Add - 置顶消息回调 }}
  onUnpinMessage?: (messageId: string) => void  // {{ AURA: Add - 取消置顶回调 }}
  roomMembers?: Array<{ user_id: string; users: Array<{ nickname: string }> }>  // {{ AURA: Add - 房间成员列表，用于显示已读用户 }}
  pinnedMessages?: Message[]  // {{ AURA: Add - 置顶消息列表 }}
  showPinnedMessages?: boolean  // {{ AURA: Add - 是否显示置顶区域 }}
}

export default function MessageList({
  messages,
  currentUserId,
  loading = false,
  isSystemAdmin = false,
  isRoomAdmin = false,
  onDeleteMessage,
  onEditMessage,
  onAddReaction,
  onRemoveReaction,
  onReply,  // {{ AURA: Add - 回复回调 }}
  onPinMessage,  // {{ AURA: Add - 置顶回调 }}
  onUnpinMessage,  // {{ AURA: Add - 取消置顶回调 }}
  roomMembers = [],  // {{ AURA: Add - 房间成员 }}
  pinnedMessages = [],  // {{ AURA: Add - 置顶消息 }}
  showPinnedMessages = true,  // {{ AURA: Add - 显示置顶区域 }}
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)  // {{ AURA: Add - Emoji 选择器状态 }}
  const [showReadList, setShowReadList] = useState<string | null>(null)  // {{ AURA: Add - 已读列表弹窗状态 }}

  // {{ AURA: Add - 常用 Emoji 列表 }}
  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏']

  // {{ AURA: Add - 获取已读用户昵称列表 }}
  const getReadByNames = (readBy: string[] = []) => {
    return readBy
      .map(userId => {
        const member = roomMembers.find(m => m.user_id === userId)
        return member?.users[0]?.nickname || '未知用户'
      })
      .filter(Boolean)
  }

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // {{ AURA: Add - 处理编辑消息 }}
  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
  }

  const handleSaveEdit = (messageId: string) => {
    if (editContent.trim() && onEditMessage) {
      onEditMessage(messageId, editContent.trim())
      setEditingMessageId(null)
      setEditContent('')
    }
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditContent('')
  }

  // {{ AURA: Add - 处理删除消息 }}
  const handleDelete = (messageId: string, messageContent: string) => {
    if (confirm(`确定要删除这条消息吗？\n"${messageContent.substring(0, 50)}..."`)) {
      onDeleteMessage?.(messageId)
    }
  }

  // {{ AURA: Add - 处理添加反应 }}
  const handleAddReaction = (messageId: string, emoji: string) => {
    onAddReaction?.(messageId, emoji)
    setShowEmojiPicker(null)
  }

  // {{ AURA: Add - 处理移除反应 }}
  const handleRemoveReaction = (messageId: string, emoji: string) => {
    onRemoveReaction?.(messageId, emoji)
  }

  // {{ AURA: Add - 处理反应点击（切换） }}
  const handleReactionClick = (messageId: string, emoji: string, userIds: string[]) => {
    if (currentUserId && userIds.includes(currentUserId)) {
      handleRemoveReaction(messageId, emoji)
    } else {
      handleAddReaction(messageId, emoji)
    }
  }

  // {{ AURA: Add - 渲染消息内容，高亮@提及 }}
  const renderMessageContent = (content: string) => {
    // 匹配 @username 格式
    const mentionRegex = /(@\S+)/g
    const parts = content.split(mentionRegex)
    
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            // 高亮@提及
            return (
              <span
                key={index}
                className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 rounded"
              >
                {part}
              </span>
            )
          }
          return <span key={index}>{part}</span>
        })}
      </>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">加载消息中...</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <svg
            className="w-24 h-24 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            暂无消息
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            发送第一条消息开始聊天吧！
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto custom-scrollbar smooth-scroll bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-4 space-y-4"
    >
      {/* {{ AURA: Add - 置顶消息显示区域 }} */}
      {pinnedMessages && pinnedMessages.length > 0 && showPinnedMessages && (
        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
              <span>📌</span>
              <span>置顶消息 ({pinnedMessages.length})</span>
            </h3>
            <button
              onClick={() => {/* TODO: 添加关闭置顶区域的处理 */}}
              className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
              title="收起"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {pinnedMessages.map((pinnedMsg) => (
              <div
                key={pinnedMsg.id}
                className="bg-white dark:bg-gray-800 rounded p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => {
                  // 滚动到原始消息位置
                  const msgElement = document.getElementById(`msg-${pinnedMsg.id}`)
                  if (msgElement) {
                    msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    // 高亮效果
                    msgElement.classList.add('ring-2', 'ring-yellow-400')
                    setTimeout(() => {
                      msgElement.classList.remove('ring-2', 'ring-yellow-400')
                    }, 2000)
                  }
                }}
              >
                <div className="flex items-start gap-2">
                  <img
                    src={pinnedMsg.user.avatar_url || '/default-avatar.png'}
                    alt={pinnedMsg.user.nickname}
                    className="w-6 h-6 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {pinnedMsg.user.nickname}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(pinnedMsg.pinnedAt || pinnedMsg.createdAt), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {pinnedMsg.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.map((message, index) => {
        const isCurrentUser = message.userId === currentUserId
        const showAvatar =
          index === 0 || messages[index - 1].userId !== message.userId
        const showTimestamp =
          index === 0 ||
          new Date(message.createdAt).getTime() -
            new Date(messages[index - 1].createdAt).getTime() >
            5 * 60 * 1000 // 5分钟

        return (
          <div key={message.id} id={`msg-${message.id}`} className="message-enter">
            {/* 时间戳 */}
            {showTimestamp && (
              <div className="flex justify-center my-4">
                <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                  {formatDistanceToNow(new Date(message.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
            )}

            {/* 消息 */}
            <div
              className={`flex items-end space-x-2 ${
                isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''
              }`}
              onMouseEnter={() => setHoveredMessageId(message.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {/* {{ AURA: Modify - 头像显示真实图片或首字母 }} */}
              {showAvatar ? (
                message.user.avatar_url ? (
                  <img
                    src={message.user.avatar_url}
                    alt={message.user.nickname}
                    className="w-10 h-10 rounded-full object-cover shadow-md flex-shrink-0 border-2 border-white dark:border-gray-700"
                    onError={(e) => {
                      // 图片加载失败时显示首字母
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                ) : null
              ) : (
                <div className="w-10 flex-shrink-0"></div>
              )}
              {showAvatar && (
                <div 
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0"
                  style={{ display: message.user.avatar_url ? 'none' : 'flex' }}
                >
                  {message.user.nickname.charAt(0).toUpperCase()}
                </div>
              )}

              {/* 消息内容 */}
              <div
                className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'}`}
              >
                {/* 用户名 */}
                {showAvatar && !isCurrentUser && (
                  <div className="mb-1 px-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {message.user.nickname}
                    </span>
                  </div>
                )}

                {/* {{ AURA: Add - 消息操作按钮 }} */}
                <div className="relative">
                  {/* 消息气泡 */}
                  <div
                    className={`px-4 py-2 rounded-2xl shadow-sm transition-all hover:shadow-md ${
                      isCurrentUser
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm border border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    {/* 编辑模式 */}
                    {editingMessageId === message.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(message.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* {{ AURA: Add - 显示被回复的消息 }} */}
                        {message.replyTo && message.replyMessage && (
                          <div className={`mb-2 pb-2 border-l-2 pl-2 ${
                            isCurrentUser 
                              ? 'border-blue-300' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            <div className={`text-xs font-medium mb-1 ${
                              isCurrentUser 
                                ? 'text-blue-200' 
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              回复 @{message.replyMessage.user?.nickname || '未知用户'}
                            </div>
                            <div className={`text-sm opacity-75 line-clamp-2 ${
                              isCurrentUser 
                                ? 'text-blue-50' 
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {message.replyMessage.messageType === 'text' 
                                ? message.replyMessage.content 
                                : `[${message.replyMessage.messageType === 'image' ? '图片' : '文件'}]`
                              }
                            </div>
                          </div>
                        )}

                        {/* {{ AURA: Modify - 文本消息，高亮@提及 }} */}
                        {message.messageType === 'text' && (
                          <p className="whitespace-pre-wrap break-words message-content">
                            {renderMessageContent(message.content)}
                          </p>
                        )}

                        {/* 系统消息 */}
                        {message.messageType === 'system' && (
                          <p className="text-sm italic">{message.content}</p>
                        )}

                        {/* {{ AURA: Add - 文件消息显示 }} */}
                        {message.messageType === 'file' && message.fileUrl && (
                          <div className="mt-2">
                            {/* 图片预览 */}
                            {message.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <div className="max-w-sm">
                                <img
                                  src={message.fileUrl}
                                  alt={message.fileName}
                                  className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(message.fileUrl, '_blank')}
                                />
                                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                                  {message.fileName} ({(message.fileSize! / 1024).toFixed(1)} KB)
                                </p>
                              </div>
                            ) : (
                              /* 其他文件 */
                              <a
                                href={message.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-white truncate">
                                    {message.fileName}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {message.fileSize && `${(message.fileSize / 1024).toFixed(1)} KB`}
                                  </p>
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                            )}
                          </div>
                        )}

                        {/* 编辑标识 */}
                        {message.isEdited && (
                          <span
                            className={`text-xs ml-2 ${
                              isCurrentUser
                                ? 'text-blue-200'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            (已编辑)
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* {{ AURA: Add - 悬停操作按钮 }} */}
                  {hoveredMessageId === message.id && editingMessageId !== message.id && (
                    <div
                      className={`absolute top-0 flex gap-1 ${
                        isCurrentUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
                      }`}
                    >
                      {/* 编辑按钮（仅自己的消息） */}
                      {isCurrentUser && message.messageType === 'text' && (
                        <button
                          onClick={() => handleStartEdit(message)}
                          className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
                          title="编辑"
                        >
                          <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      
                      {/* 删除按钮（自己的消息或系统管理员） */}
                      {(isCurrentUser || isSystemAdmin) && (
                        <button
                          onClick={() => handleDelete(message.id, message.content)}
                          className="p-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-full transition-colors"
                          title={isSystemAdmin && !isCurrentUser ? '系统管理员删除' : '删除'}
                        >
                          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}

                      {/* {{ AURA: Add - 回复按钮 }} */}
                      <button
                        onClick={() => onReply?.(message)}
                        className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
                        title="回复"
                      >
                        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>

                      {/* {{ AURA: Add - 置顶/取消置顶按钮 (仅管理员可见) }} */}
                      {isRoomAdmin && (
                        <button
                          onClick={() => message.isPinned ? onUnpinMessage?.(message.id) : onPinMessage?.(message.id)}
                          className={`p-1.5 ${message.isPinned ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-gray-200 dark:bg-gray-700'} hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded-full transition-colors`}
                          title={message.isPinned ? "取消置顶" : "置顶消息"}
                        >
                          <span className="text-base">{message.isPinned ? '📍' : '📌'}</span>
                        </button>
                      )}

                      {/* {{ AURA: Add - 反应按钮 }} */}
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                        className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
                        title="添加反应"
                      >
                        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* {{ AURA: Add - Emoji 选择器 }} */}
                  {showEmojiPicker === message.id && (
                    <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex gap-1 z-10">
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleAddReaction(message.id, emoji)}
                          className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
                          title={`添加 ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* {{ AURA: Add - 显示反应 }} */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(message.reactions).map(([emoji, data]) => {
                      const hasReacted = currentUserId && data.userIds.includes(currentUserId)
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReactionClick(message.id, emoji, data.userIds)}
                          className={`px-2 py-1 rounded-full text-sm flex items-center gap-1 transition-all ${
                            hasReacted
                              ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400'
                              : 'bg-gray-100 dark:bg-gray-700 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          title={data.users.join(', ')}
                        >
                          <span className="text-base">{emoji}</span>
                          <span className={`text-xs font-semibold ${
                            hasReacted ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {data.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* {{ AURA: Add - 显示已读回执（仅显示自己发送的消息） }} */}
                {isCurrentUser && message.readBy && message.readBy.length > 0 && (
                  <div className="mt-2 relative">
                    <button
                      onClick={() => setShowReadList(showReadList === message.id ? null : message.id)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已读 {message.readBy.length}人
                    </button>

                    {/* {{ AURA: Add - 已读用户列表弹窗 }} */}
                    {showReadList === message.id && (
                      <div className="absolute left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-20 min-w-[200px]">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          已读用户
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                          {getReadByNames(message.readBy).map((name, index) => {
                            // {{ AURA: Add - 获取对应用户的头像 }}
                            const userId = message.readBy?.[index]
                            const member = roomMembers.find(m => m.user_id === userId)
                            const avatarUrl = (member?.users[0] as any)?.avatar_url
                            
                            return (
                              <div key={index} className="flex items-center gap-2">
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt={name}
                                    className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
                                  />
                                ) : (
                                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 消息时间（悬停显示） */}
                <div
                  className={`mt-1 px-1 text-xs text-gray-500 dark:text-gray-400 ${
                    isCurrentUser ? 'text-right' : 'text-left'
                  }`}
                >
                  {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* 滚动锚点 */}
      <div ref={messagesEndRef} />
    </div>
  )
}
