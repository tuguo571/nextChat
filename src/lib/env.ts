/**
 * 环境变量验证工具
 * {{ AURA: Add - 运行时检查必需的环境变量 }}
 */

export function validateEnvVars() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName] === 'placeholder'
  )

  if (missingVars.length > 0 && typeof window !== 'undefined') {
    console.warn(
      '⚠️ 缺少必需的环境变量:',
      missingVars.join(', '),
      '\n请在 EdgeOne 控制台配置环境变量'
    )
  }

  return missingVars.length === 0
}

export function getEnvVar(name: string, fallback: string = ''): string {
  const value = process.env[name]
  
  if (!value || value.startsWith('placeholder')) {
    if (typeof window !== 'undefined') {
      console.warn(`⚠️ 环境变量 ${name} 未设置，使用默认值`)
    }
    return fallback
  }
  
  return value
}
