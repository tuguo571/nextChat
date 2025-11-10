-- {{ AURA: Add - Supabase Storage 配置 }}
-- 创建聊天文件存储桶

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "允许认证用户上传文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户查看自己的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许房间成员查看房间文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户更新自己的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户删除自己的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许管理员删除任何文件" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_update" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_delete_admin" ON storage.objects;

-- 1. 创建 chat-files 存储桶
-- {{ AURA: Modify - 使用 DO NOTHING 避免冲突，如果桶不存在则创建 }}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,  -- 公共桶，允许通过 getPublicUrl 访问
  52428800,  -- 50MB 文件大小限制
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 如果存储桶已存在但是私有的，需要通过 Supabase Dashboard 手动修改为公共
-- Dashboard → Storage → chat-files → Edit bucket → 勾选 "Public bucket"

-- 2. 设置存储策略（RLS）
-- {{ AURA: Modify - 使用简化的策略名称，避免中文引起的问题 }}

-- 允许所有认证用户上传文件
CREATE POLICY "chat_files_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files');

-- 允许所有认证用户更新文件
CREATE POLICY "chat_files_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-files');

-- 允许用户删除自己的文件
CREATE POLICY "chat_files_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files' AND
  (auth.uid()::text = (storage.foldername(name))[1])
);

-- 允许系统管理员删除任何文件
CREATE POLICY "chat_files_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
);
