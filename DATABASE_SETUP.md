# 数据库初始化指南

## 前提条件

- ✅ Supabase项目已创建
- ✅ 项目URL和API密钥已配置在 `.env.local`
- ✅ 可以访问Supabase控制台

## 初始化步骤

### 步骤1：打开Supabase SQL编辑器

1. 访问你的Supabase项目控制台：
   - URL: `http://sbp-ikairbucachjzcos.supabase.opentrust.net/`
   - 或登录 https://supabase.com/ 后选择项目

2. 在左侧导航栏找到 **SQL Editor**（SQL编辑器）

3. 点击 **New Query**（新建查询）

### 步骤2：执行数据库架构脚本

1. 打开项目根目录的 `database/schema.sql` 文件

2. 复制完整的SQL脚本内容（287行）

3. 粘贴到Supabase SQL编辑器中

4. 点击右下角的 **Run**（运行）按钮

5. 等待执行完成（通常需要5-10秒）

### 步骤3：验证表创建

执行成功后，你应该看到以下9张表被创建：

```sql
-- 验证表创建
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

预期结果：
- ✅ `users` - 用户表
- ✅ `chat_rooms` - 聊天室表
- ✅ `room_members` - 聊天室成员表
- ✅ `messages` - 消息表
- ✅ `message_reactions` - 消息反应表
- ✅ `file_metadata` - 文件元数据表
- ✅ `notifications` - 通知表
- ✅ `user_sessions` - 用户会话表
- ✅ `operation_logs` - 操作日志表

### 步骤4：验证RLS策略

在SQL编辑器中运行：

```sql
-- 查看已启用RLS的表
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
```

所有9张表都应该启用了RLS（Row Level Security）。

### 步骤5：验证触发器

运行以下查询检查自动更新触发器：

```sql
-- 查看触发器
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

应该看到多个 `update_updated_at_trigger` 触发器。

### 步骤6：验证函数

检查自定义函数是否创建成功：

```sql
-- 查看函数
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

预期函数：
- ✅ `update_updated_at` - 自动更新时间戳
- ✅ `cleanup_expired_sessions` - 清理过期会话
- ✅ `cleanup_expired_notifications` - 清理过期通知

## 常见问题排查

### 问题1：权限不足

**症状**：
```
permission denied for schema public
```

**解决方案**：
- 确保你使用的是项目的 **Service Role Key**（服务角色密钥）
- 在Supabase控制台的 Settings > API 中可以找到
- 或使用Supabase控制台的SQL编辑器（已自动授权）

### 问题2：表已存在

**症状**：
```
relation "users" already exists
```

**解决方案**：
如果需要重新初始化，先删除现有表：

```sql
-- ⚠️ 警告：这会删除所有数据！
DROP TABLE IF EXISTS operation_logs CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS file_metadata CASCADE;
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS room_members CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除函数
DROP FUNCTION IF EXISTS update_updated_at CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_notifications CASCADE;
```

然后重新执行 `schema.sql` 脚本。

### 问题3：RLS阻止插入

**症状**：
注册或插入数据时收到 `row-level security policy` 错误

**解决方案**：
检查RLS策略是否正确创建。在SQL编辑器运行：

```sql
-- 查看users表的策略
SELECT * FROM pg_policies WHERE tablename = 'users';
```

如果策略缺失，重新执行schema.sql中的策略部分。

## 后续配置

### 1. 配置认证设置

在Supabase控制台 > **Authentication** > **Settings**：

- ✅ 启用Email Provider
- ✅ 配置Email Templates（可选）
- ✅ 设置Redirect URLs：
  - `http://localhost:3000/auth/callback`
  - `https://your-production-domain.com/auth/callback`

### 2. 配置存储桶（用于文件上传）

在Supabase控制台 > **Storage**：

1. 创建新存储桶：`chat-files`
2. 设置为 **Private**（私有）
3. 配置访问策略：

```sql
-- 允许认证用户上传文件
CREATE POLICY "Users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files');

-- 允许用户访问自己上传的文件
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-files' AND auth.uid()::text = owner);

-- 允许用户删除自己的文件
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-files' AND auth.uid()::text = owner);
```

### 3. 配置实时订阅

在Supabase控制台 > **Database** > **Replication**：

启用实时复制的表：
- ✅ `messages` - 实时接收新消息
- ✅ `room_members` - 监听成员变化
- ✅ `notifications` - 实时通知推送
- ✅ `message_reactions` - 实时反应更新

## 测试数据库

### 测试用户创建

运行以下SQL测试用户表：

```sql
-- 插入测试用户（仅用于测试RLS）
INSERT INTO users (id, email, nickname, signature)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  '测试用户',
  '这是我的个性签名'
);

-- 查询用户
SELECT id, email, nickname, created_at FROM users;
```

**注意**：实际用户应该通过应用的注册功能创建，而不是直接插入SQL。

### 测试聊天室创建

```sql
-- 创建测试聊天室
INSERT INTO chat_rooms (name, description, creator_id)
SELECT 
  '测试聊天室',
  '这是一个测试聊天室',
  id
FROM users
LIMIT 1;

-- 查询聊天室
SELECT id, name, description, created_at FROM chat_rooms;
```

## 数据库维护

### 定期清理过期数据

设置定时任务（通过Supabase Edge Functions或外部Cron）：

```sql
-- 清理过期会话（每小时执行）
SELECT cleanup_expired_sessions();

-- 清理过期通知（每天执行）
SELECT cleanup_expired_notifications();
```

### 监控数据库大小

```sql
-- 查看表占用空间
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 备份策略

Supabase自动提供：
- ✅ **每日自动备份**（Pro计划及以上）
- ✅ **时间点恢复**（Point-in-time Recovery）
- ✅ **手动备份下载**（Settings > Database > Backups）

建议：
- 在重大更新前手动创建备份
- 定期导出重要数据到本地
- 测试恢复流程

## 完成确认

执行完以上步骤后，确认：

- [ ] 9张表全部创建成功
- [ ] RLS策略已启用
- [ ] 触发器工作正常
- [ ] 清理函数可调用
- [ ] Authentication已配置
- [ ] Storage存储桶已创建
- [ ] Realtime复制已启用

现在你可以启动开发服务器并测试完整的用户认证流程了！🎉

---

**下一步**：返回项目根目录运行 `npm run dev` 启动开发服务器
