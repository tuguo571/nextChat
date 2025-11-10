# 置顶消息和未读消息错误修复指南

## 问题概述

修复了以下两个关键错误：

1. **置顶消息查询失败 (400 Bad Request)**
   - 错误信息: `Could not find a relationship between 'messages' and 'pinned_by'`
   - 原因: Supabase 查询中使用了不正确的外键关系别名

2. **未读消息标记失败 (404 Not Found)**
   - 错误信息: `POST /rest/v1/unread_messages` 返回 404
   - 原因: `unread_messages` 表缺少 RLS (Row Level Security) 策略

## 修复步骤

### 步骤 1: 执行数据库 RLS 策略修复

在 Supabase SQL 编辑器中执行以下 SQL 文件：

```bash
database/fix_unread_messages_rls.sql
```

该脚本会：
- 为 `unread_messages` 表启用 RLS
- 创建必要的安全策略（查看、插入、更新、删除）
- 添加表和字段注释

### 步骤 2: 验证数据库表结构

确认以下表已正确创建：

#### unread_messages 表
```sql
-- 检查表是否存在
SELECT * FROM public.unread_messages LIMIT 1;

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'unread_messages';

-- 检查策略
SELECT * FROM pg_policies WHERE tablename = 'unread_messages';
```

#### messages 表的置顶字段
```sql
-- 确认置顶字段存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('is_pinned', 'pinned_at', 'pinned_by');
```

### 步骤 3: 代码修改说明

#### 文件: `src/lib/chatRoomApi.ts`

**修改 1: getPinnedMessages 函数**
- **修改原因**: 避免 Supabase 查询中的外键关系解析错误
- **修改方式**: 
  - 使用明确的外键约束名称 `users!messages_user_id_fkey`
  - 将 `pinned_by` 用户信息改为独立查询并手动关联
  - 避免了复杂的嵌套关系查询

**优势**:
- 更加可靠，不依赖 Supabase 的自动关系推断
- 性能更好，可以按需加载置顶操作者信息
- 代码更易维护和调试

## 测试验证

### 1. 测试置顶消息功能

访问任意聊天室，执行以下操作：

```typescript
// 在浏览器控制台中测试
import { getPinnedMessages } from '@/lib/chatRoomApi';

// 替换为实际的房间ID
const roomId = '9363a110-1924-4a60-9c5e-dbe249978de8';
const result = await getPinnedMessages(roomId);
console.log('置顶消息:', result);
```

**预期结果**:
- 不再出现 400 错误
- 成功返回置顶消息列表
- 每条消息包含 `users` (发送者信息) 和 `pinned_by_user` (置顶操作者信息)

### 2. 测试未读消息标记

进入聊天室时，应该：

```typescript
// 标记房间为已读
import { markRoomAsRead } from '@/lib/chatRoomApi';

const roomId = '9363a110-1924-4a60-9c5e-dbe249978de8';
const result = await markRoomAsRead(roomId);
console.log('标记已读结果:', result);
```

**预期结果**:
- 不再出现 404 错误
- 成功标记房间为已读
- `unread_messages` 表中有对应记录被创建或更新

## 后续优化建议

### 1. 性能优化
考虑为 `pinned_by` 字段添加索引：
```sql
CREATE INDEX IF NOT EXISTS idx_messages_pinned_by 
ON public.messages(pinned_by) 
WHERE pinned_by IS NOT NULL;
```

### 2. 数据一致性
添加触发器自动维护 `unread_count`：
```sql
-- 当新消息到达时自动增加未读数
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.unread_messages
  SET unread_count = unread_count + 1
  WHERE room_id = NEW.room_id
  AND user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_count();
```

### 3. 错误处理增强
在前端添加更友好的错误提示：
```typescript
if (error) {
  if (error.message.includes('relationship')) {
    toast.error('数据库查询配置错误，请联系管理员');
  } else if (error.message.includes('404')) {
    toast.error('功能暂时不可用，请稍后重试');
  }
}
```

## 故障排查

### 如果仍然出现 404 错误：

1. **检查 RLS 策略是否生效**
   ```sql
   -- 验证当前用户权限
   SELECT * FROM public.unread_messages WHERE user_id = auth.uid();
   ```

2. **检查 API 权限设置**
   - 在 Supabase Dashboard > Authentication > Policies
   - 确认 `unread_messages` 表有正确的策略

3. **清除缓存**
   ```bash
   # 重启开发服务器
   npm run dev
   ```

### 如果仍然出现 400 错误：

1. **验证外键约束**
   ```sql
   SELECT
     tc.constraint_name,
     tc.table_name,
     kcu.column_name,
     ccu.table_name AS foreign_table_name,
     ccu.column_name AS foreign_column_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.table_name = 'messages'
   AND tc.constraint_type = 'FOREIGN KEY';
   ```

2. **使用简化查询**
   如果问题持续，可以进一步简化查询：
   ```typescript
   // 最简单的查询方式
   const { data } = await supabase
     .from('messages')
     .select('*')
     .eq('room_id', roomId)
     .eq('is_pinned', true);
   
   // 然后手动获取用户信息
   ```

## 相关文件

- `src/lib/chatRoomApi.ts` - API 函数修改
- `database/fix_unread_messages_rls.sql` - RLS 策略修复脚本
- `database/pinned_messages.sql` - 置顶消息表结构
- `database/schema.sql` - 完整数据库架构

## 总结

本次修复解决了两个核心问题：
1. ✅ 置顶消息查询的外键关系错误
2. ✅ 未读消息表的 RLS 策略缺失

这些修复确保了：
- 用户可以正常查看置顶消息
- 进入房间时可以正确标记消息为已读
- 数据访问符合安全策略要求
