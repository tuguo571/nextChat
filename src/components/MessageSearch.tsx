'use client'

import { useState, useEffect } from 'react'
import { searchMessages } from '@/lib/chatRoomApi'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Message {
  id: string
  room_id: string
  user_id: string
  content: string
  message_type: string
  file_url?: string
  file_name?: string
  file_size?: number
  is_edited: boolean
  created_at: string
  users: Array<{
    id: string
    nickname: string
    avatar_url?: string
  }>
}

interface MessageSearchProps {
  roomId: string
  onMessageClick?: (messageId: string) => void
}

export default function MessageSearch({ roomId, onMessageClick }: MessageSearchProps) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (!keyword.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    setSearching(true)
    setHasSearched(true)

    const { data, error } = await searchMessages(roomId, keyword.trim())
    
    if (error) {
      console.error('搜索失败:', error)
      setResults([])
    } else {
      setResults(data || [])
    }

    setSearching(false)
  }

  // 按Enter键搜索
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 高亮显示关键词
  const highlightKeyword = (text: string) => {
    if (!keyword.trim()) return text

    const parts = text.split(new RegExp(`(${keyword})`, 'gi'))
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === keyword.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 搜索框 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="搜索消息内容..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !keyword.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {searching ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>

      {/* 搜索结果 */}
      <div className="flex-1 overflow-y-auto p-4">
        {searching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">搜索中...</p>
          </div>
        ) : !hasSearched ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              搜索历史消息
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              输入关键词查找相关消息
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              未找到相关消息
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              试试其他关键词
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              找到 {results.length} 条相关消息
            </p>
            {results.map((message) => (
              <div
                key={message.id}
                onClick={() => onMessageClick?.(message.id)}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {message.users[0]?.nickname.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {message.users[0]?.nickname}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                  {highlightKeyword(message.content)}
                </p>

                {message.is_edited && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 inline-block">
                    (已编辑)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
