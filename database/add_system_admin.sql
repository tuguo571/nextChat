-- 添加系统级管理员功能
-- 执行此脚本为用户表添加 is_admin 字段

-- ============================================
-- 1. 为 users 表添加 is_admin 字段
-- ============================================
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 为 is_admin 字段添加索引（便于快速查询管理员）
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin) WHERE is_admin = TRUE;

-- 添加注释
COMMENT ON COLUMN public.users.is_admin IS '系统级管理员标识，拥有所有聊天室的访问权限';

-- ============================================
-- 2. 可选：设置特定用户为管理员
-- ============================================
-- 方法1: 通过邮箱设置管理员（请替换为实际的管理员邮箱）
-- UPDATE public.users 
-- SET is_admin = TRUE 
-- WHERE email = 'admin@example.com';

-- 方法2: 通过用户ID设置管理员（请替换为实际的用户ID）
-- UPDATE public.users 
-- SET is_admin = TRUE 
-- WHERE id = 'your-user-id-here';

-- ============================================
-- 3. 查询当前所有管理员
-- ============================================
-- SELECT id, email, nickname, is_admin, created_at 
-- FROM public.users 
-- WHERE is_admin = TRUE;

-- ============================================
-- 4. 验证字段是否添加成功
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name = 'users'
-- AND column_name = 'is_admin';
