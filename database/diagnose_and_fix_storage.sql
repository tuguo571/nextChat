-- {{ AURA: Add - 诊断并修复存储桶配置 }}
-- 检查和修复 chat-files 存储桶的配置问题

-- ========================================
-- 第一步：检查存储桶当前状态
-- ========================================
SELECT 
  id,
  name,
  public as "是否公共",
  file_size_limit as "文件大小限制",
  allowed_mime_types as "允许的MIME类型",
  created_at as "创建时间"
FROM storage.buckets 
WHERE id = 'chat-files';

-- ========================================
-- 第二步：检查现有策略
-- ========================================
SELECT 
  policyname as "策略名称",
  cmd as "命令类型",
  qual as "使用条件",
  with_check as "检查条件"
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%chat-files%' OR policyname LIKE '%认证%' OR policyname LIKE '%管理员%';

-- ========================================
-- 第三步：删除所有旧策略（避免冲突）
-- ========================================
DROP POLICY IF EXISTS "允许认证用户上传文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户查看自己的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许房间成员查看房间文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户更新自己的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许用户删除自己的文件" ON storage.objects;
DROP POLICY IF EXISTS "允许管理员删除任何文件" ON storage.objects;

-- ========================================
-- 第四步：更新存储桶为公共访问
-- ========================================
UPDATE storage.buckets 
SET public = true 
WHERE id = 'chat-files';

-- 如果存储桶不存在，则创建
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,
  52428800,  -- 50MB
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
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================================
-- 第五步：创建新的简化策略
-- ========================================

-- 1. 允许所有认证用户上传文件
CREATE POLICY "chat_files_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files');

-- 2. 允许所有认证用户更新文件（可选，根据需求）
CREATE POLICY "chat_files_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-files');

-- 3. 允许用户删除自己的文件
CREATE POLICY "chat_files_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files' AND
  (auth.uid()::text = (storage.foldername(name))[1])
);

-- 4. 允许管理员删除任何文件
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

-- ========================================
-- 第六步：验证配置
-- ========================================
SELECT 
  '✓ 存储桶配置完成' as "状态",
  public as "公共访问",
  file_size_limit / 1024 / 1024 || ' MB' as "最大文件大小"
FROM storage.buckets 
WHERE id = 'chat-files';

SELECT 
  '✓ RLS策略已创建' as "状态",
  COUNT(*) as "策略数量"
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (policyname LIKE 'chat_files_%');
