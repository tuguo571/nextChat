-- ============================================
-- 一键修复 NOT_MEMBER 错误 - 完整脚本
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 步骤 1: 添加 is_admin 字段
-- ============================================
DO $$ 
BEGIN
  -- 检查字段是否存在
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE public.users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✅ is_admin 字段已添加';
  ELSE
    RAISE NOTICE 'ℹ️ is_admin 字段已存在';
  END IF;
END $$;

-- 步骤 2: 创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_is_admin 
ON public.users(is_admin) WHERE is_admin = TRUE;

-- 步骤 3: 查看所有用户（找到您的账号）
-- ============================================
SELECT 
  id, 
  email, 
  nickname, 
  COALESCE(is_admin, FALSE) as is_admin,
  created_at 
FROM public.users 
ORDER BY created_at DESC;

-- ⚠️ 重要：从上面的结果中找到您的邮箱，然后继续执行下面的步骤

-- 步骤 4: 设置管理员（请取消注释并替换邮箱）
-- ============================================
/*
UPDATE public.users 
SET is_admin = TRUE 
WHERE email = 'your-email@example.com';  -- ⚠️ 替换为您的实际邮箱
*/

-- 步骤 5: 验证设置是否成功
-- ============================================
/*
SELECT 
  id, 
  email, 
  nickname, 
  is_admin,
  created_at 
FROM public.users 
WHERE is_admin = TRUE;

-- 期望看到：至少一个用户的 is_admin = true
*/

-- ============================================
-- 可选：为多个用户设置管理员权限
-- ============================================
/*
UPDATE public.users 
SET is_admin = TRUE 
WHERE email IN (
  'admin1@example.com',
  'admin2@example.com'
);
*/

-- ============================================
-- 最终验证：查看所有管理员
-- ============================================
SELECT 
  COUNT(*) as "管理员数量",
  STRING_AGG(email, ', ') as "管理员邮箱"
FROM public.users 
WHERE is_admin = TRUE;
