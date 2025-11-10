-- ============================================
-- 清理所有现有的 RLS 策略
-- 用于重新应用策略前的清理工作
-- ============================================

-- {{ AURA: Add - 创建清理脚本，删除所有现有策略 }}

-- 1. 删除 users 表的所有策略
DROP POLICY IF EXISTS "允许创建用户记录" ON public.users;
DROP POLICY IF EXISTS "用户可以查看所有用户基本信息" ON public.users;
DROP POLICY IF EXISTS "用户只能更新自己的信息" ON public.users;

-- 2. 删除 chat_rooms 表的所有策略
DROP POLICY IF EXISTS "认证用户可以创建聊天室" ON public.chat_rooms;
DROP POLICY IF EXISTS "所有人可以查看聊天室" ON public.chat_rooms;
DROP POLICY IF EXISTS "创建者或管理员可以更新聊天室" ON public.chat_rooms;
DROP POLICY IF EXISTS "创建者可以更新聊天室" ON public.chat_rooms;
DROP POLICY IF EXISTS "创建者或管理员可以删除聊天室" ON public.chat_rooms;
DROP POLICY IF EXISTS "创建者可以删除聊天室" ON public.chat_rooms;

-- 3. 删除 room_members 表的所有策略
DROP POLICY IF EXISTS "成员可以查看自己加入的聊天室成员" ON public.room_members;
DROP POLICY IF EXISTS "用户可以查看所有聊天室成员" ON public.room_members;
DROP POLICY IF EXISTS "用户可以加入聊天室" ON public.room_members;
DROP POLICY IF EXISTS "管理员可以添加成员" ON public.room_members;
DROP POLICY IF EXISTS "管理员可以修改成员角色" ON public.room_members;
DROP POLICY IF EXISTS "用户可以退出聊天室" ON public.room_members;
DROP POLICY IF EXISTS "管理员可以踢出成员" ON public.room_members;

-- 4. 删除 messages 表的所有策略
DROP POLICY IF EXISTS "成员可以查看聊天室消息" ON public.messages;
DROP POLICY IF EXISTS "用户可以发送消息" ON public.messages;
DROP POLICY IF EXISTS "用户可以编辑自己的消息" ON public.messages;
DROP POLICY IF EXISTS "用户可以删除自己的消息" ON public.messages;
DROP POLICY IF EXISTS "管理员可以删除任何消息" ON public.messages;

-- 5. 删除 message_reactions 表的所有策略
DROP POLICY IF EXISTS "用户可以查看消息反应" ON public.message_reactions;
DROP POLICY IF EXISTS "用户可以添加反应" ON public.message_reactions;
DROP POLICY IF EXISTS "用户可以删除自己的反应" ON public.message_reactions;

-- 6. 删除 file_metadata 表的所有策略
DROP POLICY IF EXISTS "成员可以查看聊天室文件" ON public.file_metadata;
DROP POLICY IF EXISTS "成员可以上传文件" ON public.file_metadata;
DROP POLICY IF EXISTS "上传者可以删除自己的文件" ON public.file_metadata;

-- 7. 删除 notifications 表的所有策略
DROP POLICY IF EXISTS "用户只能查看自己的通知" ON public.notifications;
DROP POLICY IF EXISTS "允许创建通知" ON public.notifications;
DROP POLICY IF EXISTS "用户只能更新自己的通知" ON public.notifications;
DROP POLICY IF EXISTS "用户只能删除自己的通知" ON public.notifications;

-- ============================================
-- 完成提示
-- ============================================
SELECT '✅ 所有 RLS 策略已清理完成' AS status;
SELECT '📝 现在可以执行 rls_policies.sql 脚本重新创建策略' AS next_step;
