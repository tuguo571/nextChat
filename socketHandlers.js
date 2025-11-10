/**
 * Socket.IO 事件处理器
 * 处理认证、房间管理、消息广播等
 */

const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto')

// {{ AURA: Modify - 只使用 ANON_KEY，通过 RLS 策略实现权限控制 }}
// 初始化 Supabase 客户端（用于所有操作）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// {{ AURA: Add - 创建带用户 token 的 Supabase 客户端 }}
function getSupabaseClient(userToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    }
  )
}

// 存储用户 socket 映射
const userSockets = new Map() // userId -> socket.id
const socketUsers = new Map() // socket.id -> { userId, email, token }
// {{ AURA: Add - 缓存系统管理员权限，减少数据库查询 }}
const adminCache = new Map() // userId -> { isAdmin, timestamp }
const ADMIN_CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存
// {{ AURA: Add - 在线用户状态跟踪 }}
const onlineUsers = new Map() // roomId -> Set<userId>
const userLastSeen = new Map() // userId -> timestamp

/**
 * 验证 JWT Token 并获取用户信息
 */
async function verifyToken(token) {
  try {
    // {{ AURA: Modify - 使用 supabase 验证用户 token }}
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      console.error('❌ Token 验证失败:', error?.message)
      return null
    }

    return user
  } catch (error) {
    console.error('❌ Token 验证异常:', error)
    return null
  }
}

/**
 * {{ AURA: Modify - 使用带用户 token 的客户端检查管理员（基于 RLS） }}
 */
async function checkSystemAdmin(userToken) {
  console.log(`🔍 [checkSystemAdmin] 检查用户是否是系统管理员...`)
  
  try {
    // {{ AURA: Modify - 使用带用户认证的客户端 }}
    const userSupabase = getSupabaseClient(userToken)
    
    // 获取当前用户信息
    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user) {
      console.error(`❌ [checkSystemAdmin] 获取用户失败:`, authError)
      return false
    }
    
    const userId = user.id
    
    // 检查缓存
    const cached = adminCache.get(userId)
    if (cached && (Date.now() - cached.timestamp) < ADMIN_CACHE_TTL) {
      console.log(`✅ [checkSystemAdmin] 使用缓存结果: ${cached.isAdmin}`)
      return cached.isAdmin
    }

    console.log(`🔍 [checkSystemAdmin] 查询数据库，用户ID: ${userId}`)
    
    // {{ AURA: Modify - 通过 RLS 策略查询（会自动应用权限） }}
    const { data: userData, error } = await userSupabase
      .from('users')
      .select('id, email, nickname, is_admin')
      .eq('id', userId)
      .single()

    console.log(`🔍 [checkSystemAdmin] 数据库查询结果:`, {
      hasData: !!userData,
      hasError: !!error,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details
      } : null,
      userData: userData
    })

    if (error) {
      console.error(`❌ [checkSystemAdmin] 数据库查询失败:`, error)
      return false
    }

    if (!userData) {
      console.error(`❌ [checkSystemAdmin] 未找到用户: ${userId}`)
      return false
    }

    const isAdmin = userData.is_admin === true
    console.log(`🔍 [checkSystemAdmin] 用户 ${userData.email} (${userData.nickname}) 的管理员状态: ${isAdmin}`)
    
    // 更新缓存
    adminCache.set(userId, {
      isAdmin,
      timestamp: Date.now()
    })

    return isAdmin
  } catch (error) {
    console.error('❌ [checkSystemAdmin] 检查系统管理员身份异常:', error)
    return false
  }
}

/**
 * 验证用户是否是房间成员
 * {{ AURA: Modify - 基于 RLS 策略的权限检查 }}
 */
