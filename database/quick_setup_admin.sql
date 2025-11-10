-- 快速设置系统管理员
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 步骤 1: 添加 is_admin 字段（如果尚未添加）
-- ============================================
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_is_admin 
ON public.users(is_admin) WHERE is_admin = TRUE;

-- ============================================
-- 步骤 2: 查看所有用户（找到您要设置为管理员的用户）
-- ============================================
SELECT 
  id, 
  email, 
  nickname, 
  is_admin,
  created_at 
FROM public.users 
ORDER BY created_at DESC;

-- ============================================
-- 步骤 3: 设置管理员
-- ============================================
-- 方法1：通过邮箱设置（推荐）
-- 请将 'your-email@example.com' 替换为实际的管理员邮箱
/*
UPDATE public.users 
SET is_admin = TRUE 
WHERE email = 'your-email@example.com';
*/

-- 方法2：通过用户ID设置
-- 请将 'your-user-id' 替换为实际的用户ID
/*
UPDATE public.users 
SET is_admin = TRUE 
WHERE id = 'your-user-id';
*/

-- ============================================
-- 步骤 4: 验证设置是否成功
-- ============================================
SELECT 
  id, 
  email, 
  nickname, 
  is_admin,
  created_at 
FROM public.users 
WHERE is_admin = TRUE;

-- 期望看到至少一个用户的 is_admin = true

-- ============================================
-- 可选：批量设置多个管理员
-- ============================================
/*
UPDATE public.users 
SET is_admin = TRUE 
WHERE email IN (
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com'
);
*/

-- ============================================
-- 可选：撤销管理员权限
-- ============================================
/*
UPDATE public.users 
SET is_admin = FALSE 
WHERE email = 'user@example.com';
*/
