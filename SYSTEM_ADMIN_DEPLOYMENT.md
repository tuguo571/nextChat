# 系统管理员功能部署指南

## 概述

本指南介绍如何为聊天系统添加**系统级管理员**功能。系统管理员将拥有以下特权：

✅ 访问所有聊天室（无需加入）
✅ 查看所有聊天室的消息
✅ 在任何聊天室发送消息
✅ 管理所有聊天室和成员

---

## 部署步骤

### 第 1 步：执行数据库迁移

在 Supabase SQL Editor 中执行以下脚本：

```sql
-- 添加系统级管理员字段
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_is_admin 
ON public.users(is_admin) WHERE is_admin = TRUE;

-- 添加注释
COMMENT ON COLUMN public.users.is_admin 
IS '系统级管理员标识，拥有所有聊天室的访问权限';
```

或者直接执行提供的脚本文件：
```bash
# 在 Supabase Dashboard 中运行
database/add_system_admin.sql
```

### 第 2 步：设置管理员用户

**方法 1：通过邮箱设置**（推荐）

```sql
UPDATE public.users 
SET is_admin = TRUE 
WHERE email = 'your-admin-email@example.com';
```

**方法 2：通过用户 ID 设置**

```sql
UPDATE public.users 
SET is_admin = TRUE 
WHERE id = 'your-user-uuid-here';
```

**方法 3：查询当前用户 ID 后设置**

```sql
-- 1. 先查询您的用户 ID
SELECT id, email, nickname FROM public.users WHERE email = 'your-email@example.com';

-- 2. 使用查询到的 ID 设置管理员
UPDATE public.users SET is_admin = TRUE WHERE id = '返回的ID';
```

### 第 3 步：验证设置

```sql
-- 查询所有管理员
SELECT id, email, nickname, is_admin, created_at 
FROM public.users 
WHERE is_admin = TRUE;
```

### 第 4 步：重启开发服务器

```powershell
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
npm run dev
```

---

## 代码修改说明

已完成以下代码修改：

### 1. 数据库 Schema (`database/add_system_admin.sql`)
- ✅ 添加 `users.is_admin` 字段
- ✅ 创建索引优化查询性能

### 2. 类型定义 (`src/types/index.ts`)
```typescript
export interface User {
  // ...其他字段
  is_admin?: boolean  // 新增
}
```

### 3. 服务器端验证逻辑 (`socketHandlers.js`)
```javascript
// verifyRoomMembership 函数现在支持系统管理员
async function verifyRoomMembership(userId, roomId) {
  // 1. 首先检查是否是系统管理员
  // 2. 管理员直接返回 isMember: true
  // 3. 否则检查 room_members 表
}
```

### 4. 前端 API (`src/lib/chatRoomApi.ts`)
```typescript
// checkRoomMembership 函数添加管理员检查
export async function checkRoomMembership(roomId: string) {
  // 1. 查询用户的 is_admin 字段
  // 2. 管理员返回 isMember: true, role: 'admin'
  // 3. 否则检查 room_members 表
}
```

### 5. 聊天室页面 (`src/app/chat/[roomId]/page.tsx`)
```typescript
// 加载房间数据时识别系统管理员
const { isMember, role, isSystemAdmin } = await checkRoomMembership(roomId)

if (isSystemAdmin) {
  // 管理员无需加入流程，直接访问
  setMembership({ isMember: true, role: 'admin' })
}
```

---

## 工作原理

### 权限检查流程

```
用户访问聊天室
    ↓
检查 users.is_admin 字段
    ↓
是 ───→ 直接授予访问权限 (role: admin)
    ↓
否 ───→ 检查 room_members 表
    ↓
是成员 ───→ 授予访问权限 (role: member/admin)
    ↓
否 ───→ 尝试自动加入或拒绝访问
```

### 日志标识

系统管理员访问时，控制台会显示特殊标识：

```
🔑 系统管理员访问，拥有所有权限
✅ 系统管理员 user-id 访问房间 room-id
🔔 系统管理员 email@example.com 加入房间 room-id
```

---

## 测试步骤

