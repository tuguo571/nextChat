-- 消息已读回执表
-- {{ AURA: Add - 记录用户对消息的已读状态 }}

CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- 索引优化
CREATE INDEX idx_message_reads_message ON public.message_reads(message_id);
CREATE INDEX idx_message_reads_user ON public.message_reads(user_id);
CREATE INDEX idx_message_reads_read_at ON public.message_reads(read_at);

-- RLS 策略
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己所在房间的消息已读状态
CREATE POLICY "Users can view read receipts in their rooms"
ON public.message_reads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    INNER JOIN public.room_members rm ON m.room_id = rm.room_id
    WHERE m.id = message_reads.message_id
    AND rm.user_id = auth.uid()
  )
);

-- 用户可以标记消息为已读
CREATE POLICY "Users can mark messages as read"
ON public.message_reads
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    INNER JOIN public.room_members rm ON m.room_id = rm.room_id
    WHERE m.id = message_reads.message_id
    AND rm.user_id = auth.uid()
  )
);

-- 用户可以更新自己的已读记录
CREATE POLICY "Users can update their own reads"
ON public.message_reads
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.message_reads IS '消息已读回执表';
COMMENT ON COLUMN public.message_reads.message_id IS '消息ID';
COMMENT ON COLUMN public.message_reads.user_id IS '已读用户ID';
COMMENT ON COLUMN public.message_reads.read_at IS '已读时间';
