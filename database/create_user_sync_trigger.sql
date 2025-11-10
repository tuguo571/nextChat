-- 自动同步 auth.users 到 public.users 的触发器

-- 1. 创建触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname, password_hash, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'nickname',
      split_part(NEW.email, '@', 1),
      '用户' || substring(NEW.id::text, 1, 8)
    ),
    'managed_by_supabase_auth',
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. 验证触发器已创建
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 测试说明：
-- 1. 执行上面的 SQL 创建触发器
-- 2. 在应用中注册新用户
-- 3. 检查 public.users 表是否自动创建了记录
-- 
-- 验证查询：
-- SELECT * FROM public.users ORDER BY created_at DESC LIMIT 1;
