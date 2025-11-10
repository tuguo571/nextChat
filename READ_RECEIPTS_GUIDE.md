# 已读回执功能使用指南

## 功能概述

已读回执功能允许用户查看自己发送的消息被哪些人已读，提升聊天室的互动透明度。

## 数据库设置

### 1. 创建 message_reads 表

执行 SQL 脚本创建已读回执表：

```bash
# 在 Supabase SQL Editor 中执行
psql -d your_database -f database/message_reads.sql
```

或者在 Supabase Dashboard 的 SQL Editor 中直接运行 `database/message_reads.sql` 文件内容。

### 2. 表结构

```sql
message_reads
  - id: UUID (主键)
  - message_id: UUID (外键 -> messages.id)
  - user_id: UUID (外键 -> users.id)
  - read_at: TIMESTAMPTZ (已读时间)
  - UNIQUE(message_id, user_id) -- 防止重复记录
```

### 3. RLS 策略

- ✅ 用户可以查看自己所在房间的消息已读状态
- ✅ 用户可以标记自己已读的消息
- ✅ 用户可以更新自己的已读记录

## 功能特性

### 自动标记已读

1. **进入房间时**：自动标记房间内所有未读消息为已读（排除自己发送的）
2. **实时标记**：加载新消息时自动标记为已读
3. **批量处理**：使用批量API提升性能

### 已读状态显示

#### 发送者视角（自己的消息）

- 消息下方显示 **"📖 已读 N人"** 按钮
- 点击按钮显示已读用户列表弹窗
- 弹窗显示：
  - 用户头像（首字母）
  - 用户昵称
  - 最多显示所有已读用户

#### 接收者视角（他人的消息）

- 自动标记为已读，无需手动操作
- 不显示已读回执按钮

### 实时更新

- 其他用户已读消息后，发送者实时收到已读回执通知
- 已读人数自动更新
- 使用 Socket.IO 实现实时推送

## API 接口

### 前端 API (chatRoomApi.ts)

#### 1. 标记单条消息已读

```typescript
import { markMessageAsRead } from '@/lib/chatRoomApi'

const { error } = await markMessageAsRead(messageId)
```

#### 2. 批量标记消息已读

```typescript
import { markMessagesAsRead } from '@/lib/chatRoomApi'

const messageIds = ['id1', 'id2', 'id3']
const { error } = await markMessagesAsRead(messageIds)
```

#### 3. 获取消息已读用户列表

```typescript
import { getMessageReads } from '@/lib/chatRoomApi'

const { data, error } = await getMessageReads(messageId)
// data: [{ user_id, read_at, users: { id, nickname, avatar_url } }]
```

#### 4. 获取多条消息的已读统计

```typescript
import { getMessagesReadCount } from '@/lib/chatRoomApi'

const { data, error } = await getMessagesReadCount(messageIds)
// data: { messageId1: [userId1, userId2], messageId2: [...] }
```

### Socket.IO 事件

#### 1. 标记消息已读（客户端发送）

```typescript
socket.markMessageRead(messageId, roomId, (error, response) => {
  if (error) {
    console.error('标记失败:', error)
  }
})
```

#### 2. 批量标记消息已读（客户端发送）

```typescript
socket.markMessagesRead(messageIds, roomId, (error, response) => {
  if (error) {
    console.error('批量标记失败:', error)
  }
})
```

#### 3. 接收已读回执（客户端监听）

```typescript
socket.on('message-read', (data) => {
  // data: { messageId, userId, readAt }
  console.log(`用户 ${data.userId} 已读消息 ${data.messageId}`)
})
```

## 性能优化

### 1. 批量操作

- 使用 `markMessagesAsRead` 批量标记，减少数据库请求
- 进入房间时一次性标记所有未读消息

### 2. 防重复

- 数据库层面：使用 UNIQUE 约束防止重复记录
- 应用层面：使用 `upsert` 操作自动处理重复

### 3. 索引优化

```sql
-- 已创建的索引
idx_message_reads_message -- 按消息ID查询
idx_message_reads_user    -- 按用户ID查询
idx_message_reads_read_at -- 按时间排序
```

### 4. 前端优化

- 使用 React state 缓存已读状态
- 实时更新避免重复查询
- 按需加载已读用户列表（点击时才显示）

## 用户界面

### 已读回执按钮样式

```
[消息气泡]
[👍 3] [❤️ 2]  <- 反应
📖 已读 5人      <- 已读回执（仅自己的消息显示）
10:30           <- 时间
```

### 已读用户列表弹窗

```
┌─────────────────┐
│ 已读用户        │
├─────────────────┤
│ 🔵 张三         │
│ 🟣 李四         │
│ 🔴 王五         │
└─────────────────┘
```

## 注意事项

1. **隐私保护**：只有消息发送者能看到已读回执
2. **自动标记**：接收者无需手动操作，自动标记已读
3. **排除自己**：不会标记自己发送的消息为已读
4. **实时同步**：所有已读状态实时更新
5. **性能考虑**：大量消息时使用批量操作

## 常见问题

### Q1: 为什么我的消息没有显示已读回执？

A: 已读回执仅显示在**自己发送的消息**上。查看他人消息时不会显示。

### Q2: 如何查看谁已读了我的消息？

A: 点击消息下方的 **"📖 已读 N人"** 按钮，会弹出已读用户列表。

### Q3: 已读状态会自动更新吗？

A: 是的。当其他用户阅读您的消息后，已读人数会实时更新。

### Q4: 进入房间后会自动标记所有消息为已读吗？

A: 是的。系统会自动标记房间内所有未读消息（排除自己发送的）。

### Q5: 已读回执会影响性能吗？

A: 不会。我们使用了批量操作、数据库索引和前端缓存等优化手段。

## 技术架构

### 数据流

```
用户进入房间
    ↓
加载历史消息 + 已读状态
    ↓
批量标记未读消息为已读
    ↓
Socket.IO 广播已读回执
    ↓
其他用户实时收到更新
```

### 组件结构

```
ChatRoomPage (页面)
    ├── MessageList (消息列表)
    │   ├── 已读回执按钮
    │   └── 已读用户列表弹窗
    └── useSocket (Socket.IO Hook)
        ├── markMessageRead
        └── markMessagesRead
```

## 下一步优化

1. ✅ 已读回执基础功能
2. ⏳ 已读时间显示
3. ⏳ 未读/已读消息分组
4. ⏳ 已读率统计
5. ⏳ 消息撤回时清除已读记录

---

**功能状态**: ✅ 已完成并可用
**版本**: 1.0.0
**最后更新**: 2025年11月10日
