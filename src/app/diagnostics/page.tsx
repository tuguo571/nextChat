'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const runDiagnostics = async () => {
      const results: any = {}

      // 1. 检查环境变量
      results.env = {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set',
        anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
        anonKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 30) || 'Not set',
        anonKeyFormat: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('.') ? 'JWT format ✅' : 'Invalid format ❌',
      }

      // 2. 测试Supabase连接
      try {
        const { data, error } = await supabase.from('users').select('count').limit(1)
        results.connection = {
          status: error ? 'Failed ❌' : 'Success ✅',
          error: error?.message || null,
        }
      } catch (err) {
        results.connection = {
          status: 'Failed ❌',
          error: (err as Error).message,
        }
      }

      // 3. 测试认证服务
      try {
        const { data, error } = await supabase.auth.getSession()
        results.auth = {
          status: error ? 'Failed ❌' : 'Available ✅',
          hasSession: !!data.session,
          error: error?.message || null,
        }
      } catch (err) {
        results.auth = {
          status: 'Failed ❌',
          error: (err as Error).message,
        }
      }

      // 4. 检查数据库表
      try {
        const tables = ['users', 'chat_rooms', 'messages']
        const tableStatus: any = {}
        
        for (const table of tables) {
          try {
            const { error } = await supabase.from(table).select('count').limit(1)
            tableStatus[table] = error ? `Missing ❌ (${error.message})` : 'Exists ✅'
          } catch (err) {
            tableStatus[table] = `Error ❌ (${(err as Error).message})`
          }
        }
        
        results.tables = tableStatus
      } catch (err) {
        results.tables = { error: (err as Error).message }
      }

      setDiagnostics(results)
      setLoading(false)
    }

    runDiagnostics()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">运行诊断中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          🔍 系统诊断报告
        </h1>

        {/* 环境变量检查 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📋 环境变量配置
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Supabase URL:</span>
              <span className="text-gray-900 dark:text-white font-mono text-sm">
                {diagnostics.env?.supabaseUrl}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Anon Key Length:</span>
              <span className={`font-semibold ${diagnostics.env?.anonKeyLength > 100 ? 'text-green-600' : 'text-red-600'}`}>
                {diagnostics.env?.anonKeyLength} 字符
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Anon Key Prefix:</span>
              <span className="text-gray-900 dark:text-white font-mono text-xs">
                {diagnostics.env?.anonKeyPrefix}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600 dark:text-gray-400">Key Format:</span>
              <span className="font-semibold">
                {diagnostics.env?.anonKeyFormat}
              </span>
            </div>
          </div>
        </div>

        {/* Supabase连接测试 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            🔌 Supabase连接测试
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">连接状态:</span>
              <span className="font-semibold">
                {diagnostics.connection?.status}
              </span>
            </div>
            {diagnostics.connection?.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <p className="text-sm text-red-800 dark:text-red-200">
                  ❌ {diagnostics.connection.error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 认证服务测试 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            🔐 认证服务测试
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">服务状态:</span>
              <span className="font-semibold">
                {diagnostics.auth?.status}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">当前会话:</span>
              <span className="font-semibold">
                {diagnostics.auth?.hasSession ? '已登录 ✅' : '未登录 ⚪'}
              </span>
            </div>
            {diagnostics.auth?.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <p className="text-sm text-red-800 dark:text-red-200">
                  ❌ {diagnostics.auth.error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 数据库表检查 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            🗄️ 数据库表检查
          </h2>
          <div className="space-y-3">
            {Object.entries(diagnostics.tables || {}).map(([table, status]) => (
              <div key={table} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400 font-mono">{table}</span>
                <span className="text-sm">{status as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 修复建议 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-200 mb-4">
            💡 修复建议
          </h2>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>如果 Anon Key 长度小于100字符，请检查 <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">.env.local</code> 文件</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>Anon Key 应该以 <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.</code> 开头</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>从 Supabase 控制台获取正确的密钥：Settings → API → Project API keys</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4.</span>
              <span>如果数据库表缺失，请执行 <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">database/schema.sql</code></span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">5.</span>
              <span>修改 <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">.env.local</code> 后必须重启开发服务器</span>
            </li>
          </ul>
          
          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              📖 查看详细修复指南：<code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">FIX_AUTH_ERROR.md</code>
            </p>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mt-6 flex gap-4">
          <a
            href="/auth/register"
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg text-center font-semibold hover:bg-blue-700 transition-colors"
          >
            测试注册
          </a>
          <a
            href="/auth/login"
            className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg text-center font-semibold hover:bg-gray-700 transition-colors"
          >
            测试登录
          </a>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            刷新诊断
          </button>
        </div>
      </div>
    </div>
  )
}
