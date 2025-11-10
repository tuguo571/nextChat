# 快速启动指南

## 🎯 立即开始开发

### 第一步: 初始化数据库

1. **访问Supabase控制台**
   ```
   URL: http://sbp-ikairbucachjzcos.supabase.opentrust.net/
   项目ID: sbp-ikairbucachjzcos
   密码: RDXL0rNcSYWrGc_
   ```

2. **执行数据库脚本**
   - 点击左侧菜单 "SQL Editor"
   - 点击 "New Query"
   - 复制 `database/schema.sql` 的全部内容
   - 粘贴到编辑器并点击 "Run"
   - 等待执行完成 (约10-15秒)

3. **验证表创建**
   - 点击左侧菜单 "Table Editor"
   - 应该看到9个表: users, chat_rooms, room_members, messages等

### 第二步: 启动开发服务器

```powershell
# 确保在项目根目录
cd d:\GitHub\chat

# 启动Next.js开发服务器
npm run dev
```

服务器将在 http://localhost:3000 启动

### 第三步: 验证环境

打开浏览器访问 http://localhost:3000

**预期行为**:
- 看到加载动画
- 自动跳转到登录页面 (目前会显示404,因为登录页面还未创建)

---

## 🛠️ 下一步开发任务

### 任务 A: 创建登录页面

创建文件: `src/app/auth/login/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signIn } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/chat')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          登录聊天室
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          还没有账号？{' '}
          <a href="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">
            立即注册
          </a>
        </p>
      </div>
    </div>
  )
}
```

### 任务 B: 创建注册页面

创建文件: `src/app/auth/register/page.tsx`

**(类似登录页面,添加昵称字段和密码强度验证)**

---

## 📂 项目文件结构速览

```
d:\GitHub\chat\
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── auth/              # 认证相关页面 (待创建)
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── chat/              # 聊天室页面 (待创建)
│   │   ├── layout.tsx         # ✅ 已创建
│   │   ├── page.tsx           # ✅ 已创建
│   │   └── globals.css        # ✅ 已创建
│   ├── components/            # React组件
│   │   ├── ThemeProvider.tsx  # ✅ 已创建
│   │   └── AuthProvider.tsx   # ✅ 已创建
│   ├── lib/                   # 工具库
│   │   └── supabase.ts        # ✅ 已创建
│   ├── hooks/                 # 自定义Hooks (待创建)
│   ├── stores/                # Zustand状态 (待创建)
│   └── types/                 # TypeScript类型
│       └── index.ts           # ✅ 已创建
├── database/
│   └── schema.sql             # ✅ 已创建
├── .env.local                 # ✅ 已创建
├── package.json               # ✅ 已创建
├── tsconfig.json              # ✅ 已创建
├── tailwind.config.js         # ✅ 已创建
├── next.config.js             # ✅ 已创建
├── README.md                  # ✅ 已创建
├── PROGRESS.md                # ✅ 已创建
└── QUICKSTART.md              # ✅ 当前文件
```

---

## 🔍 常见问题

### Q: 依赖安装失败怎么办?
```powershell
# 清除缓存重新安装
rm -r node_modules
rm package-lock.json
npm install
```

### Q: TypeScript报错模块未找到?
- 重启VS Code
- 或运行: `npm install` 确保所有依赖已安装

### Q: 端口3000已被占用?
```powershell
# 使用其他端口
npm run dev -- -p 3001
```

### Q: Supabase连接失败?
- 检查 `.env.local` 中的URL和密钥是否正确
- 确保网络可以访问Supabase服务器

---

## 💡 开发技巧

1. **使用热重载**: 修改代码后自动刷新浏览器
2. **查看控制台**: 打开浏览器开发者工具查看错误
3. **使用React DevTools**: 安装Chrome扩展调试React组件
4. **使用Tailwind CSS IntelliSense**: VS Code扩展提供类名自动补全

---

## 📞 需要帮助?

- 查看 `README.md` 获取完整文档
- 查看 `PROGRESS.md` 了解当前进度
- 查看 `requirements.md` 了解需求详情

---

**祝开发顺利! 🚀**
