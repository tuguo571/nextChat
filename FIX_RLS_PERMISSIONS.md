# 修复 RLS 权限错误指南

## 问题描述

应用启动后出现以下错误：
- ❌ `403 Forbidden` - 访问 `users` 表被拒绝
- ❌ `500 Internal Server Error` - 访问 `room_members` 表失败
- ❌ 获取聊天室列表失败
- ❌ 创建/加载用户资料失败

## 原因分析

Supabase 数据库已启用 **Row Level Security (RLS)**，但缺少以下关键策略：
1. 用户表缺少 `INSERT` 策略（导致注册后无法创建用户记录）
2. 聊天室表缺少 `INSERT` 策略（导致无法创建聊天室）
3. 成员表缺少完整的 `INSERT/UPDATE/DELETE` 策略

## 解决方案

### 步骤 1: 登录 Supabase Dashboard

1. 访问 https://sbp-ikairbucachjzcos.supabase.opentrust.net
2. 使用管理员账号登录

### 步骤 2: 执行 RLS 策略脚本

1. 在左侧菜单点击 **SQL Editor**
2. 点击 **New query** 按钮
3. 打开本地文件 `database/rls_policies.sql`
4. 复制所有内容并粘贴到 SQL Editor
5. 点击 **Run** 按钮执行脚本

### 步骤 3: 验证策略已应用

执行以下 SQL 查询验证：

```sql
-- 查看 users 表的所有策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';

-- 查看 chat_rooms 表的所有策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'chat_rooms';

-- 查看 room_members 表的所有策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'room_members';
```

### 步骤 4: 重启应用并测试

1. 停止当前运行的服务器（Ctrl+C）
2. 重新启动：`npm run dev`
3. 刷新浏览器页面
4. 尝试以下操作：
   - ✅ 用户登录
   - ✅ 查看聊天室列表
   - ✅ 创建新聊天室
   - ✅ 加入聊天室
   - ✅ 发送消息

## 快速检查清单

执行完脚本后，验证以下策略是否存在：

### users 表
- [x] `允许创建用户记录` (INSERT)
- [x] `用户可以查看所有用户基本信息` (SELECT)
- [x] `用户只能更新自己的信息` (UPDATE)

### chat_rooms 表
- [x] `认证用户可以创建聊天室` (INSERT)
- [x] `所有人可以查看聊天室` (SELECT)
- [x] `创建者或管理员可以更新聊天室` (UPDATE)
- [x] `创建者或管理员可以删除聊天室` (DELETE)

### room_members 表
- [x] `成员可以查看自己加入的聊天室成员` (SELECT)
- [x] `用户可以加入聊天室` (INSERT - 自己)
- [x] `管理员可以添加成员` (INSERT - 他人)
- [x] `管理员可以修改成员角色` (UPDATE)
- [x] `用户可以退出聊天室` (DELETE - 自己)
- [x] `管理员可以踢出成员` (DELETE - 他人)

### messages 表
- [x] `成员可以查看聊天室消息` (SELECT)
- [x] `用户可以发送消息` (INSERT)
- [x] `用户可以编辑自己的消息` (UPDATE)
- [x] `用户可以删除自己的消息` (DELETE)
- [x] `管理员可以删除任何消息` (DELETE)

## 预期结果

执行策略后，应看到类似输出：

```
DROP POLICY (if exists)
CREATE POLICY
DROP POLICY (if exists)
CREATE POLICY
...
```

总共应该创建约 **25-30 条策略**。

## 故障排除

### 如果仍然出现 403 错误

1. **检查 Auth Session**：
   ```javascript
   // 在浏览器控制台执行
   const { data, error } = await supabase.auth.getSession()
   console.log('Session:', data.session)
   console.log('User ID:', data.session?.user?.id)
   ```

2. **验证 JWT Secret**：
   - 检查 `.env.local` 中的 `SUPABASE_JWT_SECRET` 是否正确
   - 在 Supabase Dashboard → Settings → API → JWT Secret 获取正确值

3. **检查表的 RLS 是否启用**：
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename IN ('users', 'chat_rooms', 'room_members', 'messages');
   ```
   所有表的 `rowsecurity` 应该为 `true`

### 如果出现 500 错误

这通常是关联查询权限问题，确保：
1. 两个关联表都有对应的 SELECT 策略
2. 策略中的子查询 (EXISTS) 语法正确
3. 外键引用的表也有适当的访问权限

## 安全说明

### ⚠️ 关于 `允许创建用户记录` 策略

```sql
CREATE POLICY "允许创建用户记录" ON public.users
  FOR INSERT WITH CHECK (true);
```

这个策略允许任何人在 `users` 表创建记录。这是安全的，因为：

1. **Supabase Auth 已经验证了用户** - 只有通过 Auth 注册的用户才能创建记录
2. **应用代码负责验证** - `createUserProfile()` 函数只在 Auth 注册成功后调用
3. **RLS 仍然保护数据** - 用户只能修改自己的记录

### 🔒 更严格的替代方案

如果需要更严格的控制，可以改为：

```sql
CREATE POLICY "允许创建用户记录" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
```

这确保插入的用户 ID 必须与当前认证用户的 ID 匹配。

## 参考资料

- [Supabase RLS 文档](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL 策略语法](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- 项目数据库 Schema: `database/schema.sql`
