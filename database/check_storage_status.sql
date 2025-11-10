-- {{ AURA: Add - 存储桶状态诊断脚本 }}
-- 检查 chat-files 存储桶的完整状态

-- ========================================
-- 1. 检查存储桶是否存在及其配置
-- ========================================
SELECT 
  '=== 存储桶配置 ===' as "检查项",
  id as "ID",
  name as "名称",
  CASE 
    WHEN public = true THEN '✅ 公共'
    ELSE '❌ 私有（这是问题所在！）'
  END as "访问类型",
  public as "public字段值",
  file_size_limit / 1024 / 1024 || ' MB' as "最大文件大小",
  created_at as "创建时间"
FROM storage.buckets 
WHERE id = 'chat-files';

-- ========================================
-- 2. 检查存储桶中的文件
-- ========================================
SELECT 
  '=== 已上传文件 ===' as "检查项",
  name as "文件路径",
  bucket_id as "存储桶",
  owner as "所有者ID",
  created_at as "上传时间"
FROM storage.objects 
WHERE bucket_id = 'chat-files'
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- 3. 检查 RLS 策略
-- ========================================
SELECT 
  '=== RLS 策略 ===' as "检查项",
  policyname as "策略名称",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as "操作类型",
  roles::text as "适用角色"
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (
  policyname LIKE '%chat_files%' 
  OR policyname LIKE '%chat-files%'
  OR policyname LIKE '%认证%'
);

-- ========================================
-- 4. 如果存储桶是私有的，提供修复命令
-- ========================================
DO $$
DECLARE
  is_public boolean;
BEGIN
  SELECT public INTO is_public FROM storage.buckets WHERE id = 'chat-files';
  
  IF is_public = false OR is_public IS NULL THEN
    RAISE NOTICE '❌ 检测到存储桶是私有的！';
    RAISE NOTICE '由于 Supabase 安全限制，无法通过 SQL 修改 public 字段。';
    RAISE NOTICE '';
    RAISE NOTICE '请按以下步骤手动修改：';
    RAISE NOTICE '1. 打开 Supabase Dashboard';
    RAISE NOTICE '2. 进入 Storage 页面';
    RAISE NOTICE '3. 找到 chat-files 存储桶';
    RAISE NOTICE '4. 点击右侧 ⋮ → Edit bucket';
    RAISE NOTICE '5. 勾选 "Public bucket"';
    RAISE NOTICE '6. 点击 Save';
    RAISE NOTICE '';
    RAISE NOTICE '或者执行以下删除重建操作（会丢失现有文件）：';
    RAISE NOTICE 'DELETE FROM storage.objects WHERE bucket_id = ''chat-files'';';
    RAISE NOTICE 'DELETE FROM storage.buckets WHERE id = ''chat-files'';';
    RAISE NOTICE '然后重新执行 setup_storage.sql';
  ELSE
    RAISE NOTICE '✅ 存储桶配置正确（public = true）';
    RAISE NOTICE '如果仍然出现 400 错误，请检查：';
    RAISE NOTICE '1. 文件是否真的存在于存储桶中';
    RAISE NOTICE '2. 浏览器缓存（Ctrl+Shift+R 强制刷新）';
    RAISE NOTICE '3. CDN 缓存延迟';
  END IF;
END $$;