async function verifyRoomMembership(userToken, roomId) {
  console.log(`🔍 [verifyRoomMembership] 开始验证房间 ${roomId} 的成员身份...`)
  try {
    // {{ AURA: Modify - 使用带用户认证的客户端 }}
    const userSupabase = getSupabaseClient(userToken)
    
    // 获取当前用户信息
    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    
    if (authError || !user) {
      console.error(`❌ [verifyRoomMembership] 获取用户失败:`, authError)
      return { isMember: false, role: null, isSystemAdmin: false }
    }
    
    const userId = user.id
    
    // {{ AURA: Modify - 先检查系统管理员身份 }}
    const isSystemAdmin = await checkSystemAdmin(userToken)
    console.log(`🔍 [verifyRoomMembership] 系统管理员检查结果: ${isSystemAdmin}`)
    
    if (isSystemAdmin) {
      console.log(`✅ [verifyRoomMembership] 系统管理员 ${userId} 自动获得房间 ${roomId} 的访问权限`)
      return { isMember: true, role: 'admin', isSystemAdmin: true }
    }

    console.log(`🔍 [verifyRoomMembership] 用户 ${userId} 不是系统管理员，检查房间成员身份...`)
    // {{ AURA: Modify - 通过 RLS 策略查询房间成员 }}
    const { data, error } = await userSupabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single()

    console.log(`🔍 [verifyRoomMembership] 房间成员查询结果:`, {
      hasData: !!data,
      hasError: !!error,
      error: error ? { message: error.message, code: error.code } : null,
      data: data
    })

    if (error) {
      // PGRST116 表示没有找到记录
      if (error.code === 'PGRST116') {
        console.log(`❌ [verifyRoomMembership] 用户 ${userId} 不是房间 ${roomId} 的成员`)
        return { isMember: false, role: null, isSystemAdmin: false }
      }
      console.error(`❌ [verifyRoomMembership] 查询房间成员失败:`, error)
      return { isMember: false, role: null, isSystemAdmin: false }
    }

    if (!data) {
      console.log(`❌ [verifyRoomMembership] 用户 ${userId} 不是房间 ${roomId} 的成员`)
      return { isMember: false, role: null, isSystemAdmin: false }
    }

    console.log(`✅ [verifyRoomMembership] 用户 ${userId} 是房间 ${roomId} 的成员，角色: ${data.role}`)
    return { isMember: true, role: data.role, isSystemAdmin: false }
  } catch (error) {
    console.error('❌ [verifyRoomMembership] 验证房间成员身份异常:', error)
    return { isMember: false, role: null, isSystemAdmin: false }
  }
}

/**
 * 保存消息到数据库
 * {{ AURA: Modify - 使用带用户认证的客户端 }}
 */
async function saveMessage(messageData, userToken) {
  try {
    // {{ AURA: Modify - 使用带用户认证的客户端 }}
    const userSupabase = getSupabaseClient(userToken)
    
    const { data, error } = await userSupabase
      .from('messages')
      .insert({
        room_id: messageData.roomId,
        user_id: messageData.userId,
        content: messageData.content,
        message_type: messageData.messageType || 'text',
        reply_to: messageData.replyTo,
        file_url: messageData.fileUrl,
        file_name: messageData.fileName,
        file_size: messageData.fileSize,
      })
      .select(`
        *,
        users:user_id (
          id,
          nickname,
          avatar_url
        )
      `)
      .single()

    if (error) {
      console.error('❌ 保存消息失败:', error)
      return null
    }

    // {{ AURA: Add - 如果是回复消息，查询被回复的消息详情 }}
    if (data && data.reply_to) {
      const { data: replyMessage } = await userSupabase
        .from('messages')
        .select(`
          id,
          content,
          message_type,
          file_url,
          file_name,
          created_at,
          users:user_id (
            id,
            nickname,
            avatar_url
          )
        `)
        .eq('id', data.reply_to)
        .single()

      if (replyMessage) {
        data.reply_message = replyMessage
      }
    }

    return data
  } catch (error) {
    console.error('❌ 保存消息异常:', error)
    return null
  }
}

/**
 * 设置 Socket.IO 事件处理器
 */
