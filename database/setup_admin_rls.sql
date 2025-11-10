-- ============================================
-- 系统管理员 RLS 策略配置
-- 适用于只有 ANON_KEY 的环境
-- ============================================

-- {{ AURA: Add - 为系统管理员创建 RLS 策略，允许访问所有数据 }}

-- ============================================
-- 1. room_members 表 - 系统管理员策略
-- ============================================

-- 系统管理员可以查看所有房间成员
CREATE POLICY "系统管理员可以查看所有房间成员" ON public.room_members
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- 系统管理员可以添加任何成员
CREATE POLICY "系统管理员可以添加任何成员" ON public.room_members
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- 系统管理员可以更新任何成员
CREATE POLICY "系统管理员可以更新任何成员" ON public.room_members
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- 系统管理员可以删除任何成员
CREATE POLICY "系统管理员可以删除任何成员" ON public.room_members
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- ============================================
-- 2. messages 表 - 系统管理员策略
-- ============================================

-- 系统管理员可以查看所有消息
CREATE POLICY "系统管理员可以查看所有消息" ON public.messages
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- 系统管理员可以发送消息到任何房间
CREATE POLICY "系统管理员可以发送消息到任何房间" ON public.messages
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- 系统管理员可以更新任何消息
CREATE POLICY "系统管理员可以更新任何消息" ON public.messages
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- 系统管理员可以删除任何消息
CREATE POLICY "系统管理员可以删除任何消息" ON public.messages
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- ============================================
-- 3. chat_rooms 表 - 系统管理员策略
-- ============================================

-- 系统管理员可以更新任何聊天室
CREATE POLICY "系统管理员可以更新任何聊天室" ON public.chat_rooms
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- 系统管理员可以删除任何聊天室
CREATE POLICY "系统管理员可以删除任何聊天室" ON public.chat_rooms
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- ============================================
-- 4. 创建辅助函数来检查管理员身份
-- ============================================

CREATE OR REPLACE FUNCTION public.is_system_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_id 
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为当前用户检查管理员身份的便捷函数
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_system_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 验证策略
-- ============================================

-- 查看所有 RLS 策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND policyname LIKE '%管理员%'
ORDER BY tablename, policyname;

-- ============================================
-- 6. 设置系统管理员（示例）
-- ============================================

-- 查看所有用户
SELECT id, email, nickname, is_admin FROM public.users;

-- 设置管理员（替换为实际的邮箱）
-- UPDATE public.users SET is_admin = true WHERE email = 'your-email@example.com';

-- 验证管理员设置
SELECT id, email, nickname, is_admin 
FROM public.users 
WHERE is_admin = true;
