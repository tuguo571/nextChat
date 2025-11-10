-- 实时聊天室系统数据库Schema设计
-- 数据库: Supabase PostgreSQL

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nickname VARCHAR(20) NOT NULL,
  avatar_url TEXT,
  signature VARCHAR(100),
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,  -- {{ AURA: Add - 系统级管理员标识 }}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户表索引
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_nickname ON public.users(nickname);
CREATE INDEX idx_users_is_admin ON public.users(is_admin) WHERE is_admin = TRUE;  -- {{ AURA: Add - 管理员索引 }}

-- ============================================
-- 2. 聊天室表 (chat_rooms)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- 聊天室表索引
CREATE INDEX idx_chat_rooms_creator ON public.chat_rooms(creator_id);
CREATE INDEX idx_chat_rooms_activity ON public.chat_rooms(last_activity_at DESC);

-- ============================================
-- 3. 聊天室成员表 (room_members)
-- ============================================
CREATE TABLE IF NOT EXISTS public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 聊天室成员表索引
CREATE INDEX idx_room_members_room ON public.room_members(room_id);
CREATE INDEX idx_room_members_user ON public.room_members(user_id);

-- ============================================
-- 4. 消息表 (messages)
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice', 'system')),
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  file_size BIGINT,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 消息表索引
CREATE INDEX idx_messages_room ON public.messages(room_id, created_at DESC);
CREATE INDEX idx_messages_user ON public.messages(user_id);
CREATE INDEX idx_messages_reply ON public.messages(reply_to);
CREATE INDEX idx_messages_search ON public.messages USING gin(to_tsvector('simple', content));

-- ============================================
-- 5. 消息反应表 (message_reactions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 消息反应表索引
CREATE INDEX idx_message_reactions_message ON public.message_reactions(message_id);

-- ============================================
-- 6. 消息提及表 (message_mentions)
-- ============================================
-- {{ AURA: Add - 存储消息中@提及的用户关系 }}
CREATE TABLE IF NOT EXISTS public.message_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, mentioned_user_id)
);

-- 消息提及表索引
CREATE INDEX idx_message_mentions_message ON public.message_mentions(message_id);
CREATE INDEX idx_message_mentions_user ON public.message_mentions(mentioned_user_id, is_read);

-- ============================================
-- 6.1 未读消息跟踪表 (unread_messages)
-- ============================================
-- {{ AURA: Add - 跟踪每个用户在每个房间的未读消息数 }}
CREATE TABLE IF NOT EXISTS public.unread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  UNIQUE(user_id, room_id)
);

-- 未读消息表索引
CREATE INDEX idx_unread_messages_user ON public.unread_messages(user_id);
CREATE INDEX idx_unread_messages_room ON public.unread_messages(room_id);
CREATE INDEX idx_unread_messages_user_room ON public.unread_messages(user_id, room_id);

-- ============================================
-- 7. 文件元数据表 (file_metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS public.file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  webdav_path TEXT NOT NULL,
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文件元数据表索引
CREATE INDEX idx_file_metadata_room ON public.file_metadata(room_id);
CREATE INDEX idx_file_metadata_user ON public.file_metadata(user_id);

-- ============================================
-- 8. 通知表 (notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('mention', 'announcement', 'system', 'security')),
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 通知表索引
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_expires ON public.notifications(expires_at);

-- ============================================
-- 9. 用户会话表 (user_sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 用户会话表索引
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(token);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at);

-- ============================================
-- 10. 操作日志表 (operation_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS public.operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 操作日志表索引
CREATE INDEX idx_operation_logs_user ON public.operation_logs(user_id);
CREATE INDEX idx_operation_logs_action ON public.operation_logs(action);
CREATE INDEX idx_operation_logs_created ON public.operation_logs(created_at DESC);

-- ============================================
-- 自动更新 updated_at 字段的触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加触发器
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 自动清理过期数据的函数
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  -- 清理过期通知
  DELETE FROM public.notifications WHERE expires_at < NOW();
  
  -- 清理过期会话
  DELETE FROM public.user_sessions WHERE expires_at < NOW();
  
  -- 清理30天前的操作日志
  DELETE FROM public.operation_logs WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 定时执行清理任务 (需要在Supabase中手动设置pg_cron)
-- SELECT cron.schedule('cleanup-expired-data', '0 2 * * *', 'SELECT cleanup_expired_data()');

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 用户表RLS策略
CREATE POLICY "用户可以查看所有用户基本信息" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "用户只能更新自己的信息" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- 聊天室表RLS策略
CREATE POLICY "所有人可以查看聊天室" ON public.chat_rooms
  FOR SELECT USING (true);

CREATE POLICY "创建者可以更新聊天室" ON public.chat_rooms
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "创建者可以删除聊天室" ON public.chat_rooms
  FOR DELETE USING (auth.uid() = creator_id);

-- 聊天室成员表RLS策略
CREATE POLICY "成员可以查看自己加入的聊天室成员" ON public.room_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_members.room_id
      AND rm.user_id = auth.uid()
    )
  );

-- 消息表RLS策略
CREATE POLICY "成员可以查看聊天室消息" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = messages.room_id
      AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以发送消息" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = messages.room_id
      AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以编辑自己的消息" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

-- 通知表RLS策略
CREATE POLICY "用户只能查看自己的通知" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的通知" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
