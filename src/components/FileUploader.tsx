'use client'

import { useState, useRef } from 'react'
import { useToast } from './ToastProvider'

interface FileUploaderProps {
  roomId: string
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export default function FileUploader({
  roomId,
  onFileSelect,
  disabled = false,
}: FileUploaderProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件大小（50MB）
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      showToast('文件大小不能超过50MB', 'error')
      return
    }

    // 验证文件类型
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'video/mp4',
      'audio/mpeg', 'audio/wav'
    ]

    if (!allowedTypes.includes(file.type)) {
      showToast('不支持的文件类型', 'error')
      return
    }

    onFileSelect(file)
    
    // 重置input以允许选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.mp4,.mp3,.wav"
      />
      
      <button
        onClick={handleFileClick}
        disabled={disabled}
        className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="上传文件"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
      </button>
    </>
  )
}
