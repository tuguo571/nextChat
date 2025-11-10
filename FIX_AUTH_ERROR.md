# 修复认证错误：Invalid authentication credentials

## 问题诊断

**错误信息**：
```
AuthApiError: Invalid authentication credentials
```

**根本原因**：
`.env.local` 文件中的 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 配置不正确。

当前配置：
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=sbp-ikairbucachjzcos
```

这只是项目ID，而不是实际的Anon Key（匿名密钥）。

---

## 解决方案

### 步骤1：获取正确的Supabase密钥

1. **访问Supabase控制台**
   - 打开 `http://sbp-ikairbucachjzcos.supabase.opentrust.net/`
   - 或访问 https://supabase.com/ 并登录
   - 选择你的项目

2. **进入API设置页面**
   - 在左侧导航栏找到 **⚙️ Settings**（设置）
   - 点击 **API** 子菜单

3. **找到正确的密钥**
   你会看到以下密钥：

   **Project URL**（项目URL）
   ```
   http://sbp-ikairbucachjzcos.supabase.opentrust.net
   ```
   
   **anon public**（匿名公钥）- 这是你需要的！
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicC1pa2FpcmJ1Y2FjaGp6Y29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk...
   ```
   ⚠️ 这是一个很长的JWT令牌（通常200+字符）
   
   **service_role secret**（服务角色密钥）
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicC1pa2FpcmJ1Y2FjaGp6Y29zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI...
   ```
   ⚠️ 同样是一个很长的JWT令牌

4. **复制密钥**
   - 点击 **anon public** 右侧的复制按钮
   - 点击 **service_role** 右侧的复制按钮

### 步骤2：更新 `.env.local` 文件

打开 `d:\GitHub\chat\.env.local` 文件，替换为正确的密钥：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=http://sbp-ikairbucachjzcos.supabase.opentrust.net
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicC1pa2FpcmJ1Y2FjaGp6Y29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk...（替换为实际的anon key）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicC1pa2FpcmJ1Y2FjaGp6Y29zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI...（替换为实际的service_role key）

# AI配置
NEXT_PUBLIC_AI_API_URL=https://bbwh.netlib.re/v1/chat/completions
NEXT_PUBLIC_AI_API_KEY=AIzaSyCtEd5NhghUjb9wjMstZSwgLQt3MsTdRXM
NEXT_PUBLIC_AI_MODEL=gemini-2.5-pro

# WebDAV配置
WEBDAV_URL=https://cloud.922220.xyz/dav
WEBDAV_USERNAME=tuguo1024@outlook.com
WEBDAV_PASSWORD=EiMLcoEmbhq1ftf6HtpNG08F0XtnymA2

# WebSocket配置
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# JWT密钥
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

**重要提示**：
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 应该是 **anon public** 密钥（很长的JWT）
- `SUPABASE_SERVICE_ROLE_KEY` 应该是 **service_role** 密钥（很长的JWT）
- 这两个密钥都应该以 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.` 开头

### 步骤3：重启开发服务器

环境变量更改后，必须重启服务器才能生效：

```bash
# 停止当前服务器（按 Ctrl+C）

# 重新启动
npm run dev
```

### 步骤4：验证修复

1. 访问 `http://localhost:3000/auth/register`
2. 填写注册表单
3. 提交表单
4. 应该不再看到 "Invalid authentication credentials" 错误

---

## 验证密钥是否正确

你可以通过以下方法验证密钥格式：

### 方法1：检查密钥长度
```bash
# 正确的密钥应该很长（通常200-300字符）
# 错误：sbp-ikairbucachjzcos（只有20字符）
# 正确：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...（200+字符）
```

### 方法2：检查密钥格式
正确的JWT令牌应该包含三个部分，用点(`.`)分隔：
```
<header>.<payload>.<signature>
```

例如：
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicC1pa2FpcmJ1Y2FjaGp6Y29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyNTI4MDB9.abcdef123456789...
```

### 方法3：使用浏览器控制台测试
在浏览器控制台运行：

```javascript
// 检查环境变量是否正确加载
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Anon Key length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length)
console.log('Anon Key starts with:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 30))
```

正确输出应该类似：
```
Supabase URL: http://sbp-ikairbucachjzcos.supabase.opentrust.net
Anon Key length: 234
Anon Key starts with: eyJhbGciOiJIUzI1NiIsInR5cCI6I
```

---

## 常见问题

### Q1: 我找不到Supabase控制台的API页面

**A**: 
1. 登录 https://supabase.com/
2. 选择你的项目
3. 左侧导航栏：**Settings** → **API**
4. 在 "Project API keys" 部分可以看到所有密钥

### Q2: 我的Supabase是自托管的，如何获取密钥？

**A**: 
自托管Supabase的密钥通常在以下位置：
1. Docker环境变量配置文件
2. `.env` 文件中的 `ANON_KEY` 和 `SERVICE_ROLE_KEY`
3. 使用 `supabase status` 命令查看

### Q3: 更新后还是报同样的错误怎么办？

**A**: 
1. 确认已完全停止开发服务器（Ctrl+C）
2. 清除Next.js缓存：
   ```bash
   rm -rf .next
   npm run dev
   ```
3. 检查浏览器是否缓存了旧的环境变量（硬刷新：Ctrl+Shift+R）
4. 检查 `.env.local` 文件是否有语法错误（如多余的引号、空格）

### Q4: 如何保护我的密钥安全？

**A**: 
- ✅ 已经做对的：`.env.local` 在 `.gitignore` 中（不会被提交到Git）
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` 可以公开（只有只读权限）
- ⚠️ **绝对不要**公开 `SUPABASE_SERVICE_ROLE_KEY`（拥有完全权限）
- ⚠️ 生产环境使用环境变量而不是 `.env` 文件

---

## 其他可能的认证错误

如果修复密钥后仍有问题，检查以下项：

### 1. Supabase Authentication未启用

在Supabase控制台 > **Authentication** > **Providers**：
- ✅ 确保 **Email** provider 已启用
- ✅ 确保 "Enable email confirmations" 设置符合你的需求
  - 如果启用：用户注册后需要点击邮件链接验证
  - 如果禁用：用户注册后立即可用

### 2. 数据库未初始化

确认 `users` 表已创建：
```sql
SELECT * FROM users LIMIT 1;
```

如果报错 "relation users does not exist"，执行 `database/schema.sql`。

### 3. RLS策略阻止插入

检查 `users` 表的RLS策略：
```sql
SELECT * FROM pg_policies WHERE tablename = 'users';
```

应该看到允许插入的策略。

---

## 成功标志

修复成功后，你应该看到：

1. **控制台输出**（无错误）
   ```
   ✓ Compiled in 234ms
   ```

2. **注册表单提交**
   - 显示绿色Toast："注册成功！正在跳转..."
   - 自动跳转到 `/chat` 页面

3. **数据库中有新用户**
   ```sql
   SELECT email, nickname, created_at FROM users ORDER BY created_at DESC LIMIT 1;
   ```

---

## 快速修复命令（供参考）

```bash
# 1. 停止服务器
Ctrl+C

# 2. 编辑 .env.local
# 替换为正确的密钥

# 3. 清除缓存（可选）
rm -rf .next

# 4. 重启服务器
npm run dev

# 5. 测试注册
# 访问 http://localhost:3000/auth/register
```

---

**下一步**：获取正确的Supabase密钥并更新 `.env.local` 文件！🔑
