-- 修复脚本：为已存在的 auth.users 创建对应的 public.users 记录

-- 查看哪些 auth 用户没有对应的 public.users 记录
SELECT 
  au.id,
  au.email,
  au.created_at,
  pu.id as public_user_id
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 自动为缺失的用户创建记录
INSERT INTO public.users (id, email, nickname, password_hash, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'nickname',
    split_part(au.email, '@', 1),
    '用户' || substring(au.id::text, 1, 8)
  ) as nickname,
  'managed_by_supabase_auth' as password_hash,
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 验证修复结果
SELECT 
  u.id,
  u.email,
  u.nickname,
  u.created_at
FROM public.users u
ORDER BY u.created_at DESC;

-- 检查是否所有 auth 用户都有对应的 public 用户
SELECT 
  COUNT(*) as auth_users,
  (SELECT COUNT(*) FROM public.users) as public_users,
  COUNT(*) - (SELECT COUNT(*) FROM public.users) as missing
FROM auth.users;
