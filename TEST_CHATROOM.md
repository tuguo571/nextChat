# 聊天室功能测试指南

## 修复内容

### 问题
数据库表 `chat_rooms` 中没有 `member_count` 字段，导致查询失败。

### 解决方案
修改 `src/lib/chatRoomApi.ts`：
- ✅ 从查询中移除 `member_count` 字段
- ✅ 动态计算每个聊天室的成员数量
- ✅ 通过子查询统计 `room_members` 表

---

## 测试步骤

### 1. 刷新页面
```
访问 http://localhost:3000/chat
按 Ctrl+Shift+R 强制刷新
```

### 2. 测试创建聊天室
```
1. 点击"创建聊天室"按钮
2. 输入名称：测试聊天室1
3. 输入描述：这是第一个测试聊天室
4. 点击"创建聊天室"
5. 应该看到绿色Toast："聊天室创建成功！"
6. 列表中应显示新创建的聊天室
7. 显示"管理员"徽章
8. 显示"👥 1 人"（只有你自己）
```

### 3. 测试搜索功能
```
1. 在搜索框输入"测试"
2. 点击"搜索"按钮
3. 应该显示搜索结果
4. 创建第二个聊天室：测试聊天室2
5. 再次搜索"测试"
6. 应该显示2个结果
```

### 4. 测试加入聊天室（需要第二个账号）
```
方法1：隐私模式打开新窗口
1. 按 Ctrl+Shift+N（Chrome）或 Ctrl+Shift+P（Firefox）
2. 访问 http://localhost:3000/auth/register
3. 注册新账号：test2@example.com
4. 登录后访问 /chat
5. 搜索"测试"
6. 点击"加入"按钮
7. 应该看到成员数量变为2人

方法2：退出登录测试
1. 访问 /profile
2. 点击"退出登录"
3. 注册新账号
4. 重复上述步骤
```

### 5. 测试退出聊天室
```
1. 使用第二个账号
2. 在聊天室卡片上点击"退出"按钮
3. 确认对话框
4. 应该看到Toast："已退出聊天室"
5. 聊天室从列表中消失
```

### 6. 验证数据库
在Supabase SQL编辑器中运行：

```sql
-- 查看所有聊天室
SELECT 
  cr.id,
  cr.name,
  cr.description,
  u.nickname as creator,
  COUNT(rm.user_id) as member_count,
  cr.created_at
FROM chat_rooms cr
LEFT JOIN users u ON cr.creator_id = u.id
LEFT JOIN room_members rm ON cr.id = rm.room_id
GROUP BY cr.id, u.nickname
ORDER BY cr.created_at DESC;

-- 查看聊天室成员
SELECT 
  cr.name as room_name,
  u.nickname as member_name,
  rm.role,
  rm.joined_at
FROM room_members rm
JOIN chat_rooms cr ON rm.room_id = cr.id
JOIN users u ON rm.user_id = u.id
ORDER BY cr.name, rm.joined_at;
```

---

## 预期结果

### 创建聊天室成功
- ✅ 返回聊天室ID
- ✅ 自动成为管理员
- ✅ 成员数量为1
- ✅ 显示管理员徽章

### 搜索聊天室成功
- ✅ 返回匹配的聊天室列表
- ✅ 显示成员数量
- ✅ 显示"加入"按钮

### 加入聊天室成功
- ✅ 成为普通成员
- ✅ 聊天室出现在"我的聊天室"
- ✅ 成员数量增加
- ✅ 显示"退出"按钮

### 退出聊天室成功
- ✅ 从成员列表移除
- ✅ 聊天室从"我的聊天室"消失
- ✅ 成员数量减少

---

## 常见问题

### Q1: 仍然报错 "member_count does not exist"
**A**: 
1. 确保已保存 `chatRoomApi.ts` 文件
2. 停止开发服务器（Ctrl+C）
3. 重新启动：`npm run dev`
4. 清除浏览器缓存（Ctrl+Shift+R）

### Q2: 搜索没有结果
**A**:
1. 确保已创建至少一个聊天室
2. 搜索关键词区分大小写（使用ilike已支持忽略大小写）
3. 检查聊天室名称或描述是否包含关键词

### Q3: 创建聊天室后没有显示
**A**:
1. 检查浏览器控制台是否有错误
2. 检查Toast通知是否显示成功
3. 手动刷新页面
4. 检查数据库中是否有记录

### Q4: 成员数量显示为0
**A**:
1. 检查 `room_members` 表是否有记录
2. 验证外键关联是否正确
3. 检查RLS策略是否阻止查询

---

## 数据库验证查询

### 检查聊天室是否创建成功
```sql
SELECT * FROM chat_rooms ORDER BY created_at DESC LIMIT 5;
```

### 检查成员关系是否建立
```sql
SELECT 
  rm.*,
  u.nickname,
  cr.name as room_name
FROM room_members rm
JOIN users u ON rm.user_id = u.id
JOIN chat_rooms cr ON rm.room_id = cr.id
ORDER BY rm.joined_at DESC;
```

### 统计每个聊天室的成员数
```sql
SELECT 
  cr.name,
  COUNT(rm.user_id) as member_count
FROM chat_rooms cr
LEFT JOIN room_members rm ON cr.id = rm.room_id
GROUP BY cr.id, cr.name
ORDER BY member_count DESC;
```

---

## 性能优化建议（未来）

当聊天室数量很多时，可以考虑：

1. **添加物化视图**存储成员数量
2. **使用数据库函数**自动更新计数
3. **添加缓存层**（Redis）
4. **分页加载**聊天室列表

示例SQL（添加成员计数触发器）：
```sql
-- 未来优化：自动维护成员数量字段
-- 暂不实现，当前动态计算即可
```

---

现在刷新浏览器，应该可以正常使用了！🎉
