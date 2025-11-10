# Toast 通知组件使用指南

## 概述

Toast组件提供优雅的通知反馈系统，支持4种类型的消息提醒，自动在3秒后消失。

## 功能特性

- ✅ **4种通知类型**：成功、错误、警告、信息
- ✅ **自动消失**：3秒后自动移除通知
- ✅ **手动关闭**：点击X按钮立即关闭
- ✅ **多通知堆叠**：支持同时显示多个通知
- ✅ **深色模式**：完美适配浅色/深色主题
- ✅ **动画效果**：滑入动画，视觉流畅

## 使用方法

### 1. 在组件中引入

```typescript
import { useToast } from '@/components/ToastProvider'

export default function YourComponent() {
  const { showToast } = useToast()
  
  // 使用showToast显示通知
}
```

### 2. 调用方式

```typescript
// 成功通知（绿色）
showToast('操作成功！', 'success')

// 错误通知（红色）
showToast('操作失败，请重试', 'error')

// 警告通知（黄色）
showToast('请注意此操作', 'warning')

// 信息通知（蓝色）
showToast('这是一条提示信息', 'info')

// 默认类型为info，可省略
showToast('简单消息')
```

## 实际应用示例

### 示例1：注册成功

```typescript
const handleRegister = async () => {
  try {
    await signUp(email, password, nickname)
    showToast('注册成功！正在跳转...', 'success')
    router.push('/chat')
  } catch (error) {
    showToast('注册失败：' + error.message, 'error')
  }
}
```

### 示例2：表单验证

```typescript
const handleSubmit = () => {
  if (!email) {
    showToast('请输入邮箱地址', 'warning')
    return
  }
  if (!validateEmail(email)) {
    showToast('邮箱格式不正确', 'error')
    return
  }
  // 继续提交...
}
```

### 示例3：保存设置

```typescript
const handleSaveProfile = async () => {
  try {
    await updateProfile({ nickname, signature })
    showToast('个人资料已更新', 'success')
  } catch (error) {
    showToast('保存失败，请重试', 'error')
  }
}
```

### 示例4：文件上传

```typescript
const handleFileUpload = async (file: File) => {
  if (file.size > 10 * 1024 * 1024) {
    showToast('文件大小不能超过10MB', 'warning')
    return
  }
  
  showToast('正在上传文件...', 'info')
  
  try {
    await uploadFile(file)
    showToast('文件上传成功！', 'success')
  } catch (error) {
    showToast('上传失败：' + error.message, 'error')
  }
}
```

## 建议场景

### ✅ 适合使用Toast的场景

1. **操作反馈**：保存成功、删除成功、更新成功
2. **错误提示**：网络错误、验证失败、权限不足
3. **警告信息**：即将过期、配额不足、操作不可逆
4. **信息通知**：系统消息、状态更新、后台任务完成

### ❌ 不适合使用Toast的场景

1. **需要用户确认的操作**：使用Dialog/Modal
2. **复杂错误信息**：使用错误页面或详细错误提示
3. **持久信息**：使用Banner或页面内嵌提示
4. **需要用户输入的场景**：使用表单或对话框

## 样式定制

Toast位置固定在右上角（`top-4 right-4`），如需调整位置，修改 `ToastProvider.tsx` 中的容器样式：

```typescript
// 修改位置
<div className="fixed top-4 right-4 z-50 space-y-2">  // 右上角
<div className="fixed top-4 left-4 z-50 space-y-2">   // 左上角
<div className="fixed bottom-4 right-4 z-50 space-y-2"> // 右下角
<div className="fixed bottom-4 left-4 z-50 space-y-2">  // 左下角
<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2"> // 顶部居中
```

## 技术实现

- **状态管理**：使用React Context + useState
- **自动移除**：setTimeout机制，3秒后清理
- **动画**：Tailwind CSS的animate-slide-up
- **唯一ID**：随机生成，防止键冲突
- **类型安全**：完整的TypeScript类型定义

## 性能优化

1. **useCallback包装**：避免不必要的函数重新创建
2. **唯一键管理**：确保React高效更新列表
3. **自动清理**：防止内存泄漏，及时清理过期通知
4. **最小重渲染**：只更新toasts数组，不影响其他组件

## 下一步优化（可选）

- [ ] 添加持续时间自定义（目前固定3秒）
- [ ] 添加位置配置选项（目前固定右上角）
- [ ] 添加音效提示（可选）
- [ ] 添加进度条显示剩余时间
- [ ] 支持富文本内容
- [ ] 添加撤销操作（Undo）功能

---

现在你可以在任何组件中使用 `useToast()` 来显示优雅的通知提示了！🎉
