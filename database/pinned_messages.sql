-- 消息置顶功能
-- {{ AURA: Add - 在messages表中添加置顶相关字段 }}

-- 添加置顶字段到messages表
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 为置顶消息创建索引（优化查询置顶消息）
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON public.messages(room_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_messages_pinned_at ON public.messages(pinned_at) WHERE pinned_at IS NOT NULL;

-- 添加注释
COMMENT ON COLUMN public.messages.is_pinned IS '是否置顶';
COMMENT ON COLUMN public.messages.pinned_at IS '置顶时间';
COMMENT ON COLUMN public.messages.pinned_by IS '置顶操作者ID';

-- RLS 策略已存在，不需要额外添加
-- 置顶操作将通过应用层权限控制（仅房间管理员和系统管理员可置顶）
