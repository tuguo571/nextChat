-- ============================================
-- RLS 策略诊断脚本
-- 用于检查当前数据库的 RLS 配置状态
-- ============================================

-- 1. 检查哪些表启用了 RLS
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ 已启用'
        ELSE '❌ 未启用'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. 检查所有策略的详细信息
SELECT 
    schemaname,
    tablename,
    policyname,
    CASE cmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
    END as operation,
    CASE permissive
        WHEN 'PERMISSIVE' THEN '✅ 允许'
        ELSE '⚠️ 限制'
    END as type,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 3. 检查每个表的策略数量
SELECT 
    tablename,
    COUNT(*) as policy_count,
    COUNT(CASE WHEN cmd = 'r' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'a' THEN 1 END) as insert_policies,
    COUNT(CASE WHEN cmd = 'w' THEN 1 END) as update_policies,
    COUNT(CASE WHEN cmd = 'd' THEN 1 END) as delete_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 4. 检查缺失的策略（应该有但没有的）
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name 
            AND cmd = 'r'
        ) THEN '✅' ELSE '❌ 缺少 SELECT'
    END as select_policy,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name 
            AND cmd = 'a'
        ) THEN '✅' ELSE '❌ 缺少 INSERT'
    END as insert_policy,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name 
            AND cmd = 'w'
        ) THEN '✅' ELSE '⚠️ 可选 UPDATE'
    END as update_policy,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name 
            AND cmd = 'd'
        ) THEN '✅' ELSE '⚠️ 可选 DELETE'
    END as delete_policy
FROM (
    SELECT 'users' as table_name
    UNION ALL SELECT 'chat_rooms'
    UNION ALL SELECT 'room_members'
    UNION ALL SELECT 'messages'
    UNION ALL SELECT 'message_reactions'
    UNION ALL SELECT 'file_metadata'
    UNION ALL SELECT 'notifications'
) t;

-- 5. 检查用户表策略（详细）
SELECT 
    policyname,
    CASE cmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
    END as operation,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'users'
ORDER BY cmd;

-- 6. 检查聊天室相关表策略（详细）
SELECT 
    tablename,
    policyname,
    CASE cmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
    END as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('chat_rooms', 'room_members', 'messages')
ORDER BY tablename, cmd;

-- 7. 测试当前用户的访问权限（需要先登录）
-- 注意：这个查询需要在应用中通过认证的用户执行
SELECT 
    'users' as table_name,
    EXISTS (SELECT 1 FROM users LIMIT 1) as can_select,
    'INSERT test' as can_insert_note
UNION ALL
SELECT 
    'chat_rooms',
    EXISTS (SELECT 1 FROM chat_rooms LIMIT 1),
    'INSERT test'
UNION ALL
SELECT 
    'room_members',
    EXISTS (SELECT 1 FROM room_members LIMIT 1),
    'INSERT test';

-- 8. 检查触发器（确保 updated_at 自动更新）
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation as event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- ============================================
-- 使用说明
-- ============================================
-- 1. 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- 2. 查看每个查询的结果
-- 3. 如果看到 ❌ 标记，说明有策略缺失
-- 4. 执行 rls_policies.sql 脚本来修复缺失的策略
-- 5. 重新运行此诊断脚本验证修复结果
