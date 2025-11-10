-- ============================================
-- 系统管理员功能诊断脚本
-- ============================================

-- 步骤 1: 检查 is_admin 字段是否存在
-- ============================================
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name = 'is_admin';

-- 期望结果：应该返回一行数据
-- 如果没有返回数据，说明字段尚未创建

-- ============================================
-- 步骤 2: 查看所有用户及其管理员状态
-- ============================================
SELECT 
  id, 
  email, 
  nickname, 
  is_admin,
  created_at 
FROM public.users 
ORDER BY created_at DESC;

-- 期望结果：应该看到 is_admin 列
-- 找到您的账号，检查 is_admin 是否为 true

-- ============================================
-- 步骤 3: 检查是否有管理员用户
-- ============================================
SELECT 
  COUNT(*) as admin_count,
  STRING_AGG(email, ', ') as admin_emails
FROM public.users 
WHERE is_admin = TRUE;

-- 期望结果：admin_count 应该至少为 1

-- ============================================
-- 步骤 4: 查看特定用户的详细信息
-- ============================================
-- 将 'your-email@example.com' 替换为您的邮箱
/*
SELECT 
  id, 
  email, 
  nickname, 
  is_admin,
  created_at,
  updated_at
FROM public.users 
WHERE email = 'your-email@example.com';
*/

-- ============================================
-- 快速修复：如果字段不存在，执行此部分
-- ============================================
/*
-- 添加字段
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_is_admin 
ON public.users(is_admin) WHERE is_admin = TRUE;

-- 设置管理员（替换邮箱）
UPDATE public.users 
SET is_admin = TRUE 
WHERE email = 'your-email@example.com';

-- 验证
SELECT id, email, nickname, is_admin 
FROM public.users 
WHERE is_admin = TRUE;
*/
