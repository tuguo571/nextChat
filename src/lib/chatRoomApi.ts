import { supabase } from './supabase'
import type { ChatRoom, RoomMember } from '@/types'

/**
 * 聊天室管理API
 * 提供聊天室的CRUD操作和成员管理功能
 */

// ==================== 聊天室CRUD ====================

/**
 * 创建新聊天室
 * @param name 聊天室名称
 * @param description 聊天室描述（可选）
 * @returns 创建的聊天室信息或错误
 */
export async function createChatRoom(name: string, description?: string) {
  try {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // 创建聊天室
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        name,
        description,
        creator_id: user.id,
      })
      .select()
      .single()

    if (roomError) throw roomError

    // 将创建者自动添加为管理员
    const { error: memberError } = await supabase
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberError) throw memberError

    return { data: room, error: null }
  } catch (error) {
    console.error('创建聊天室失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 获取用户加入的所有聊天室
 * {{ AURA: Modify - 系统管理员可以查看所有聊天室 }}
 * @returns 聊天室列表或错误
 */
export async function getUserChatRooms() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // {{ AURA: Add - 检查是否是系统管理员 }}
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isSystemAdmin = userProfile?.is_admin === true

    // {{ AURA: Modify - 系统管理员查看所有聊天室 }}
    if (isSystemAdmin) {
      console.log('🔑 系统管理员获取所有聊天室')
      
      const { data: allRooms, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('last_activity_at', { ascending: false })

      if (roomError) throw roomError

      // 获取成员数量
      const roomIds = allRooms?.map(r => r.id) || []
      const memberCounts: Record<string, number> = {}
      
      if (roomIds.length > 0) {
        const { data: counts } = await supabase
          .from('room_members')
          .select('room_id')
          .in('room_id', roomIds)
        
        counts?.forEach(item => {
          memberCounts[item.room_id] = (memberCounts[item.room_id] || 0) + 1
        })
      }

      const rooms = allRooms?.map(room => ({
        ...room,
        userRole: 'admin' as const, // 系统管理员在所有房间都是管理员
        member_count: memberCounts[room.id] || 0,
      })) || []

      return { data: rooms, error: null }
    }

    // {{ AURA: Modify - 普通用户查询加入的聊天室 }}
    const { data: memberships, error: memberError } = await supabase
      .from('room_members')
      .select(`
        room_id,
        role,
        joined_at,
        chat_rooms (
          id,
          name,
          description,
          creator_id,
          last_activity_at,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (memberError) throw memberError

    // 转换数据格式并获取成员数量
    const roomIds = memberships?.map(m => m.room_id) || []
    
    // 批量获取每个聊天室的成员数量
    const memberCounts: Record<string, number> = {}
    if (roomIds.length > 0) {
      const { data: counts } = await supabase
        .from('room_members')
        .select('room_id')
        .in('room_id', roomIds)
      
      counts?.forEach(item => {
        memberCounts[item.room_id] = (memberCounts[item.room_id] || 0) + 1
      })
    }

    const rooms = memberships?.map(m => ({
      ...(m.chat_rooms as any),
      userRole: m.role,
      member_count: memberCounts[m.room_id] || 0,
    })) || []

    return { data: rooms, error: null }
  } catch (error) {
    console.error('获取聊天室列表失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 获取单个聊天室详情
 * @param roomId 聊天室ID
 * @returns 聊天室详情或错误
 */
export async function getChatRoom(roomId: string) {
  try {
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        creator:users!creator_id (id, nickname, avatar_url)
      `)
      .eq('id', roomId)
      .single()

    if (error) throw error

    return { data: room, error: null }
  } catch (error) {
    console.error('获取聊天室详情失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 搜索公开聊天室
 * @param keyword 搜索关键词
 * @returns 聊天室列表或错误
 */
export async function searchChatRooms(keyword: string) {
  try {
    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    // 获取每个聊天室的成员数量
    const roomIds = rooms?.map(r => r.id) || []
    const memberCounts: Record<string, number> = {}
    
    if (roomIds.length > 0) {
      const { data: counts } = await supabase
        .from('room_members')
        .select('room_id')
        .in('room_id', roomIds)
      
      counts?.forEach(item => {
        memberCounts[item.room_id] = (memberCounts[item.room_id] || 0) + 1
      })
    }

    // 添加成员数量到结果
    const roomsWithCount = rooms?.map(room => ({
      ...room,
      member_count: memberCounts[room.id] || 0,
    })) || []

    return { data: roomsWithCount, error: null }
  } catch (error) {
    console.error('搜索聊天室失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 更新聊天室信息（仅管理员）
 * {{ AURA: Modify - 系统管理员可以修改任何聊天室 }}
 * @param roomId 聊天室ID
 * @param updates 更新的字段
 * @returns 更新结果或错误
 */
export async function updateChatRoom(
  roomId: string,
  updates: { name?: string; description?: string }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // {{ AURA: Add - 检查系统管理员权限 }}
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isSystemAdmin = userProfile?.is_admin === true

    // {{ AURA: Modify - 非系统管理员需要检查房间管理员权限 }}
    if (!isSystemAdmin) {
      const { data: membership } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single()

      if (membership?.role !== 'admin') {
        return { error: new Error('只有管理员可以修改聊天室信息'), data: null }
      }
    } else {
      console.log('🔑 系统管理员执行修改聊天室操作')
    }

    // 更新聊天室
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .update(updates)
      .eq('id', roomId)
      .select()
      .single()

    if (error) throw error

    return { data: room, error: null }
  } catch (error) {
    console.error('更新聊天室失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 删除聊天室（仅创建者）
 * {{ AURA: Modify - 系统管理员可以删除任何聊天室 }}
 * @param roomId 聊天室ID
 * @returns 删除结果或错误
 */
export async function deleteChatRoom(roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // {{ AURA: Add - 检查系统管理员权限 }}
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isSystemAdmin = userProfile?.is_admin === true

    // {{ AURA: Modify - 非系统管理员需要检查是否是创建者 }}
    if (!isSystemAdmin) {
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('creator_id')
        .eq('id', roomId)
        .single()

      if (room?.creator_id !== user.id) {
        return { error: new Error('只有创建者可以删除聊天室'), data: null }
      }
    } else {
      console.log('🔑 系统管理员执行删除聊天室操作')
    }

    // 删除聊天室（级联删除成员和消息）
    const { error } = await supabase
      .from('chat_rooms')
      .delete()
      .eq('id', roomId)

    if (error) throw error

    return { data: true, error: null }
  } catch (error) {
    console.error('删除聊天室失败:', error)
    return { error: error as Error, data: null }
  }
}

// ==================== 成员管理 ====================

/**
 * 加入聊天室
 * @param roomId 聊天室ID
 * @returns 加入结果或错误
 */
export async function joinChatRoom(roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // {{ AURA: Modify - 检查是否已加入，如果已加入则直接返回成功 }}
    const { data: existing } = await supabase
      .from('room_members')
      .select('id, role')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      console.log('✅ 用户已经是该聊天室的成员')
      return { data: existing, error: null }
    }

    // 加入聊天室
    const { data: membership, error } = await supabase
      .from('room_members')
      .insert({
        room_id: roomId,
        user_id: user.id,
        role: 'member',
      })
      .select()
      .single()

    if (error) throw error

    return { data: membership, error: null }
  } catch (error) {
    console.error('加入聊天室失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 退出聊天室
 * @param roomId 聊天室ID
 * @returns 退出结果或错误
 */
export async function leaveChatRoom(roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // 检查是否是创建者
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('creator_id')
      .eq('id', roomId)
      .single()

    if (room?.creator_id === user.id) {
      return { error: new Error('创建者不能退出聊天室，请删除聊天室'), data: null }
    }

    // 退出聊天室
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    if (error) throw error

    return { data: true, error: null }
  } catch (error) {
    console.error('退出聊天室失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 获取聊天室成员列表
 * {{ AURA: Modify - 添加 is_admin 字段以显示系统管理员 }}
 * @param roomId 聊天室ID
 * @returns 成员列表或错误
 */
export async function getRoomMembers(roomId: string) {
  try {
    const { data: members, error } = await supabase
      .from('room_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        users (
          id,
          nickname,
          avatar_url,
          signature,
          is_admin
        )
      `)
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    if (error) throw error

    return { data: members || [], error: null }
  } catch (error) {
    console.error('获取成员列表失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 添加成员到聊天室（仅管理员）
 * {{ AURA: Modify - 系统管理员拥有所有房间的管理权限 }}
 * @param roomId 聊天室ID
 * @param userId 要添加的用户ID
 * @returns 添加结果或错误
 */
export async function addRoomMember(roomId: string, userId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // {{ AURA: Add - 检查系统管理员权限 }}
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isSystemAdmin = userProfile?.is_admin === true

    // {{ AURA: Modify - 非系统管理员需要检查房间管理员权限 }}
    if (!isSystemAdmin) {
      const { data: membership } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single()

      if (membership?.role !== 'admin') {
        return { error: new Error('只有管理员可以添加成员'), data: null }
      }
    } else {
      console.log('🔑 系统管理员执行添加成员操作')
    }

    // 添加成员
    const { data: newMember, error } = await supabase
      .from('room_members')
      .insert({
        room_id: roomId,
        user_id: userId,
        role: 'member',
      })
      .select()
      .single()

    if (error) throw error

    return { data: newMember, error: null }
  } catch (error) {
    console.error('添加成员失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 移除聊天室成员（仅管理员）
 * {{ AURA: Modify - 系统管理员拥有所有房间的管理权限 }}
 * @param roomId 聊天室ID
 * @param userId 要移除的用户ID
 * @returns 移除结果或错误
 */
export async function removeRoomMember(roomId: string, userId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // {{ AURA: Add - 检查系统管理员权限 }}
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isSystemAdmin = userProfile?.is_admin === true

    // {{ AURA: Modify - 非系统管理员需要检查房间管理员权限 }}
    if (!isSystemAdmin) {
      const { data: membership } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single()

      if (membership?.role !== 'admin') {
        return { error: new Error('只有管理员可以移除成员'), data: null }
      }
    } else {
      console.log('🔑 系统管理员执行移除成员操作')
    }

    // 不能移除创建者
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('creator_id')
      .eq('id', roomId)
      .single()

    if (room?.creator_id === userId) {
      return { error: new Error('不能移除聊天室创建者'), data: null }
    }

    // 移除成员
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)

    if (error) throw error

    return { data: true, error: null }
  } catch (error) {
    console.error('移除成员失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 修改成员角色（仅管理员）
 * {{ AURA: Modify - 系统管理员拥有所有房间的管理权限 }}
 * @param roomId 聊天室ID
 * @param userId 用户ID
 * @param role 新角色 ('admin' | 'member')
 * @returns 修改结果或错误
 */
export async function updateMemberRole(
  roomId: string,
  userId: string,
  role: 'admin' | 'member'
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // {{ AURA: Add - 检查系统管理员权限 }}
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isSystemAdmin = userProfile?.is_admin === true

    // {{ AURA: Modify - 非系统管理员需要检查房间管理员权限 }}
    if (!isSystemAdmin) {
      const { data: membership } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single()

      if (membership?.role !== 'admin') {
        return { error: new Error('只有管理员可以修改成员角色'), data: null }
      }
    } else {
      console.log('🔑 系统管理员执行修改角色操作')
    }

    // 不能修改创建者的角色
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('creator_id')
      .eq('id', roomId)
      .single()

    if (room?.creator_id === userId) {
      return { error: new Error('不能修改创建者的角色'), data: null }
    }

    // 修改角色
    const { data: updatedMember, error } = await supabase
      .from('room_members')
      .update({ role })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return { data: updatedMember, error: null }
  } catch (error) {
    console.error('修改成员角色失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 检查用户是否是聊天室成员
 * {{ AURA: Modify - 添加系统管理员权限检查 }}
 * @param roomId 聊天室ID
 * @returns 是否是成员和角色
 */
export async function checkRoomMembership(roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { isMember: false, role: null, isSystemAdmin: false, error: null }
    }

    // {{ AURA: Add - 首先检查用户是否是系统管理员 }}
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    // 系统管理员拥有所有房间的访问权限
    if (userProfile?.is_admin === true) {
      console.log('✅ 系统管理员拥有访问所有房间的权限')
      return {
        isMember: true,
        role: 'admin',
        isSystemAdmin: true,
        error: null,
      }
    }

    // {{ AURA: Modify - 非管理员则检查房间成员身份 }}
    const { data: membership, error } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      isMember: !!membership,
      role: membership?.role || null,
      isSystemAdmin: false,
      error: null,
    }
  } catch (error) {
    console.error('检查成员身份失败:', error)
    return { isMember: false, role: null, isSystemAdmin: false, error: error as Error }
  }
}

// ==================== 消息管理 ====================

/**
 * 删除消息
 * {{ AURA: Add - 系统管理员和消息发送者可以删除消息 }}
 * @param messageId 消息ID
 * @param roomId 聊天室ID
 * @returns 删除结果或错误
 */
export async function deleteMessage(messageId: string, roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // 检查系统管理员权限
    const { data: userProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isSystemAdmin = userProfile?.is_admin === true

    // 如果不是系统管理员，检查是否是消息发送者
    if (!isSystemAdmin) {
      const { data: message } = await supabase
        .from('messages')
        .select('user_id')
        .eq('id', messageId)
        .single()

      if (message?.user_id !== user.id) {
        return { error: new Error('只能删除自己的消息'), data: null }
      }
    } else {
      console.log('🔑 系统管理员执行删除消息操作')
    }

    // 删除消息
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (error) throw error

    return { data: true, error: null }
  } catch (error) {
    console.error('删除消息失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 编辑消息
 * {{ AURA: Add - 用户可以编辑自己的消息 }}
 * @param messageId 消息ID
 * @param newContent 新内容
 * @returns 编辑结果或错误
 */
export async function editMessage(messageId: string, newContent: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // 检查是否是消息发送者
    const { data: message } = await supabase
      .from('messages')
      .select('user_id')
      .eq('id', messageId)
      .single()

    if (message?.user_id !== user.id) {
      return { error: new Error('只能编辑自己的消息'), data: null }
    }

    // 更新消息
    const { data: updatedMessage, error } = await supabase
      .from('messages')
      .update({
        content: newContent,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single()

    if (error) throw error

    return { data: updatedMessage, error: null }
  } catch (error) {
    console.error('编辑消息失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 添加消息反应
 * {{ AURA: Add - 用户可以对消息添加 Emoji 反应 }}
 * @param messageId 消息ID
 * @param emoji Emoji 表情
 * @returns 添加结果或错误
 */
export async function addMessageReaction(messageId: string, emoji: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // 添加反应（如果已存在则忽略）
    const { data: reaction, error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji: emoji,
      })
      .select()
      .single()

    if (error) {
      // 如果是唯一约束错误，说明已经添加过了
      if (error.code === '23505') {
        return { error: new Error('已经添加过该反应'), data: null }
      }
      throw error
    }

    return { data: reaction, error: null }
  } catch (error) {
    console.error('添加消息反应失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 移除消息反应
 * {{ AURA: Add - 用户可以移除自己的反应 }}
 * @param messageId 消息ID
 * @param emoji Emoji 表情
 * @returns 移除结果或错误
 */
export async function removeMessageReaction(messageId: string, emoji: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // 移除反应
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)

    if (error) throw error

    return { data: true, error: null }
  } catch (error) {
    console.error('移除消息反应失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 获取消息的所有反应
 * {{ AURA: Add - 获取消息的反应统计 }}
 * @param messageId 消息ID
 * @returns 反应列表或错误
 */
export async function getMessageReactions(messageId: string) {
  try {
    const { data: reactions, error } = await supabase
      .from('message_reactions')
      .select(`
        id,
        emoji,
        user_id,
        created_at,
        users (
          id,
          nickname
        )
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // 统计每个 emoji 的数量
    const reactionStats: Record<string, { count: number; users: string[]; userIds: string[] }> = {}
    
    reactions?.forEach((reaction: any) => {
      if (!reactionStats[reaction.emoji]) {
        reactionStats[reaction.emoji] = { count: 0, users: [], userIds: [] }
      }
      reactionStats[reaction.emoji].count++
      reactionStats[reaction.emoji].users.push(reaction.users[0]?.nickname || '未知用户')
      reactionStats[reaction.emoji].userIds.push(reaction.user_id)
    })

    return { data: reactionStats, error: null }
  } catch (error) {
    console.error('获取消息反应失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 添加消息提及
 * {{ AURA: Add - 记录消息中@提及的用户 }}
 * @param messageId 消息ID
 * @param mentionedUserIds 被提及的用户ID数组
 * @returns 添加结果或错误
 */
export async function addMessageMentions(messageId: string, mentionedUserIds: string[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    if (mentionedUserIds.length === 0) {
      return { data: [], error: null }
    }

    // 批量插入提及记录
    const mentions = mentionedUserIds.map(userId => ({
      message_id: messageId,
      mentioned_user_id: userId,
      is_read: false,
    }))

    const { data, error } = await supabase
      .from('message_mentions')
      .insert(mentions)
      .select()

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    console.error('添加消息提及失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 获取用户的未读提及
 * {{ AURA: Add - 获取@我的消息列表 }}
 * @param userId 用户ID（可选，默认当前用户）
 * @returns 未读提及列表或错误
 */
export async function getUnreadMentions(userId?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    const targetUserId = userId || user.id

    const { data: mentions, error } = await supabase
      .from('message_mentions')
      .select(`
        id,
        message_id,
        is_read,
        created_at,
        messages (
          id,
          content,
          room_id,
          user_id,
          created_at,
          users (
            id,
            nickname
          ),
          chat_rooms (
            id,
            name
          )
        )
      `)
      .eq('mentioned_user_id', targetUserId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return { data: mentions, error: null }
  } catch (error) {
    console.error('获取未读提及失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 标记提及为已读
 * {{ AURA: Add - 标记@消息为已读 }}
 * @param mentionIds 提及ID数组，或 'all' 标记全部已读
 * @returns 更新结果或错误
 */
export async function markMentionsAsRead(mentionIds: string[] | 'all') {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    let query = supabase
      .from('message_mentions')
      .update({ is_read: true })
      .eq('mentioned_user_id', user.id)

    if (mentionIds !== 'all') {
      query = query.in('id', mentionIds)
    }

    const { error } = await query

    if (error) throw error

    return { error: null }
  } catch (error) {
    console.error('标记提及已读失败:', error)
    return { error: error as Error }
  }
}

/**
 * 从消息内容中提取@提及的用户
 * {{ AURA: Add - 解析消息文本中的@username格式 }}
 * @param content 消息内容
 * @param roomMembers 房间成员列表
 * @returns 被提及的用户ID数组
 */
export function extractMentions(content: string, roomMembers: { user_id: string; users: Array<{ nickname: string }> }[]): string[] {
  // 匹配 @username 格式
  const mentionRegex = /@(\S+)/g
  const matches = Array.from(content.matchAll(mentionRegex))
  const mentionedUserIds: string[] = []

  for (const match of matches) {
    const nickname = match[1]
    // 在房间成员中查找匹配的用户
    const member = roomMembers.find(m => m.users[0]?.nickname === nickname)
    if (member && !mentionedUserIds.includes(member.user_id)) {
      mentionedUserIds.push(member.user_id)
    }
  }

  return mentionedUserIds
}

/**
 * 上传文件到 Supabase Storage
 * {{ AURA: Add - 支持图片、文档等文件上传 }}
 * @param file 文件对象
 * @param roomId 房间ID
 * @param onProgress 上传进度回调
 * @returns 文件URL和元数据或错误
 */
export async function uploadFile(
  file: File,
  roomId: string,
  onProgress?: (progress: number) => void
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    // 验证文件大小（50MB限制）
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return { error: new Error('文件大小不能超过50MB'), data: null }
    }

    // 验证文件类型
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'video/mp4',
      'audio/mpeg', 'audio/wav'
    ]

    if (!allowedTypes.includes(file.type)) {
      return { error: new Error('不支持的文件类型'), data: null }
    }

    // 生成唯一文件名
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${roomId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

    // 上传文件到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) throw uploadError

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('chat-files')
      .getPublicUrl(fileName)

    // 保存文件元数据到数据库
    const { data: metadata, error: metadataError } = await supabase
      .from('file_metadata')
      .insert({
        room_id: roomId,
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        webdav_path: fileName,
        thumbnail_path: null,
      })
      .select()
      .single()

    if (metadataError) {
      // 如果元数据保存失败，删除已上传的文件
      await supabase.storage.from('chat-files').remove([fileName])
      throw metadataError
    }

    return {
      data: {
        fileUrl: urlData.publicUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        metadata,
      },
      error: null,
    }
  } catch (error) {
    console.error('上传文件失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 删除文件
 * {{ AURA: Add - 删除存储的文件及其元数据 }}
 * @param fileMetadataId 文件元数据ID
 * @returns 删除结果或错误
 */
export async function deleteFile(fileMetadataId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录') }
    }

    // 获取文件元数据
    const { data: metadata, error: fetchError } = await supabase
      .from('file_metadata')
      .select('*')
      .eq('id', fileMetadataId)
      .single()

    if (fetchError || !metadata) {
      return { error: new Error('文件不存在') }
    }

    // 检查权限（用户是文件所有者或系统管理员）
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isOwner = metadata.user_id === user.id
    const isAdmin = profile?.is_admin === true

    if (!isOwner && !isAdmin) {
      return { error: new Error('无权删除此文件') }
    }

    // 删除Storage中的文件
    const { error: storageError } = await supabase.storage
      .from('chat-files')
      .remove([metadata.webdav_path])

    if (storageError) {
      console.error('删除Storage文件失败:', storageError)
    }

    // 删除数据库中的元数据
    const { error: deleteError } = await supabase
      .from('file_metadata')
      .delete()
      .eq('id', fileMetadataId)

    if (deleteError) throw deleteError

    return { error: null }
  } catch (error) {
    console.error('删除文件失败:', error)
    return { error: error as Error }
  }
}

/**
 * 获取房间的文件列表
 * {{ AURA: Add - 查看房间内所有文件 }}
 * @param roomId 房间ID
 * @returns 文件列表或错误
 */
export async function getRoomFiles(roomId: string) {
  try {
    const { data, error } = await supabase
      .from('file_metadata')
      .select(`
        *,
        users (
          id,
          nickname
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    console.error('获取文件列表失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 获取用户所有房间的未读消息数
 * {{ AURA: Add - 显示未读消息徽章 }}
 * @returns 未读消息统计列表或错误
 */
export async function getUnreadCounts() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    const { data, error } = await supabase
      .from('unread_messages')
      .select('room_id, unread_count, last_read_at')
      .eq('user_id', user.id)

    if (error) throw error

    // 转换为Map便于查询
    const unreadMap: Record<string, number> = {}
    data?.forEach(item => {
      unreadMap[item.room_id] = item.unread_count
    })

    return { data: unreadMap, error: null }
  } catch (error) {
    console.error('获取未读数失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 标记房间消息为已读
 * {{ AURA: Add - 用户进入房间时标记已读 }}
 * @param roomId 房间ID
 * @returns 标记结果或错误
 */
export async function markRoomAsRead(roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录') }
    }

    // 获取房间最新消息ID
    const { data: latestMessage } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // 更新或插入未读记录
    const { error } = await supabase
      .from('unread_messages')
      .upsert({
        user_id: user.id,
        room_id: roomId,
        last_read_message_id: latestMessage?.id || null,
        last_read_at: new Date().toISOString(),
        unread_count: 0,
      }, {
        onConflict: 'user_id,room_id'
      })

    if (error) throw error

    return { error: null }
  } catch (error) {
    console.error('标记已读失败:', error)
    return { error: error as Error }
  }
}

/**
 * 增加房间未读消息数
 * {{ AURA: Add - 新消息到达时调用 }}
 * @param roomId 房间ID
 * @param excludeUserId 排除的用户ID（消息发送者）
 * @returns 更新结果或错误
 */
export async function incrementUnreadCount(roomId: string, excludeUserId: string) {
  try {
    // 获取房间所有成员（除了发送者）
    const { data: members, error: membersError } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .neq('user_id', excludeUserId)

    if (membersError) throw membersError

    if (!members || members.length === 0) {
      return { error: null }
    }

    // 获取最新消息ID
    const { data: latestMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // 为每个成员增加未读数
    const updates = members.map(member => ({
      user_id: member.user_id,
      room_id: roomId,
      last_read_message_id: latestMessage?.id || null,
      last_read_at: new Date().toISOString(),
      unread_count: 1, // 初始值，如果已存在会通过RPC更新
    }))

    // 批量upsert（如果记录存在则增加计数）
    for (const update of updates) {
      // 先检查是否存在
      const { data: existing } = await supabase
        .from('unread_messages')
        .select('unread_count')
        .eq('user_id', update.user_id)
        .eq('room_id', update.room_id)
        .single()

      if (existing) {
        // 存在则增加计数
        await supabase
          .from('unread_messages')
          .update({ unread_count: existing.unread_count + 1 })
          .eq('user_id', update.user_id)
          .eq('room_id', update.room_id)
      } else {
        // 不存在则插入
        await supabase
          .from('unread_messages')
          .insert(update)
      }
    }

    return { error: null }
  } catch (error) {
    console.error('增加未读数失败:', error)
    return { error: error as Error }
  }
}

/**
 * 获取用户未读消息总数
 * {{ AURA: Add - 显示在导航栏或标题 }}
 * @returns 未读总数或错误
 */
export async function getTotalUnreadCount() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: 0 }
    }

    const { data, error } = await supabase
      .from('unread_messages')
      .select('unread_count')
      .eq('user_id', user.id)

    if (error) throw error

    const total = data?.reduce((sum, item) => sum + item.unread_count, 0) || 0

    return { data: total, error: null }
  } catch (error) {
    console.error('获取未读总数失败:', error)
    return { error: error as Error, data: 0 }
  }
}

/**
 * 搜索房间内的消息
 * {{ AURA: Add - 全文搜索历史消息 }}
 * @param roomId 房间ID
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 * @returns 搜索结果或错误
 */
export async function searchMessages(roomId: string, keyword: string, limit: number = 50) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    if (!keyword.trim()) {
      return { data: [], error: null }
    }

    // 使用 PostgreSQL 全文搜索
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        room_id,
        user_id,
        content,
        message_type,
        file_url,
        file_name,
        file_size,
        is_edited,
        created_at,
        users:user_id (
          id,
          nickname,
          avatar_url
        )
      `)
      .eq('room_id', roomId)
      .ilike('content', `%${keyword}%`)  // 模糊搜索
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    console.error('搜索消息失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 跨房间搜索消息
 * {{ AURA: Add - 在所有有权限的房间中搜索 }}
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 * @returns 搜索结果或错误
 */
export async function searchAllMessages(keyword: string, limit: number = 100) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录'), data: null }
    }

    if (!keyword.trim()) {
      return { data: [], error: null }
    }

    // 获取用户加入的所有房间
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', user.id)

    const roomIds = memberships?.map(m => m.room_id) || []

    if (roomIds.length === 0) {
      return { data: [], error: null }
    }

    // 在这些房间中搜索消息
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        room_id,
        user_id,
        content,
        message_type,
        file_url,
        file_name,
        is_edited,
        created_at,
        users:user_id (
          id,
          nickname,
          avatar_url
        ),
        chat_rooms:room_id (
          id,
          name
        )
      `)
      .in('room_id', roomIds)
      .ilike('content', `%${keyword}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    console.error('全局搜索消息失败:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 标记消息为已读
 * {{ AURA: Add - 记录用户已读某条消息 }}
 * @param messageId 消息ID
 * @returns 成功或错误
 */
export async function markMessageAsRead(messageId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录') }
    }

    // 使用 upsert 避免重复插入
    const { error } = await supabase
      .from('message_reads')
      .upsert({
        message_id: messageId,
        user_id: user.id,
        read_at: new Date().toISOString(),
      }, {
        onConflict: 'message_id,user_id',
      })

    if (error) {
      console.error('标记消息已读失败:', error)
      return { error: error as Error }
    }

    return { error: null }
  } catch (error) {
    console.error('标记消息已读异常:', error)
    return { error: error as Error }
  }
}

/**
 * 批量标记消息为已读
 * {{ AURA: Add - 批量标记多条消息已读，用于进入房间时 }}
 * @param messageIds 消息ID数组
 * @returns 成功或错误
 */
export async function markMessagesAsRead(messageIds: string[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录') }
    }

    if (messageIds.length === 0) {
      return { error: null }
    }

    const now = new Date().toISOString()
    const reads = messageIds.map(messageId => ({
      message_id: messageId,
      user_id: user.id,
      read_at: now,
    }))

    const { error } = await supabase
      .from('message_reads')
      .upsert(reads, {
        onConflict: 'message_id,user_id',
      })

    if (error) {
      console.error('批量标记消息已读失败:', error)
      return { error: error as Error }
    }

    return { error: null }
  } catch (error) {
    console.error('批量标记消息已读异常:', error)
    return { error: error as Error }
  }
}

/**
 * 获取消息的已读用户列表
 * {{ AURA: Add - 查询哪些用户已读某条消息 }}
 * @param messageId 消息ID
 * @returns 已读用户列表或错误
 */
export async function getMessageReads(messageId: string) {
  try {
    const { data, error } = await supabase
      .from('message_reads')
      .select(`
        user_id,
        read_at,
        users:user_id (
          id,
          nickname,
          avatar_url
        )
      `)
      .eq('message_id', messageId)
      .order('read_at', { ascending: true })

    if (error) {
      console.error('获取消息已读列表失败:', error)
      return { error: error as Error, data: null }
    }

    return { error: null, data }
  } catch (error) {
    console.error('获取消息已读列表异常:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 获取多条消息的已读统计
 * {{ AURA: Add - 批量查询消息的已读人数，优化列表显示性能 }}
 * @param messageIds 消息ID数组
 * @returns 消息ID到已读用户ID列表的映射
 */
export async function getMessagesReadCount(messageIds: string[]) {
  try {
    if (messageIds.length === 0) {
      return { error: null, data: {} }
    }

    const { data, error } = await supabase
      .from('message_reads')
      .select('message_id, user_id')
      .in('message_id', messageIds)

    if (error) {
      console.error('获取消息已读统计失败:', error)
      return { error: error as Error, data: null }
    }

    // 按消息ID分组
    const readsByMessage: Record<string, string[]> = {}
    data?.forEach((read: any) => {
      if (!readsByMessage[read.message_id]) {
        readsByMessage[read.message_id] = []
      }
      readsByMessage[read.message_id].push(read.user_id)
    })

    return { error: null, data: readsByMessage }
  } catch (error) {
    console.error('获取消息已读统计异常:', error)
    return { error: error as Error, data: null }
  }
}

/**
 * 置顶消息
 * {{ AURA: Add - 将消息置顶到聊天室顶部，仅管理员可操作 }}
 * @param messageId 消息ID
 * @param roomId 房间ID
 * @returns 成功或错误
 */
export async function pinMessage(messageId: string, roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录') }
    }

    // 检查权限（房间管理员或系统管理员）
    const { isMember, role, isSystemAdmin } = await checkRoomMembership(roomId)
    if (!isSystemAdmin && role !== 'admin') {
      return { error: new Error('只有管理员可以置顶消息') }
    }

    // 置顶消息
    const { error } = await supabase
      .from('messages')
      .update({
        is_pinned: true,
        pinned_at: new Date().toISOString(),
        pinned_by: user.id,
      })
      .eq('id', messageId)
      .eq('room_id', roomId)

    if (error) {
      console.error('置顶消息失败:', error)
      return { error: error as Error }
    }

    return { error: null }
  } catch (error) {
    console.error('置顶消息异常:', error)
    return { error: error as Error }
  }
}

/**
 * 取消置顶消息
 * {{ AURA: Add - 取消消息置顶，仅管理员可操作 }}
 * @param messageId 消息ID
 * @param roomId 房间ID
 * @returns 成功或错误
 */
export async function unpinMessage(messageId: string, roomId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: new Error('请先登录') }
    }

    // 检查权限（房间管理员或系统管理员）
    const { isMember, role, isSystemAdmin } = await checkRoomMembership(roomId)
    if (!isSystemAdmin && role !== 'admin') {
      return { error: new Error('只有管理员可以取消置顶') }
    }

    // 取消置顶
    const { error } = await supabase
      .from('messages')
      .update({
        is_pinned: false,
        pinned_at: null,
        pinned_by: null,
      })
      .eq('id', messageId)
      .eq('room_id', roomId)

    if (error) {
      console.error('取消置顶失败:', error)
      return { error: error as Error }
    }

    return { error: null }
  } catch (error) {
    console.error('取消置顶异常:', error)
    return { error: error as Error }
  }
}

/**
 * 获取房间的置顶消息列表
 * {{ AURA: Add - 查询房间所有置顶消息，按置顶时间倒序 }}
 * @param roomId 房间ID
 * @returns 置顶消息列表或错误
 */
export async function getPinnedMessages(roomId: string) {
  try {
    // {{ AURA: Modify - 简化查询，使用分步方式获取关联数据以避免外键关系错误 }}
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        users!messages_user_id_fkey (
          id,
          nickname,
          avatar_url
        )
      `)
      .eq('room_id', roomId)
      .eq('is_pinned', true)
      .order('pinned_at', { ascending: false })

    if (error) {
      console.error('获取置顶消息失败:', error)
      return { error: error as Error, data: null }
    }

    // 如果需要获取置顶操作者信息，单独查询
    if (messages && messages.length > 0) {
      const pinnerIds = messages
        .map(m => m.pinned_by)
        .filter((id): id is string => id !== null && id !== undefined)

      if (pinnerIds.length > 0) {
        const { data: pinners } = await supabase
          .from('users')
          .select('id, nickname, avatar_url')
          .in('id', pinnerIds)

        // 将置顶操作者信息添加到消息中
        const pinnersMap = new Map(pinners?.map(p => [p.id, p]) || [])
        messages.forEach(msg => {
          if (msg.pinned_by) {
            ;(msg as any).pinned_by_user = pinnersMap.get(msg.pinned_by) || null
          }
        })
      }
    }

    return { error: null, data: messages }
  } catch (error) {
    console.error('获取置顶消息异常:', error)
    return { error: error as Error, data: null }
  }
}
