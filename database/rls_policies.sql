-- ============================================
-- Row Level Security (RLS) 补充策略
-- 修复 403/500 权限错误
-- ============================================

-- ============================================
-- 1. 用户表 (users) - 添加缺失的策略
-- ============================================

-- 允许任何人注册（创建用户记录）
-- 注意：这个策略假设用户通过 Supabase Auth 注册后，需要在 users 表中创建对应记录
DROP POLICY IF EXISTS "允许创建用户记录" ON public.users;
CREATE POLICY "允许创建用户记录" ON public.users
  FOR INSERT WITH CHECK (true);

-- 用户可以查看所有用户基本信息（已存在，但重新创建以确保）
DROP POLICY IF EXISTS "用户可以查看所有用户基本信息" ON public.users;
CREATE POLICY "用户可以查看所有用户基本信息" ON public.users
  FOR SELECT USING (true);

-- 用户只能更新自己的信息
DROP POLICY IF EXISTS "用户只能更新自己的信息" ON public.users;
CREATE POLICY "用户只能更新自己的信息" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 2. 聊天室表 (chat_rooms) - 添加创建策略
-- ============================================

-- 任何认证用户都可以创建聊天室
DROP POLICY IF EXISTS "认证用户可以创建聊天室" ON public.chat_rooms;
CREATE POLICY "认证用户可以创建聊天室" ON public.chat_rooms
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- 所有人可以查看聊天室
DROP POLICY IF EXISTS "所有人可以查看聊天室" ON public.chat_rooms;
CREATE POLICY "所有人可以查看聊天室" ON public.chat_rooms
  FOR SELECT USING (true);

-- 创建者或管理员可以更新聊天室
DROP POLICY IF EXISTS "创建者可以更新聊天室" ON public.chat_rooms;
CREATE POLICY "创建者或管理员可以更新聊天室" ON public.chat_rooms
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = chat_rooms.id
      AND rm.user_id = auth.uid()
      AND rm.role = 'admin'
    )
  );

-- 创建者或管理员可以删除聊天室
DROP POLICY IF EXISTS "创建者可以删除聊天室" ON public.chat_rooms;
CREATE POLICY "创建者或管理员可以删除聊天室" ON public.chat_rooms
  FOR DELETE USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = chat_rooms.id
      AND rm.user_id = auth.uid()
      AND rm.role = 'admin'
    )
  );

-- ============================================
-- 3. 聊天室成员表 (room_members) - 完整策略
-- ============================================

-- {{ AURA: Modify - 修复无限递归问题，简化 SELECT 策略 }}
-- 成员可以查看所有聊天室的成员列表（因为聊天室是公开的）
DROP POLICY IF EXISTS "成员可以查看自己加入的聊天室成员" ON public.room_members;
CREATE POLICY "用户可以查看所有聊天室成员" ON public.room_members
  FOR SELECT USING (true);

-- 认证用户可以加入聊天室（添加自己为成员）
DROP POLICY IF EXISTS "用户可以加入聊天室" ON public.room_members;
CREATE POLICY "用户可以加入聊天室" ON public.room_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = room_id
    )
  );

-- 管理员可以添加其他成员
DROP POLICY IF EXISTS "管理员可以添加成员" ON public.room_members;
CREATE POLICY "管理员可以添加成员" ON public.room_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_id
      AND rm.user_id = auth.uid()
      AND rm.role = 'admin'
    )
  );

-- 管理员可以修改成员角色
DROP POLICY IF EXISTS "管理员可以修改成员角色" ON public.room_members;
CREATE POLICY "管理员可以修改成员角色" ON public.room_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_members.room_id
      AND rm.user_id = auth.uid()
      AND rm.role = 'admin'
    )
  );

-- 用户可以退出聊天室（删除自己的成员记录）
DROP POLICY IF EXISTS "用户可以退出聊天室" ON public.room_members;
CREATE POLICY "用户可以退出聊天室" ON public.room_members
  FOR DELETE USING (auth.uid() = user_id);

-- 管理员可以踢出成员
DROP POLICY IF EXISTS "管理员可以踢出成员" ON public.room_members;
CREATE POLICY "管理员可以踢出成员" ON public.room_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_members.room_id
      AND rm.user_id = auth.uid()
      AND rm.role = 'admin'
    )
  );

