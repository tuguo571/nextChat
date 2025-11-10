# 修复用户记录缺失问题

## 问题描述

**错误信息**：
```
加载用户资料失败: {code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned'}
```

**根本原因**：
用户在 `auth.users` 表中存在，但在 `public.users` 表中没有对应记录。

这可能发生在：
1. 直接在 Supabase Dashboard 创建用户
2. 注册时 `public.users` 插入失败
3. RLS 策略阻止了用户记录创建

---

## 解决方案

### 方案 1：应用层自动修复（已实施）✅

**修改内容**：`src/components/AuthProvider.tsx`

`loadProfile` 函数现在会：
1. 尝试加载用户记录
2. 如果不存在（PGRST116错误），自动创建
3. 使用 auth 用户的元数据填充信息

**优点**：
- 自动修复，无需手动干预
- 对用户透明

**测试**：
1. 刷新浏览器（Ctrl+Shift+R）
2. 应该自动创建缺失的用户记录
3. 查看控制台，应显示"用户记录不存在，尝试创建..."

---

### 方案 2：数据库触发器（推荐长期方案）

在 Supabase SQL 编辑器执行：

```sql
-- 执行 database/create_user_sync_trigger.sql
```

这个触发器会：
- 监听 `auth.users` 的 INSERT 事件
- 自动在 `public.users` 中创建对应记录
- 从用户元数据提取昵称

**执行步骤**：
1. 打开 Supabase SQL 编辑器
2. 复制 `database/create_user_sync_trigger.sql` 内容
3. 点击 Run
4. 验证触发器创建成功

---

### 方案 3：修复现有用户（一次性操作）

如果有多个用户缺失记录，执行：

```sql
-- 执行 database/fix_missing_users.sql
```

这个脚本会：
1. 查找所有缺失的用户
2. 自动创建对应的 `public.users` 记录
3. 使用合理的默认值（昵称从邮箱提取）

**执行步骤**：
1. 打开 Supabase SQL 编辑器
2. 复制 `database/fix_missing_users.sql` 内容
3. 逐段执行（先查看，再插入，最后验证）

---

## 立即修复步骤

### 快速修复（推荐）

1. **刷新浏览器**
   ```
   按 Ctrl+Shift+R 强制刷新
   ```

2. **重新登录**
   - 应该自动创建用户记录
   - 不再看到错误

3. **验证修复**
   在 Supabase SQL 编辑器：
   ```sql
   SELECT * FROM public.users ORDER BY created_at DESC;
   ```
   应该看到你的用户记录

---

### 完整修复（推荐生产环境）

1. **执行触发器脚本**
   ```sql
   -- 在 Supabase SQL 编辑器中执行
   -- database/create_user_sync_trigger.sql
   ```

2. **修复现有用户**
   ```sql
   -- 在 Supabase SQL 编辑器中执行
   -- database/fix_missing_users.sql
   ```

3. **重启开发服务器**
   ```bash
   # 停止服务器（Ctrl+C）
   npm run dev
   ```

4. **测试注册流程**
   - 注册新用户
   - 验证自动创建 public.users 记录

---

## 验证修复

### 1. 检查用户记录
```sql
-- 查看所有用户
SELECT 
  u.id,
  u.email,
  u.nickname,
  u.created_at
FROM public.users u
ORDER BY u.created_at DESC;
```

### 2. 检查 auth 和 public 用户同步
```sql
-- 应该显示 missing = 0
SELECT 
  COUNT(*) as auth_users,
  (SELECT COUNT(*) FROM public.users) as public_users,
  COUNT(*) - (SELECT COUNT(*) FROM public.users) as missing
FROM auth.users;
```

### 3. 检查触发器
```sql
-- 应该看到 on_auth_user_created 触发器
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

---

## 预防措施

### 1. 使用触发器（推荐）✅
确保执行 `create_user_sync_trigger.sql`

### 2. 注册流程检查
在 `signUp` 函数中添加错误处理：
```typescript
if (profileError) {
  console.error('创建用户资料失败:', profileError)
  // 可以选择回滚 auth.users
  await supabase.auth.admin.deleteUser(authData.user.id)
  throw new Error('注册失败，请重试')
}
```

### 3. RLS 策略检查
确保 users 表的 RLS 策略允许插入：
```sql
-- 查看 users 表的策略
SELECT * FROM pg_policies WHERE tablename = 'users';

-- 应该有允许插入的策略
```

---

## 常见问题

### Q1: 刷新后还是报错
**A**: 
1. 检查浏览器控制台，看是否有其他错误
2. 清除浏览器缓存（Ctrl+Shift+Delete）
3. 退出登录，重新登录
4. 手动执行修复脚本

### Q2: 触发器没有生效
**A**:
1. 检查是否有权限访问 `auth` schema
2. 使用 Service Role Key 而不是 Anon Key
3. 在 Supabase Dashboard 的 SQL 编辑器中执行

### Q3: 注册新用户还是报错
**A**:
1. 检查 RLS 策略是否阻止插入
2. 查看 Supabase Logs（Dashboard > Logs）
3. 检查 `signUp` 函数的错误处理

### Q4: 如何批量修复所有用户
**A**:
直接执行：
```sql
-- 一次性修复所有缺失的用户
INSERT INTO public.users (id, email, nickname, password_hash)
SELECT 
  au.id,
  au.email,
  split_part(au.email, '@', 1) as nickname,
  'managed_by_supabase_auth'
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

---

## 总结

✅ **应用层已自动修复**：刷新浏览器即可  
🔧 **推荐执行触发器**：防止未来问题  
📝 **可选执行修复脚本**：修复历史数据  

现在刷新浏览器，问题应该自动解决！🎉
