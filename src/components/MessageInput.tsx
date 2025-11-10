'use client'

import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { useToast } from './ToastProvider'
import FileUploader from './FileUploader'  // {{ AURA: Add - 文件上传组件 }}
import { Message } from '@/types'  // {{ AURA: Add - 消息类型定义 }}

// {{ AURA: Add - 房间成员类型定义 }}
interface RoomMember {
  user_id: string
  users: Array<{
    id: string
    nickname: string
  }>
}

interface MessageInputProps {
  roomId: string
  onSend: (content: string, messageType: 'text', mentionedUserIds?: string[], replyTo?: string) => Promise<void>  // {{ AURA: Modify - 添加replyTo参数 }}
  onSendFile?: (file: File) => Promise<void>  // {{ AURA: Add - 文件发送回调 }}
  onTyping?: () => void
  onStopTyping?: () => void
  disabled?: boolean
  roomMembers?: RoomMember[]  // {{ AURA: Add - 房间成员列表用于@提及 }}
  replyingTo?: Message | null  // {{ AURA: Add - 正在回复的消息 }}
  onCancelReply?: () => void  // {{ AURA: Add - 取消回复的回调 }}
}

export default function MessageInput({
  roomId,
  onSend,
  onSendFile,  // {{ AURA: Add - 文件发送回调 }}
  onTyping,
  onStopTyping,
  disabled = false,
  roomMembers = [],  // {{ AURA: Add - 默认空数组 }}
  replyingTo,  // {{ AURA: Add - 回复状态 }}
  onCancelReply,  // {{ AURA: Add - 取消回复 }}
}: MessageInputProps) {
  const { showToast } = useToast()
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // {{ AURA: Add - @提及选择器状态 }}
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState(0)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([])  // 存储被提及的用户ID
  // {{ AURA: Add - 文件上传状态 }}
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // {{ AURA: Add - 过滤匹配@查询的成员 }}
  const filteredMembers = showMentionPicker
    ? roomMembers.filter(member => {
        const nickname = member.users[0]?.nickname || ''
        return nickname.toLowerCase().includes(mentionQuery.toLowerCase())
      }).slice(0, 5)  // 最多显示5个
    : []

  // 处理输入变化
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)

    // {{ AURA: Add - 检测@符号触发提及选择器 }}
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = newContent.slice(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf('@')
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1)
      // 如果@后面没有空格，显示选择器
      if (!textAfterAt.includes(' ') && roomMembers.length > 0) {
        setShowMentionPicker(true)
        setMentionQuery(textAfterAt)
        setMentionPosition(atIndex)
        setSelectedMentionIndex(0)
      } else {
        setShowMentionPicker(false)
      }
    } else {
      setShowMentionPicker(false)
    }

    // 触发正在输入事件
    if (onTyping) {
      onTyping()

      // 清除之前的定时器
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // 2秒后触发停止输入
      typingTimeoutRef.current = setTimeout(() => {
        if (onStopTyping) {
          onStopTyping()
        }
      }, 2000)
    }

    // 自动调整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  // {{ AURA: Add - 选择提及的用户 }}
  const handleSelectMention = (member: RoomMember) => {
    const nickname = member.users[0]?.nickname || ''
    const beforeMention = content.slice(0, mentionPosition)
    const afterMention = content.slice(mentionPosition + 1 + mentionQuery.length)
    const newContent = `${beforeMention}@${nickname} ${afterMention}`
    
    setContent(newContent)
    setShowMentionPicker(false)
    setMentionQuery('')
    
    // 添加到提及用户列表
    if (!mentionedUsers.includes(member.user_id)) {
      setMentionedUsers([...mentionedUsers, member.user_id])
    }
    
    // 聚焦输入框
    textareaRef.current?.focus()
  }

  // {{ AURA: Add - 处理文件选择 }}
  const handleFileSelect = async (file: File) => {
    if (!onSendFile) {
      showToast('文件发送功能未启用', 'error')
      return
    }

    setUploadingFile(true)
    setUploadProgress(0)

    try {
      await onSendFile(file)
      showToast('文件发送成功', 'success')
    } catch (error) {
      console.error('文件发送失败:', error)
      showToast('文件发送失败', 'error')
    } finally {
      setUploadingFile(false)
      setUploadProgress(0)
    }
  }

  // 发送消息
  const handleSend = async () => {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return
    }

    if (trimmedContent.length > 5000) {
      showToast('消息长度不能超过5000字符', 'error')
      return
    }

    setSending(true)

    try {
      // {{ AURA: Modify - 传递被提及的用户ID和回复ID }}
      await onSend(trimmedContent, 'text', mentionedUsers, replyingTo?.id)
      setContent('')
      setMentionedUsers([])  // 清空提及列表

      // {{ AURA: Add - 清空回复状态 }}
      if (onCancelReply) {
        onCancelReply()
      }

      // 重置高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      // 触发停止输入
      if (onStopTyping) {
        onStopTyping()
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      showToast('发送失败，请重试', 'error')
    } finally {
      setSending(false)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // {{ AURA: Add - 提及选择器的键盘导航 }}
    if (showMentionPicker && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex((prev) => (prev + 1) % filteredMembers.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelectMention(filteredMembers[selectedMentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionPicker(false)
        return
      }
    }

    // Ctrl+Enter 或 Cmd+Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // 处理失去焦点
  const handleBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (onStopTyping) {
      onStopTyping()
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-lg">
      {/* {{ AURA: Add - 回复状态显示 }} */}
      {replyingTo && (
        <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-500 rounded shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  回复 @{replyingTo?.user?.nickname || (replyingTo as any)?.users?.[0]?.nickname || '未知用户'}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                {((replyingTo as any).message_type || (replyingTo as any).messageType) === 'text' 
                  ? replyingTo.content 
                  : `[${((replyingTo as any).message_type || (replyingTo as any).messageType) === 'image' ? '图片' : '文件'}]`
                }
              </p>
            </div>
            <button
              onClick={onCancelReply}
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="取消回复"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <div className="flex items-end space-x-2">
        {/* 输入框 */}
        <div className="flex-1 relative">
          {/* {{ AURA: Add - @提及选择器弹窗 }} */}
          {showMentionPicker && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar z-50">
              <div className="p-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                  选择要@的成员
                </div>
                {filteredMembers.map((member, index) => (
                  <button
                    key={member.user_id}
                    onClick={() => handleSelectMention(member)}
                    onMouseEnter={() => setSelectedMentionIndex(index)}
                    className={`w-full text-left px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${
                      index === selectedMentionIndex
                        ? 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {/* {{ AURA: Modify - 显示真实头像或首字母 }} */}
                    {(member.users[0] as any)?.avatar_url ? (
                      <img
                        src={(member.users[0] as any).avatar_url}
                        alt={member.users[0].nickname}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-sm border border-gray-200 dark:border-gray-600"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                        {member.users[0]?.nickname?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      @{member.users[0]?.nickname}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="输入消息... (Ctrl+Enter 发送，@ 提及成员)"
            disabled={disabled || sending}
            rows={1}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed max-h-32 overflow-y-auto custom-scrollbar transition-all"
            style={{ minHeight: '48px' }}
          />

          {/* 字符计数 */}
          {content.length > 4500 && (
            <div
              className={`absolute bottom-2 right-2 text-xs ${
                content.length > 5000
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {content.length}/5000
            </div>
          )}
        </div>

        {/* {{ AURA: Add - 文件上传按钮 }} */}
        {onSendFile && (
          <FileUploader
            roomId={roomId}
            onFileSelect={handleFileSelect}
            disabled={disabled || sending || uploadingFile}
          />
        )}

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          disabled={!content.trim() || disabled || sending || uploadingFile}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center space-x-2 min-w-[100px] justify-center"
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>发送中</span>
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span>发送</span>
            </>
          )}
        </button>
      </div>

      {/* {{ AURA: Add - 上传进度显示 }} */}
      {uploadingFile && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              正在上传文件...
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {uploadProgress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-4">
        <span>💡 使用 Ctrl+Enter 快速发送</span>
        <span>•</span>
        <span>最多 5000 字符</span>
      </div>
    </div>
  )
}
