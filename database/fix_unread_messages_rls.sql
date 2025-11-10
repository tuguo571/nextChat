-- 修复 unread_messages 表的 RLS 策略
-- {{ AURA: Add - 创建 unread_messages 表并添加 RLS 策略以修复 404 错误 }}

-- 创建 unread_messages 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.unread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_unread_messages_user ON public.unread_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_unread_messages_room ON public.unread_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_unread_messages_user_room ON public.unread_messages(user_id, room_id);

-- 启用 RLS
ALTER TABLE public.unread_messages ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户可以查看自己的未读记录" ON public.unread_messages;
DROP POLICY IF EXISTS "用户可以更新自己的未读记录" ON public.unread_messages;
DROP POLICY IF EXISTS "用户可以插入自己的未读记录" ON public.unread_messages;
DROP POLICY IF EXISTS "用户可以删除自己的未读记录" ON public.unread_messages;

-- 创建 RLS 策略
-- 1. 查看策略：用户只能查看自己的未读记录
CREATE POLICY "用户可以查看自己的未读记录"
ON public.unread_messages
FOR SELECT
USING (auth.uid() = user_id);

-- 2. 插入策略：用户只能插入自己的未读记录
CREATE POLICY "用户可以插入自己的未读记录"
ON public.unread_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. 更新策略：用户只能更新自己的未读记录
CREATE POLICY "用户可以更新自己的未读记录"
ON public.unread_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. 删除策略：用户可以删除自己的未读记录
CREATE POLICY "用户可以删除自己的未读记录"
ON public.unread_messages
FOR DELETE
USING (auth.uid() = user_id);

-- 添加表注释
COMMENT ON TABLE public.unread_messages IS '用户未读消息跟踪表';
COMMENT ON COLUMN public.unread_messages.user_id IS '用户ID';
COMMENT ON COLUMN public.unread_messages.room_id IS '房间ID';
COMMENT ON COLUMN public.unread_messages.last_read_message_id IS '最后已读消息ID';
COMMENT ON COLUMN public.unread_messages.last_read_at IS '最后已读时间';
COMMENT ON COLUMN public.unread_messages.unread_count IS '未读消息数';
