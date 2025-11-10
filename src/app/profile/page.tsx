'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useTheme } from '@/components/ThemeProvider'
import { useToast } from '@/components/ToastProvider'

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut, loading: authLoading } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { showToast } = useToast()
  const router = useRouter()

  const [formData, setFormData] = useState({
    nickname: '',
    signature: '',
    avatar_url: ''
  })
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'settings'>('profile')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')

  useEffect(() => {
    // 未登录重定向
    if (!authLoading && !user) {
      router.push('/auth/login')
    }

    // 加载用户资料
    if (profile) {
      setFormData({
        nickname: profile.nickname || '',
        signature: profile.signature || '',
        avatar_url: profile.avatar_url || ''
      })
      setAvatarPreview(profile.avatar_url || '')
    }
  }, [user, profile, authLoading, router])

  // {{ AURA: Add - 处理头像上传 }}
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error')
      return
    }

    // 验证文件大小（最大2MB）
    if (file.size > 2 * 1024 * 1024) {
      showToast('图片大小不能超过2MB', 'error')
      return
    }

    setUploadingAvatar(true)

    try {
      // 创建预览
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // 这里应该上传到服务器，暂时使用base64
      // TODO: 集成实际的文件上传服务（如Supabase Storage）
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      setFormData({ ...formData, avatar_url: base64 })
      showToast('头像已选择，请点击保存更新', 'success')
    } catch (error) {
      console.error('头像上传失败:', error)
      showToast('头像上传失败', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // {{ AURA: Add - 移除头像 }}
  const handleRemoveAvatar = () => {
    setFormData({ ...formData, avatar_url: '' })
    setAvatarPreview('')
    showToast('头像已移除，请点击保存更新', 'info')
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSuccess('')
    setLoading(true)

    // 验证昵称
    if (formData.nickname.length < 2 || formData.nickname.length > 20) {
      setErrors({ nickname: '昵称长度必须在2-20个字符之间' })
      showToast('昵称长度必须在2-20个字符之间', 'error')
      setLoading(false)
      return
    }

    // 验证个性签名
    if (formData.signature && formData.signature.length > 100) {
      setErrors({ signature: '个性签名不能超过100个字符' })
      showToast('个性签名不能超过100个字符', 'error')
      setLoading(false)
      return
    }

    const { error } = await updateProfile({
      nickname: formData.nickname,
      signature: formData.signature,
      avatar_url: formData.avatar_url
    })

    setLoading(false)

    if (error) {
      setErrors({ general: '更新失败，请稍后重试' })
      showToast('更新失败，请稍后重试', 'error')
    } else {
      setSuccess('个人资料已更新')
      showToast('个人资料已更新', 'success')
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSuccess('')

    // 验证新密码
    if (passwordData.newPassword.length < 8) {
      setErrors({ newPassword: '密码至少需要8个字符' })
      showToast('密码至少需要8个字符', 'error')
      return
    }

    if (!/[a-zA-Z]/.test(passwordData.newPassword) || !/[0-9]/.test(passwordData.newPassword)) {
      setErrors({ newPassword: '密码必须包含字母和数字' })
      showToast('密码必须包含字母和数字', 'error')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrors({ confirmPassword: '两次输入的密码不一致' })
      showToast('两次输入的密码不一致', 'error')
      return
    }

    // TODO: 实现密码修改逻辑
    // 注意：Supabase默认不支持通过客户端直接修改密码（需要旧密码验证）
    // 需要实现服务端API来处理密码修改
    setErrors({ general: '密码修改功能开发中...' })
    showToast('密码修改功能开发中...', 'info')
  }

  const handleLogout = async () => {
    await signOut()
    showToast('已退出登录', 'success')
    router.push('/auth/login')
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* {{ AURA: Modify - 优化头部信息显示 }} */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-6 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center space-x-6">
              {/* {{ AURA: Modify - 显示真实头像或首字母 }} */}
              <div className="relative group">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.nickname}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-2xl group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-2xl group-hover:scale-105 transition-transform">
                    {profile.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 border-4 border-white dark:border-gray-800 rounded-full"></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  {profile.nickname}
                  {profile.is_admin && (
                    <span className="px-2.5 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg shadow-sm">
                      管理员
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  {profile.email}
                </p>
                {profile.signature && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 italic max-w-md">
                    "{profile.signature}"
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl font-medium flex items-center gap-2 justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退出登录
            </button>
          </div>
        </div>

        {/* 标签页 */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
          <div className="border-b border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'profile'
                    ? 'text-blue-600 dark:text-blue-400 border-b-3 border-blue-600 dark:border-blue-400 bg-white/50 dark:bg-gray-800/50'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/30 dark:hover:bg-gray-800/30'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                个人资料
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'password'
                    ? 'text-blue-600 dark:text-blue-400 border-b-3 border-blue-600 dark:border-blue-400 bg-white/50 dark:bg-gray-800/50'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/30 dark:hover:bg-gray-800/30'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                修改密码
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'settings'
                    ? 'text-blue-600 dark:text-blue-400 border-b-3 border-blue-600 dark:border-blue-400 bg-white/50 dark:bg-gray-800/50'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/30 dark:hover:bg-gray-800/30'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                偏好设置
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* 个人资料标签 */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                {/* {{ AURA: Add - 头像上传区域 }} */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    头像
                  </label>
                  <div className="flex items-center space-x-6">
                    {/* 头像预览 */}
                    <div className="relative group">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="头像预览"
                          className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-2xl group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl border-4 border-white dark:border-gray-700 shadow-2xl group-hover:scale-105 transition-transform">
                          {formData.nickname?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    {/* 上传按钮 */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            disabled={uploadingAvatar}
                          />
                          <span className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {uploadingAvatar ? '上传中...' : '选择图片'}
                          </span>
                        </label>
                        
                        {avatarPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            disabled={uploadingAvatar}
                            className="inline-flex items-center px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            移除头像
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        支持 JPG、PNG、GIF 格式，最大 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    昵称
                  </label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all shadow-sm"
                    minLength={2}
                    maxLength={20}
                    required
                  />
                  {errors.nickname && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.nickname}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    个性签名
                  </label>
                  <textarea
                    value={formData.signature}
                    onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all shadow-sm resize-none"
                    rows={3}
                    maxLength={100}
                    placeholder="分享一句话介绍自己..."
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formData.signature.length} / 100 字符
                    </p>
                    {formData.signature.length > 80 && (
                      <p className="text-sm text-orange-600 dark:text-orange-400">即将达到上限</p>
                    )}
                  </div>
                  {errors.signature && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.signature}
                    </p>
                  )}
                </div>

                {success && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 p-4 rounded-lg">
                    {success}
                  </div>
                )}

                {errors.general && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    {errors.general}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      保存中...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      保存更改
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 修改密码标签 */}
            {activeTab === 'password' && (
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    旧密码
                  </label>
                  <input
                    type="password"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    新密码
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    minLength={8}
                    required
                  />
                  {errors.newPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.newPassword}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
                  )}
                </div>

                {errors.general && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    {errors.general}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  修改密码
                </button>

                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  修改密码后需要重新登录
                </p>
              </form>
            )}

            {/* 偏好设置标签 */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <label className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    主题设置
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => setTheme('light')}
                      className={`group p-6 border-2 rounded-2xl transition-all duration-300 ${
                        theme === 'light'
                          ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 shadow-lg scale-105'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:shadow-md hover:scale-102'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">☀️</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">浅色</div>
                        {theme === 'light' && (
                          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">当前主题</div>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`group p-6 border-2 rounded-2xl transition-all duration-300 ${
                        theme === 'dark'
                          ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 shadow-lg scale-105'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:shadow-md hover:scale-102'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🌙</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">深色</div>
                        {theme === 'dark' && (
                          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">当前主题</div>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`group p-6 border-2 rounded-2xl transition-all duration-300 ${
                        theme === 'system'
                          ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 shadow-lg scale-105'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:shadow-md hover:scale-102'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💻</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">跟随系统</div>
                        {theme === 'system' && (
                          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">当前主题</div>
                        )}
                      </div>
                    </button>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      当前显示: {resolvedTheme === 'dark' ? '深色模式' : '浅色模式'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    账号信息
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        账号创建时间
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(profile.created_at).toLocaleDateString('zh-CN', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        用户ID
                      </span>
                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 px-3 py-1 rounded-lg">
                        {profile.id.slice(0, 16)}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
