import { createClient } from '@supabase/supabase-js'
import { validateEnvVars, getEnvVar } from './env'

// {{ AURA: Add - 验证环境变量 }}
if (typeof window !== 'undefined') {
  validateEnvVars()
}

// {{ AURA: Modify - 添加构建时容错处理，避免EdgeOne部署失败 }}
const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://placeholder.supabase.co')
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'placeholder-anon-key')

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// 服务端使用的Supabase客户端 (具有完整权限)
export const getServiceSupabase = () => {
  const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', 'placeholder-service-key')
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