### 测试 1：系统管理员访问

1. 使用设置为管理员的账号登录
2. 访问任意聊天室（无需是成员）
3. 观察控制台日志：
   ```
   🔑 系统管理员访问，拥有所有权限
   ✅ 系统管理员 xxx 访问房间 xxx
   ```
4. 验证功能：
   - ✅ 可以查看消息
   - ✅ 可以发送消息
   - ✅ 不会显示"NOT_MEMBER"错误

### 测试 2：普通用户访问

1. 使用普通用户账号登录
2. 访问已加入的聊天室 → 应正常访问
3. 访问未加入的聊天室 → 应自动加入（如果允许）

### 测试 3：管理员与成员的区别

```sql
-- 查看某个房间的成员列表
SELECT * FROM room_members WHERE room_id = 'your-room-id';

-- 系统管理员不会出现在这个列表中
-- 但仍然可以访问该房间
```

---

## 安全考虑

### 1. 权限隔离

- ✅ 系统管理员检查在服务器端执行
- ✅ 使用 `supabaseAdmin`（SERVICE_ROLE_KEY）绕过 RLS
- ✅ 前端无法伪造管理员身份

### 2. 数据库级别保护

建议添加 RLS 策略保护 `is_admin` 字段：

```sql
-- 创建策略：只有管理员可以修改 is_admin 字段
CREATE POLICY "只有管理员可以设置管理员权限"
ON public.users
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE is_admin = TRUE
  )
);
```

### 3. 审计日志

建议记录系统管理员的操作：

```sql
-- 创建审计日志表（可选）
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 常见问题

### Q1: 为什么管理员还是看到 NOT_MEMBER 错误？

**A1**: 确保已执行以下步骤：
1. ✅ 数据库中添加了 `is_admin` 字段
2. ✅ 为目标用户设置了 `is_admin = TRUE`
3. ✅ 重启了开发服务器
4. ✅ 清除了浏览器缓存或硬刷新（Ctrl+Shift+R）

验证方法：
```sql
SELECT id, email, is_admin FROM public.users WHERE email = 'your-email@example.com';
```

### Q2: 如何撤销管理员权限？

**A2**: 
```sql
UPDATE public.users 
SET is_admin = FALSE 
WHERE email = 'user@example.com';
```

### Q3: 可以有多个系统管理员吗？

**A3**: 可以！为多个用户设置 `is_admin = TRUE` 即可。

### Q4: 管理员会出现在房间成员列表中吗？

**A4**: 不会。系统管理员访问房间时不会在 `room_members` 表中创建记录。
如果希望管理员出现在成员列表中，可以手动加入聊天室。

---

## 回滚步骤

如果需要移除此功能：

```sql
-- 删除字段
ALTER TABLE public.users DROP COLUMN IF EXISTS is_admin;

-- 删除索引
DROP INDEX IF EXISTS idx_users_is_admin;
```

然后回滚代码更改（使用 git）：
```bash
git checkout HEAD -- src/types/index.ts
git checkout HEAD -- src/lib/chatRoomApi.ts
git checkout HEAD -- src/app/chat/[roomId]/page.tsx
git checkout HEAD -- socketHandlers.js
```

---

## 后续优化建议

### 1. 管理员面板

创建专门的管理员界面：
- 查看所有聊天室
- 查看系统统计
- 管理用户和权限
- 审核举报内容

### 2. 细粒度权限

扩展权限系统：
```sql
CREATE TYPE admin_permission AS ENUM (
  'view_all_rooms',
  'manage_users',
  'delete_messages',
  'ban_users'
);

CREATE TABLE admin_permissions (
  admin_id UUID REFERENCES users(id),
  permission admin_permission,
  PRIMARY KEY (admin_id, permission)
);
```

### 3. 操作日志

记录管理员的所有操作，便于审计和追踪。

---

## 联系与支持

如有问题，请检查：
1. 数据库迁移是否成功
2. 用户 `is_admin` 字段是否正确设置
3. 服务器是否已重启
4. 浏览器缓存是否已清除

祝部署顺利！🎉