-- ============================================
-- 4. 消息表 (messages) - 确保策略完整
-- ============================================

-- 成员可以查看聊天室消息
DROP POLICY IF EXISTS "成员可以查看聊天室消息" ON public.messages;
CREATE POLICY "成员可以查看聊天室消息" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = messages.room_id
      AND rm.user_id = auth.uid()
    )
  );

-- 用户可以发送消息
DROP POLICY IF EXISTS "用户可以发送消息" ON public.messages;
CREATE POLICY "用户可以发送消息" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = messages.room_id
      AND rm.user_id = auth.uid()
    )
  );

-- 用户可以编辑自己的消息
DROP POLICY IF EXISTS "用户可以编辑自己的消息" ON public.messages;
CREATE POLICY "用户可以编辑自己的消息" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户可以删除自己的消息
DROP POLICY IF EXISTS "用户可以删除自己的消息" ON public.messages;
CREATE POLICY "用户可以删除自己的消息" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- 管理员可以删除任何消息
DROP POLICY IF EXISTS "管理员可以删除任何消息" ON public.messages;
CREATE POLICY "管理员可以删除任何消息" ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = messages.room_id
      AND rm.user_id = auth.uid()
      AND rm.role = 'admin'
    )
  );

-- ============================================
-- 5. 消息反应表 (message_reactions)
-- ============================================

-- 用户可以查看所有消息反应
DROP POLICY IF EXISTS "用户可以查看消息反应" ON public.message_reactions;
CREATE POLICY "用户可以查看消息反应" ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      INNER JOIN public.room_members rm ON rm.room_id = m.room_id
      WHERE m.id = message_reactions.message_id
      AND rm.user_id = auth.uid()
    )
  );

-- 用户可以添加反应
DROP POLICY IF EXISTS "用户可以添加反应" ON public.message_reactions;
CREATE POLICY "用户可以添加反应" ON public.message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      INNER JOIN public.room_members rm ON rm.room_id = m.room_id
      WHERE m.id = message_id
      AND rm.user_id = auth.uid()
    )
  );

-- 用户可以删除自己的反应
DROP POLICY IF EXISTS "用户可以删除自己的反应" ON public.message_reactions;
CREATE POLICY "用户可以删除自己的反应" ON public.message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. 文件元数据表 (file_metadata) - 如果存在
-- ============================================

-- 成员可以查看聊天室文件
DROP POLICY IF EXISTS "成员可以查看聊天室文件" ON public.file_metadata;
CREATE POLICY "成员可以查看聊天室文件" ON public.file_metadata
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = file_metadata.room_id
      AND rm.user_id = auth.uid()
    )
  );

-- 成员可以上传文件
-- {{ AURA: Modify - 修正字段名 uploader_id → user_id }}
DROP POLICY IF EXISTS "成员可以上传文件" ON public.file_metadata;
CREATE POLICY "成员可以上传文件" ON public.file_metadata
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = file_metadata.room_id
      AND rm.user_id = auth.uid()
    )
  );

-- 上传者可以删除自己的文件
DROP POLICY IF EXISTS "上传者可以删除自己的文件" ON public.file_metadata;
CREATE POLICY "上传者可以删除自己的文件" ON public.file_metadata
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. 通知表 (notifications) - 如果存在
-- ============================================

-- 用户只能查看自己的通知
DROP POLICY IF EXISTS "用户只能查看自己的通知" ON public.notifications;
CREATE POLICY "用户只能查看自己的通知" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- 系统可以创建通知（通过服务端代码）
DROP POLICY IF EXISTS "允许创建通知" ON public.notifications;
CREATE POLICY "允许创建通知" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- 用户只能更新自己的通知
DROP POLICY IF EXISTS "用户只能更新自己的通知" ON public.notifications;
CREATE POLICY "用户只能更新自己的通知" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的通知
DROP POLICY IF EXISTS "用户只能删除自己的通知" ON public.notifications;
CREATE POLICY "用户只能删除自己的通知" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 执行说明
-- ============================================
-- 1. 登录到 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 复制并执行此脚本
-- 4. 验证策略已应用：在 Table Editor 中检查每个表的 RLS 策略
