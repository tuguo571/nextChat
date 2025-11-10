'use client'

import { useState, useEffect } from 'react'
import { useToast } from './ToastProvider'
import { supabase } from '@/lib/supabase'
import { addRoomMember } from '@/lib/chatRoomApi'

interface User {
  id: string
  nickname: string
  email: string
  avatar_url: string | null
  signature: string | null
}

interface AddMemberDialogProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  existingMemberIds: string[]
  onMemberAdded: () => void
}

export default function AddMemberDialog({
  isOpen,
  onClose,
  roomId,
  existingMemberIds,
  onMemberAdded,
}: AddMemberDialogProps) {
  const { showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  // 搜索用户（防抖处理）
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSearchResults([])
      return
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(() => {
      searchUsers(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, isOpen])

  const searchUsers = async (query: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nickname, email, avatar_url, signature')
        .or(`nickname.ilike.%${query}%,email.ilike.%${query}%`)
        .not('id', 'in', `(${existingMemberIds.join(',')})`)
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
    } catch (error) {
      console.error('搜索用户失败:', error)
      showToast('搜索用户失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (userId: string, userName: string) => {
    setAdding(true)
    try {
      const { error } = await addRoomMember(roomId, userId)
      
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast(`已添加 ${userName}`, 'success')
        onMemberAdded()
        onClose()
      }
    } finally {
      setAdding(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              添加成员
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 搜索框 */}
          <div className="p-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="搜索用户昵称或邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
            </div>

            {/* 提示信息 */}
            {searchQuery.trim().length < 2 && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                请输入至少2个字符进行搜索
              </p>
            )}
          </div>

          {/* 搜索结果 */}
          <div className="px-6 pb-6 max-h-96 overflow-y-auto">
            {loading && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            )}

            {!loading && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400">
                  未找到匹配的用户
                </p>
              </div>
            )}

            {!loading && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {user.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {user.nickname}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </p>
                        {user.signature && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                            {user.signature}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMember(user.id, user.nickname)}
                      disabled={adding}
                      className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex-shrink-0"
                    >
                      {adding ? '添加中...' : '添加'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
