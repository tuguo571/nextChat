'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User as AppUser } from '@/types'

interface AuthContextType {
  user: User | null
  profile: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, nickname: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<AppUser>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // 如果用户记录不存在（PGRST116错误），尝试创建
        if (error.code === 'PGRST116') {
          console.log('用户记录不存在，尝试创建...')
          
          // 获取auth用户信息
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            // 创建用户记录
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({
                id: authUser.id,
                email: authUser.email || '',
                nickname: authUser.user_metadata?.nickname || authUser.email?.split('@')[0] || '用户',
                password_hash: 'managed_by_supabase_auth', // 占位符
              })
              .select()
              .single()

            if (createError) {
              console.error('创建用户记录失败:', createError)
              throw createError
            }

            setProfile(newUser)
            return
          }
        }
        throw error
      }
      
      setProfile(data)
    } catch (error) {
      console.error('加载用户资料失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signUp = async (email: string, password: string, nickname: string) => {
    try {
      // 首先创建认证用户（注意：Supabase默认需要邮箱验证，这里我们先关闭验证）
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // 关闭邮箱验证
          data: {
            nickname, // 将昵称保存到用户元数据中
          }
        }
      })

      if (authError) throw authError

      // Supabase Auth会自动创建用户，我们需要在users表中也创建对应记录
      if (authData.user) {
        // 使用service role key来插入用户数据（绕过RLS）
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              email,
              nickname,
              password_hash: 'managed_by_supabase_auth', // 密码由Supabase Auth管理
            },
          ])

        if (profileError) {
          console.error('创建用户资料失败:', profileError)
          // 即使插入失败，用户也已经在auth系统中创建了
          // 可以选择回滚或者后续补充
        }
      }

      return { error: null }
    } catch (error) {
      console.error('注册错误:', error)
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const updateProfile = async (updates: Partial<AppUser>) => {
    if (!user) return { error: new Error('未登录') }

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error

      // 更新本地状态
      setProfile((prev) => (prev ? { ...prev, ...updates } : null))

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
