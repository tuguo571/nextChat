# 修复 NOT_MEMBER 错误

## 问题描述

当用户访问聊天室页面时，会遇到以下错误：

```
❌ 加入房间失败: {code: 'NOT_MEMBER', message: '您不是该房间的成员'}
```

## 根本原因

这是一个**时序竞态问题**：

1. 用户访问聊天室页面
2. 检测到用户不是成员，调用 `joinChatRoom` API（异步操作）
3. 几乎同时，WebSocket 连接完成并尝试加入 Socket 房间
4. 服务器端验证成员身份时，数据库中的成员记录尚未生效
5. 返回 `NOT_MEMBER` 错误

**时间线**：
```
T0: 页面加载，检测到不是成员
T1: 调用 joinChatRoom() API (异步)
T2: WebSocket 连接完成
T3: 尝试 socket.joinRoom() → 服务器验证失败 ❌
T4: 数据库成员记录生效（太晚了）
```

## 修复方案

### 1. 优化前端加入流程 (`src/app/chat/[roomId]/page.tsx`)

**改动**：
- 添加轮询机制验证成员身份（最多5次，每次间隔200ms）
- 只有在确认成员身份后才允许 WebSocket 加入房间
- 在 `useEffect` 依赖项中添加 `membership.isMember`，确保状态更新后触发重新连接

**关键代码**：
```typescript
// 轮询验证成员身份
let recheckAttempts = 0
let recheckMember = false
let recheckRole = null

while (recheckAttempts < 5 && !recheckMember) {
  await new Promise(resolve => setTimeout(resolve, 200))
  const result = await checkRoomMembership(params.roomId)
  recheckMember = result.isMember
  recheckRole = result.role
  recheckAttempts++
}

// 只有成员才能加入 Socket 房间
if (!membership.isMember) {
  console.log('⏳ 等待成员身份验证完成...')
  return
}
```

### 2. 优化 API 幂等性 (`src/lib/chatRoomApi.ts`)

**改动**：
- `joinChatRoom` 函数改为幂等操作
- 如果用户已经是成员，直接返回成功而不是错误
- 这样可以避免重复加入导致的错误

**关键代码**：
```typescript
if (existing) {
  console.log('✅ 用户已经是该聊天室的成员')
  return { data: existing, error: null }  // 返回成功而不是错误
}
```

## 修复后的流程

**正确的时间线**：
```
T0: 页面加载，检测到不是成员
T1: 调用 joinChatRoom() API
T2: 轮询验证成员身份（最多1秒）
T3: 确认数据库记录已生效 ✅
T4: 设置 membership.isMember = true
T5: useEffect 触发，WebSocket 尝试加入房间
T6: 服务器验证成功 ✅
T7: 成功加入聊天室
```

## 测试步骤

### 场景 1：首次访问聊天室

1. 登录系统
2. 访问一个你尚未加入的聊天室 URL：`/chat/[roomId]`
3. 观察控制台日志：
   - ✅ 应该看到"已自动加入聊天室"
   - ✅ 应该看到"成员身份验证成功"
   - ✅ 应该看到"加入房间成功"
   - ❌ 不应该看到"NOT_MEMBER"错误

### 场景 2：刷新页面

1. 在已加入的聊天室页面刷新
2. 观察控制台日志：
   - ✅ 应该直接加入，无需等待
   - ✅ 不应该看到任何错误

### 场景 3：快速切换聊天室

1. 在聊天室 A 和聊天室 B 之间快速切换
2. 观察控制台日志：
   - ✅ 每次切换都应该成功
   - ✅ 不应该看到"NOT_MEMBER"错误

## 技术细节

### 为什么选择轮询而不是固定延迟？

1. **更可靠**：固定延迟可能太短（数据库未同步）或太长（浪费时间）
2. **更快速**：一旦数据库同步完成就立即继续，不浪费时间
3. **更健壮**：有重试机制，可以处理网络延迟等问题

### 为什么最多5次尝试？

- 每次间隔200ms，5次共1秒
- 正常情况下，数据库记录在200-400ms内生效
- 1秒足够处理大多数网络延迟情况
- 避免无限等待

### WebSocket 事件监听的依赖项

```typescript
useEffect(() => {
  // 只有当 Socket 连接且用户是成员时才加入房间
  if (!socket.isConnected || !membership.isMember) return
  
  // ... 加入房间逻辑
}, [socket.isConnected, socket.isAuthenticated, params.roomId, membership.isMember])
```

添加 `membership.isMember` 依赖确保：
- 成员状态变化时重新执行 effect
- 避免在成员身份未确认时尝试加入房间

## 相关文件

- `src/app/chat/[roomId]/page.tsx` - 聊天室页面组件
- `src/lib/chatRoomApi.ts` - 聊天室 API
- `src/hooks/useSocket.ts` - Socket.IO Hook
- `socketHandlers.js` - 服务器端事件处理器

## 预期效果

✅ 用户访问任何聊天室时，都能顺利加入，不再出现 NOT_MEMBER 错误
✅ 控制台日志清晰显示加入流程的每个步骤
✅ 用户体验流畅，无需手动刷新页面
