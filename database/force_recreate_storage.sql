-- {{ AURA: Add - 强制删除并重建 chat-files 存储桶（公共模式）}}
-- ⚠️ 警告：此操作会删除存储桶中的所有文件！
-- ⚠️ 请确保已备份重要文件或文件不重要后再执行

-- ========================================
-- 步骤 1: 删除所有文件和存储桶
-- ========================================
-- 删除存储桶中的所有文件
DELETE FROM storage.objects WHERE bucket_id = 'chat-files';

-- 删除存储桶本身
DELETE FROM storage.buckets WHERE id = 'chat-files';

-- 删除所有相关的 RLS 策略
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

-- ========================================
-- 步骤 2: 重新创建存储桶（公共模式）
-- ========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,  -- 关键：设置为公共
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
);

-- ========================================
-- 步骤 3: 创建 RLS 策略
-- ========================================
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

-- ========================================
-- 步骤 4: 验证配置
-- ========================================
SELECT 
  '✅ 存储桶重建完成' as "状态",
  id,
  name,
  CASE 
    WHEN public = true THEN '✅ 公共'
    ELSE '❌ 私有'
  END as "访问类型",
  file_size_limit / 1024 / 1024 || ' MB' as "最大文件大小"
FROM storage.buckets 
WHERE id = 'chat-files';

-- 显示创建的策略
SELECT 
  '✅ RLS 策略已创建' as "状态",
  policyname as "策略名称",
  CASE cmd
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
  END as "操作"
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE 'chat_files_%'
ORDER BY policyname;