function setupSocketHandlers(io) {
  console.log('🔌 初始化 Socket.IO 事件处理器...')

  // 连接建立
  io.on('connection', (socket) => {
    console.log(`🔗 新连接: ${socket.id}`)

    // 认证事件
    socket.on('authenticate', async (token, callback) => {
      try {
        // 验证 token
        const user = await verifyToken(token)
        
        if (!user) {
          const error = { code: 'AUTH_FAILED', message: '认证失败' }
          if (callback) callback(error)
          socket.emit('error', error)
          socket.disconnect()
          return
        }

        // {{ AURA: Modify - 存储用户信息和 token }}
        socket.userId = user.id
        socket.userEmail = user.email
        socket.userToken = token  // 保存 token 以便后续使用
        userSockets.set(user.id, socket.id)
        socketUsers.set(socket.id, { userId: user.id, email: user.email, token: token })

        console.log(`✅ 用户认证成功: ${user.email} (${user.id})`)
        console.log(`👥 当前在线: ${socketUsers.size} 个用户`)

        // 响应认证成功
        const response = { userId: user.id, email: user.email }
        if (callback) callback(null, response)
        socket.emit('authenticated', response)

      } catch (error) {
        console.error('❌ 认证异常:', error)
        const err = { code: 'AUTH_ERROR', message: '认证过程出错' }
        if (callback) callback(err)
        socket.emit('error', err)
      }
    })

    // 加入房间
    // {{ AURA: Modify - 修复参数顺序，支持可选的管理员标识 }}
    socket.on('join-room', async (roomId, callbackOrAdminFlag, maybeCallback) => {
      try {
        // {{ AURA: Add - 智能解析参数，兼容不同的调用方式 }}
        let callback = null
        let adminFlag = null
        
        // 如果第二个参数是函数，则为 callback；否则为 adminFlag
        if (typeof callbackOrAdminFlag === 'function') {
          callback = callbackOrAdminFlag
          adminFlag = maybeCallback
        } else {
          callback = maybeCallback
          adminFlag = callbackOrAdminFlag
        }

        console.log(`🔍 收到 join-room 请求:`, {
          roomId,
          userId: socket.userId,
          userEmail: socket.userEmail,
          adminFlag,
          hasCallback: !!callback
        })

        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          console.error('❌ 用户未认证:', error)
          if (callback) callback(error)
          return
        }

        // {{ AURA: Add - 处理客户端传递的系统管理员标识 }}
        let isSystemAdmin = false
        if (typeof adminFlag === 'object' && adminFlag.isSystemAdmin) {
          console.log(`🔑 客户端声称是系统管理员，进行验证...`)
          // {{ AURA: Modify - 使用 userToken 验证 }}
          isSystemAdmin = await checkSystemAdmin(socket.userToken)
          if (isSystemAdmin) {
            console.log(`🚀 快速验证：系统管理员 ${socket.userEmail} 加入房间 ${roomId}`)
          } else {
            console.warn(`⚠️ 客户端错误声称是系统管理员: ${socket.userId}`)
          }
        }

        console.log(`🔍 开始验证房间成员身份...`)
        // {{ AURA: Modify - 验证房间成员身份，传递 userToken }}
        const membership = await verifyRoomMembership(socket.userToken, roomId)
        console.log(`🔍 房间成员验证结果:`, membership)
        const { isMember, role } = membership
        
        // {{ AURA: Modify - 正确合并管理员验证结果，使用 OR 逻辑 }}
        isSystemAdmin = isSystemAdmin || membership.isSystemAdmin
        
        console.log(`🔍 最终验证结果:`, {
          isMember,
          isSystemAdmin,
          role,
          userId: socket.userId,
          userEmail: socket.userEmail
        })
        
        // {{ AURA: Modify - 系统管理员跳过成员检查 }}
        if (!isMember && !isSystemAdmin) {
          const error = { code: 'NOT_MEMBER', message: '您不是该房间的成员' }
          console.error(`❌ 用户 ${socket.userId} 不是房间 ${roomId} 的成员`)
          if (callback) callback(error)
          socket.emit('error', error)
          return
        }
        
        // {{ AURA: Add - 系统管理员自动绕过成员检查 }}
        if (isSystemAdmin) {
          console.log(`🔑 系统管理员 ${socket.userEmail} 自动获得房间 ${roomId} 访问权限`)
        }

        // 加入 Socket.IO 房间
        await socket.join(roomId)

        // {{ AURA: Add - 更新在线用户状态 }}
        if (!onlineUsers.has(roomId)) {
          onlineUsers.set(roomId, new Set())
        }
        onlineUsers.get(roomId).add(socket.userId)
        userLastSeen.set(socket.userId, Date.now())

        const userType = isSystemAdmin ? '系统管理员' : '用户'
        console.log(`🔔 ${userType} ${socket.userEmail} 加入房间 ${roomId}`)
        
        // 获取房间成员数
        const sockets = await io.in(roomId).fetchSockets()
        console.log(`📊 房间 ${roomId} 在线成员: ${sockets.length} 人`)

        // {{ AURA: Add - 获取在线用户列表 }}
        const onlineUserIds = Array.from(onlineUsers.get(roomId) || [])

        // {{ AURA: Modify - 响应中包含系统管理员标识和在线用户 }}
        const response = { 
          roomId, 
          role, 
          memberCount: sockets.length, 
          isSystemAdmin,
          onlineUsers: onlineUserIds
        }
        console.log(`🔍 发送成功响应:`, response)
        if (callback) callback(null, response)

        // 通知房间其他成员
        socket.to(roomId).emit('user-joined', {
          userId: socket.userId,
          email: socket.userEmail,
          roomId,
          isSystemAdmin,
          timestamp: new Date().toISOString(),
        })

        // {{ AURA: Add - 广播在线用户列表更新 }}
        io.to(roomId).emit('online-users-updated', {
          roomId,
          onlineUsers: onlineUserIds,
          timestamp: new Date().toISOString(),
        })

      } catch (error) {
        console.error('❌ 加入房间异常:', error)
        const err = { code: 'JOIN_ERROR', message: '加入房间失败' }
        if (callback) callback(err)
      }
    })

    // 离开房间
    socket.on('leave-room', async (roomId, callback) => {
      try {
        await socket.leave(roomId)
        
        // {{ AURA: Add - 更新在线用户状态 }}
        if (onlineUsers.has(roomId)) {
          onlineUsers.get(roomId).delete(socket.userId)
          if (onlineUsers.get(roomId).size === 0) {
            onlineUsers.delete(roomId)
          }
        }
        userLastSeen.set(socket.userId, Date.now())
        
        console.log(`🔕 用户 ${socket.userEmail} 离开房间 ${roomId}`)

        // 响应成功
        if (callback) callback(null, { roomId })

        // 通知房间其他成员
        socket.to(roomId).emit('user-left', {
          userId: socket.userId,
          email: socket.userEmail,
          roomId,
          timestamp: new Date().toISOString(),
        })

        // {{ AURA: Add - 广播在线用户列表更新 }}
        const onlineUserIds = Array.from(onlineUsers.get(roomId) || [])
        socket.to(roomId).emit('online-users-updated', {
          roomId,
          onlineUsers: onlineUserIds,
          timestamp: new Date().toISOString(),
        })

      } catch (error) {
        console.error('❌ 离开房间异常:', error)
        const err = { code: 'LEAVE_ERROR', message: '离开房间失败' }
        if (callback) callback(err)
      }
    })

    // 发送消息
    socket.on('send-message', async (messageData, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { roomId, content, messageType, replyTo, fileUrl, fileName, fileSize } = messageData

        // 验证是否在房间中
        const rooms = Array.from(socket.rooms)
        if (!rooms.includes(roomId)) {
          const error = { code: 'NOT_IN_ROOM', message: '请先加入房间' }
          if (callback) callback(error)
          return
        }

        // 保存消息到数据库
        // {{ AURA: Modify - 传递 userToken }}
        const savedMessage = await saveMessage({
          roomId,
          userId: socket.userId,
          content,
          messageType,
          replyTo,
          fileUrl,
          fileName,
          fileSize,
        }, socket.userToken)

        if (!savedMessage) {
          const error = { code: 'SAVE_FAILED', message: '消息保存失败' }
          if (callback) callback(error)
          return
        }

        // 构造广播消息
        // {{ AURA: Modify - 包含被回复消息的详情 }}
        const broadcastMessage = {
          id: savedMessage.id,
          roomId: savedMessage.room_id,
          userId: savedMessage.user_id,
          content: savedMessage.content,
          messageType: savedMessage.message_type,
          replyTo: savedMessage.reply_to,
          replyMessage: savedMessage.reply_message, // 被回复的消息详情
          fileUrl: savedMessage.file_url,
          fileName: savedMessage.file_name,
          fileSize: savedMessage.file_size,
          isEdited: savedMessage.is_edited,
          createdAt: savedMessage.created_at,
          user: savedMessage.users,
        }

        console.log(`💬 消息发送: ${socket.userEmail} -> 房间 ${roomId}`)

        // 广播消息到房间（包括发送者）
        io.to(roomId).emit('message', broadcastMessage)

        // {{ AURA: Add - 处理消息中的@提及 }}
        if (messageData.mentionedUserIds && messageData.mentionedUserIds.length > 0) {
          try {
            const userSupabase = getSupabaseClient(socket.userToken)
            
            // 保存提及记录到数据库
            const mentions = messageData.mentionedUserIds.map(userId => ({
              message_id: savedMessage.id,
              mentioned_user_id: userId,
              is_read: false,
            }))

            const { error: mentionError } = await userSupabase
              .from('message_mentions')
              .insert(mentions)

            if (mentionError) {
              console.error('❌ 保存提及失败:', mentionError)
            } else {
              // 获取被提及用户的信息
              const { data: mentionedUsers } = await userSupabase
                .from('users')
                .select('id, nickname')
                .in('id', messageData.mentionedUserIds)

              // 向每个被提及的用户发送通知
              messageData.mentionedUserIds.forEach(userId => {
                const targetSocket = userSockets.get(userId)
                if (targetSocket) {
                  const mentionedUser = mentionedUsers?.find(u => u.id === userId)
                  io.to(targetSocket).emit('mention-notification', {
                    messageId: savedMessage.id,
                    roomId: savedMessage.room_id,
                    fromUser: {
                      id: socket.userId,
                      nickname: savedMessage.users?.nickname || socket.userEmail,
                    },
                    content: savedMessage.content,
                    createdAt: savedMessage.created_at,
                  })
                  console.log(`📢 提及通知已发送: ${mentionedUser?.nickname || userId}`)
                }
              })
            }
          } catch (mentionError) {
            console.error('❌ 处理提及异常:', mentionError)
          }
        }

        // 响应成功
        if (callback) callback(null, { messageId: savedMessage.id })

      } catch (error) {
        console.error('❌ 发送消息异常:', error)
        const err = { code: 'SEND_ERROR', message: '发送消息失败' }
        if (callback) callback(err)
      }
    })

    // 正在输入
    socket.on('typing', (roomId) => {
      if (socket.userId) {
        socket.to(roomId).emit('user-typing', {
          userId: socket.userId,
          email: socket.userEmail,
          roomId,
        })
      }
    })

    // 停止输入
    socket.on('stop-typing', (roomId) => {
      if (socket.userId) {
        socket.to(roomId).emit('user-stop-typing', {
          userId: socket.userId,
          roomId,
        })
      }
    })

    // {{ AURA: Add - 标记消息已读 }}
    socket.on('mark-message-read', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageId, roomId } = data

        // 保存已读记录
        const userSupabase = getSupabaseClient(socket.userToken)
        const { error: insertError } = await userSupabase
          .from('message_reads')
          .upsert({
            message_id: messageId,
            user_id: socket.userId,
            read_at: new Date().toISOString(),
          }, {
            onConflict: 'message_id,user_id',
          })

        if (insertError) {
          console.error('❌ 保存已读记录失败:', insertError)
          const error = { code: 'SAVE_FAILED', message: '标记已读失败' }
          if (callback) callback(error)
          return
        }

        console.log(`📖 用户 ${socket.userEmail} 已读消息 ${messageId}`)

        // 广播已读回执到房间（不包括自己）
        socket.to(roomId).emit('message-read', {
          messageId,
          userId: socket.userId,
          readAt: new Date().toISOString(),
        })

        if (callback) callback(null, { success: true })

      } catch (error) {
        console.error('❌ 标记消息已读异常:', error)
        const err = { code: 'READ_ERROR', message: '标记已读失败' }
        if (callback) callback(err)
      }
    })

    // {{ AURA: Add - 批量标记消息已读 }}
    socket.on('mark-messages-read', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageIds, roomId } = data

        if (!messageIds || messageIds.length === 0) {
          if (callback) callback(null, { success: true })
          return
        }

        // 批量保存已读记录
        const userSupabase = getSupabaseClient(socket.userToken)
        const now = new Date().toISOString()
        const reads = messageIds.map(messageId => ({
          message_id: messageId,
          user_id: socket.userId,
          read_at: now,
        }))

        const { error: insertError } = await userSupabase
          .from('message_reads')
          .upsert(reads, {
            onConflict: 'message_id,user_id',
          })

        if (insertError) {
          console.error('❌ 批量保存已读记录失败:', insertError)
          const error = { code: 'SAVE_FAILED', message: '批量标记已读失败' }
          if (callback) callback(error)
          return
        }

        console.log(`📖 用户 ${socket.userEmail} 批量已读 ${messageIds.length} 条消息`)

        // 为每条消息广播已读回执
        messageIds.forEach(messageId => {
          socket.to(roomId).emit('message-read', {
            messageId,
            userId: socket.userId,
            readAt: now,
          })
        })

        if (callback) callback(null, { success: true, count: messageIds.length })

      } catch (error) {
        console.error('❌ 批量标记消息已读异常:', error)
        const err = { code: 'READ_ERROR', message: '批量标记已读失败' }
        if (callback) callback(err)
      }
    })

    // {{ AURA: Add - 删除消息 }}
    socket.on('delete-message', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageId, roomId } = data

        // 获取消息信息
        const userSupabase = getSupabaseClient(socket.userToken)
        const { data: message, error: fetchError } = await userSupabase
          .from('messages')
          .select('user_id, room_id')
          .eq('id', messageId)
          .single()

        if (fetchError || !message) {
          const error = { code: 'NOT_FOUND', message: '消息不存在' }
          if (callback) callback(error)
          return
        }

        // 检查权限：是消息发送者或系统管理员
        const isSystemAdmin = await checkSystemAdmin(socket.userToken)
        if (message.user_id !== socket.userId && !isSystemAdmin) {
          const error = { code: 'FORBIDDEN', message: '无权删除此消息' }
          if (callback) callback(error)
          return
        }

        // 删除消息
        const { error: deleteError } = await userSupabase
          .from('messages')
          .delete()
          .eq('id', messageId)

        if (deleteError) {
          console.error('❌ 删除消息失败:', deleteError)
          const error = { code: 'DELETE_FAILED', message: '删除消息失败' }
          if (callback) callback(error)
          return
        }

        console.log(`🗑️ 消息已删除: ${messageId} by ${socket.userEmail}`)

        // 广播删除事件到房间
        io.to(roomId).emit('message-deleted', {
          messageId,
          roomId,
          deletedBy: socket.userId,
          timestamp: new Date().toISOString(),
        })

        if (callback) callback(null, { success: true })

      } catch (error) {
        console.error('❌ 删除消息异常:', error)
        const err = { code: 'DELETE_ERROR', message: '删除消息失败' }
        if (callback) callback(err)
      }
    })

    // {{ AURA: Add - 编辑消息 }}
    socket.on('edit-message', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageId, newContent, roomId } = data

        // 获取消息信息
        const userSupabase = getSupabaseClient(socket.userToken)
        const { data: message, error: fetchError } = await userSupabase
          .from('messages')
          .select('user_id, room_id')
          .eq('id', messageId)
          .single()

        if (fetchError || !message) {
          const error = { code: 'NOT_FOUND', message: '消息不存在' }
          if (callback) callback(error)
          return
        }

        // 检查权限：只能编辑自己的消息
        if (message.user_id !== socket.userId) {
          const error = { code: 'FORBIDDEN', message: '只能编辑自己的消息' }
          if (callback) callback(error)
          return
        }

        // 更新消息
        const { data: updatedMessage, error: updateError } = await userSupabase
          .from('messages')
          .update({
            content: newContent,
            is_edited: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', messageId)
          .select()
          .single()

        if (updateError) {
          console.error('❌ 编辑消息失败:', updateError)
          const error = { code: 'UPDATE_FAILED', message: '编辑消息失败' }
          if (callback) callback(error)
          return
        }

        console.log(`✏️ 消息已编辑: ${messageId} by ${socket.userEmail}`)

        // 广播编辑事件到房间
        io.to(roomId).emit('message-edited', {
          messageId,
          newContent,
          roomId,
          editedBy: socket.userId,
          timestamp: new Date().toISOString(),
        })

        if (callback) callback(null, { success: true, message: updatedMessage })

      } catch (error) {
        console.error('❌ 编辑消息异常:', error)
        const err = { code: 'EDIT_ERROR', message: '编辑消息失败' }
        if (callback) callback(err)
      }
    })

    // {{ AURA: Add - 添加消息反应 }}
    socket.on('add-reaction', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageId, emoji, roomId } = data

        const userSupabase = getSupabaseClient(socket.userToken)
        
        // 添加反应
        const { data: reaction, error: insertError } = await userSupabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: socket.userId,
            emoji: emoji,
          })
          .select()
          .single()

        if (insertError) {
          // 如果是唯一约束错误，说明已经添加过了
          if (insertError.code === '23505') {
            const error = { code: 'ALREADY_EXISTS', message: '已经添加过该反应' }
            if (callback) callback(error)
            return
          }
          console.error('❌ 添加反应失败:', insertError)
          const error = { code: 'INSERT_FAILED', message: '添加反应失败' }
          if (callback) callback(error)
          return
        }

        console.log(`👍 反应已添加: ${emoji} to ${messageId} by ${socket.userEmail}`)

        // 广播反应事件到房间
        io.to(roomId).emit('reaction-added', {
          messageId,
          emoji,
          userId: socket.userId,
          roomId,
          timestamp: new Date().toISOString(),
        })

        if (callback) callback(null, { success: true, reaction })

      } catch (error) {
        console.error('❌ 添加反应异常:', error)
        const err = { code: 'REACTION_ERROR', message: '添加反应失败' }
        if (callback) callback(err)
      }
    })

    // {{ AURA: Add - 移除消息反应 }}
    socket.on('remove-reaction', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageId, emoji, roomId } = data

        const userSupabase = getSupabaseClient(socket.userToken)
        
        // 移除反应
        const { error: deleteError } = await userSupabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', socket.userId)
          .eq('emoji', emoji)

        if (deleteError) {
          console.error('❌ 移除反应失败:', deleteError)
          const error = { code: 'DELETE_FAILED', message: '移除反应失败' }
          if (callback) callback(error)
          return
        }

        console.log(`👎 反应已移除: ${emoji} from ${messageId} by ${socket.userEmail}`)

        // 广播反应移除事件到房间
        io.to(roomId).emit('reaction-removed', {
          messageId,
          emoji,
          userId: socket.userId,
          roomId,
          timestamp: new Date().toISOString(),
        })

        if (callback) callback(null, { success: true })

      } catch (error) {
        console.error('❌ 移除反应异常:', error)
        const err = { code: 'REACTION_ERROR', message: '移除反应失败' }
        if (callback) callback(err)
      }
    })

    // {{ AURA: Add - 置顶消息 }}
    socket.on('pin-message', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageId, roomId } = data

        // 检查权限：房间管理员或系统管理员
        const membership = await verifyRoomMembership(socket.userToken, roomId)
        if (!membership.isSystemAdmin && membership.role !== 'admin') {
          const error = { code: 'FORBIDDEN', message: '只有管理员可以置顶消息' }
          if (callback) callback(error)
          return
        }

        const userSupabase = getSupabaseClient(socket.userToken)
        
        // 置顶消息
        const { data: pinnedMessage, error: updateError } = await userSupabase
          .from('messages')
          .update({
            is_pinned: true,
            pinned_at: new Date().toISOString(),
            pinned_by: socket.userId,
          })
          .eq('id', messageId)
          .eq('room_id', roomId)
          .select(`
            *,
            users:user_id (
              id,
              nickname,
              avatar_url
            ),
            pinner:pinned_by (
              id,
              nickname,
              avatar_url
            )
          `)
          .single()

        if (updateError) {
          console.error('❌ 置顶消息失败:', updateError)
          const error = { code: 'PIN_FAILED', message: '置顶消息失败' }
          if (callback) callback(error)
          return
        }

        console.log(`📌 消息已置顶: ${messageId} by ${socket.userEmail}`)

        // 广播置顶事件到房间
        io.to(roomId).emit('message-pinned', {
          messageId,
          roomId,
          pinnedBy: socket.userId,
          pinnedAt: pinnedMessage.pinned_at,
          message: pinnedMessage,
          timestamp: new Date().toISOString(),
        })

        if (callback) callback(null, { success: true, message: pinnedMessage })

      } catch (error) {
        console.error('❌ 置顶消息异常:', error)
        const err = { code: 'PIN_ERROR', message: '置顶消息失败' }
        if (callback) callback(err)
      }
    })

    // {{ AURA: Add - 取消置顶消息 }}
    socket.on('unpin-message', async (data, callback) => {
      try {
        if (!socket.userId) {
          const error = { code: 'NOT_AUTHENTICATED', message: '请先认证' }
          if (callback) callback(error)
          return
        }

        const { messageId, roomId } = data

        // 检查权限：房间管理员或系统管理员
        const membership = await verifyRoomMembership(socket.userToken, roomId)
        if (!membership.isSystemAdmin && membership.role !== 'admin') {
          const error = { code: 'FORBIDDEN', message: '只有管理员可以取消置顶' }
          if (callback) callback(error)
          return
        }

        const userSupabase = getSupabaseClient(socket.userToken)
        
        // 取消置顶
        const { error: updateError } = await userSupabase
          .from('messages')
          .update({
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
          })
          .eq('id', messageId)
          .eq('room_id', roomId)

        if (updateError) {
          console.error('❌ 取消置顶失败:', updateError)
          const error = { code: 'UNPIN_FAILED', message: '取消置顶失败' }
          if (callback) callback(error)
          return
        }

        console.log(`📌 已取消置顶: ${messageId} by ${socket.userEmail}`)

        // 广播取消置顶事件到房间
        io.to(roomId).emit('message-unpinned', {
          messageId,
          roomId,
          unpinnedBy: socket.userId,
          timestamp: new Date().toISOString(),
        })

        if (callback) callback(null, { success: true })

      } catch (error) {
        console.error('❌ 取消置顶异常:', error)
        const err = { code: 'UNPIN_ERROR', message: '取消置顶失败' }
        if (callback) callback(err)
      }
    })

    // 断开连接
    socket.on('disconnect', (reason) => {
      console.log(`🔌 连接断开: ${socket.id}, 原因: ${reason}`)
      
      if (socket.userId) {
        // {{ AURA: Add - 清理在线状态 }}
        for (const [roomId, users] of onlineUsers.entries()) {
          if (users.has(socket.userId)) {
            users.delete(socket.userId)
            // 通知房间其他成员用户离线
            io.to(roomId).emit('user-offline', {
              userId: socket.userId,
              roomId,
              timestamp: new Date().toISOString(),
            })
            // 更新在线用户列表
            io.to(roomId).emit('online-users-updated', {
              roomId,
              onlineUsers: Array.from(users),
              timestamp: new Date().toISOString(),
            })
          }
        }
        userLastSeen.set(socket.userId, Date.now())
        
        userSockets.delete(socket.userId)
        socketUsers.delete(socket.id)
        // {{ AURA: Add - 清理过期的管理员缓存 }}
        if (adminCache.size > 100) { // 防止缓存过大
          const now = Date.now()
          for (const [userId, cached] of adminCache.entries()) {
            if (now - cached.timestamp > ADMIN_CACHE_TTL) {
              adminCache.delete(userId)
            }
          }
        }
        console.log(`👥 当前在线: ${socketUsers.size} 个用户`)
      }
    })

    // 错误处理
    socket.on('error', (error) => {
      console.error('❌ Socket 错误:', error)
    })
  })

  console.log('✅ Socket.IO 事件处理器初始化完成')
}

module.exports = { setupSocketHandlers }
