# 头像功能快速参考

## 🎯 核心改动

### 1. 消息列表头像（MessageList.tsx）
**位置**：第309-329行

**使用模式**：
```tsx
// 优先显示真实头像，失败则显示首字母
{message.user.avatar_url ? (
  <img src={avatar} onError={回退到首字母} />
) : null}
{showAvatar && <div 首字母背景 />}
```

### 2. 头像上传（profile/page.tsx）
**位置**：第30-96行（逻辑）、第233-283行（UI）

**使用方法**：
```tsx
<input type="file" accept="image/*" onChange={handleAvatarUpload} />
```

**验证规则**：
- 文件类型：image/*
- 最大大小：2MB
- 支持格式：JPG, PNG, GIF

## 📍 头像显示位置

| 位置 | 文件 | 尺寸 | 行号 |
|------|------|------|------|
| 消息列表 | MessageList.tsx | 40x40px | 309-329 |
| 成员列表 | page.tsx (chat) | 48x48px | 1276-1291 |
| 个人中心头部 | profile/page.tsx | 80x80px | 195-207 |
| 头像预览 | profile/page.tsx | 96x96px | 239-250 |
| @提及 | MessageInput.tsx | 32x32px | 294-306 |
| 已读列表 | MessageList.tsx | 24x24px | 604-621 |
| 置顶消息 | MessageList.tsx | 24x24px | 249-252 |

## 🎨 样式规范

### 头像CSS类
```css
/* 真实头像 */
.rounded-full object-cover shadow-md border-2 border-white

/* 首字母头像 */
.rounded-full bg-gradient-to-br from-blue-500 to-purple-600
.flex items-center justify-center text-white font-bold shadow-md
```

### 渐变背景
```tsx
className="bg-gradient-to-br from-blue-500 to-purple-600"
```

## 🔧 关键函数

### handleAvatarUpload
```tsx
const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  // 1. 获取文件
  // 2. 验证类型和大小
  // 3. 创建预览
  // 4. Base64编码
  // 5. 更新表单
}
```

### handleRemoveAvatar
```tsx
const handleRemoveAvatar = () => {
  setFormData({ ...formData, avatar_url: '' })
  setAvatarPreview('')
}
```

### 图片加载失败处理
```tsx
onError={(e) => {
  e.currentTarget.style.display = 'none'
  const fallback = e.currentTarget.nextElementSibling as HTMLElement
  if (fallback) fallback.style.display = 'flex'
}}
```

## 📝 代码模板

### 显示头像（带回退）
```tsx
{user.avatar_url ? (
  <img
    src={user.avatar_url}
    alt={user.nickname}
    className="w-10 h-10 rounded-full object-cover shadow-md border-2 border-white dark:border-gray-700"
    onError={(e) => {
      e.currentTarget.style.display = 'none'
      const fallback = e.currentTarget.nextElementSibling as HTMLElement
      if (fallback) fallback.style.display = 'flex'
    }}
  />
) : null}
<div 
  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md"
  style={{ display: user.avatar_url ? 'none' : 'flex' }}
>
  {user.nickname.charAt(0).toUpperCase()}
</div>
```

### 简化版（无加载失败处理）
```tsx
{user.avatar_url ? (
  <img
    src={user.avatar_url}
    alt={user.nickname}
    className="w-10 h-10 rounded-full object-cover shadow-md border-2 border-white"
  />
) : (
  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
    {user.nickname.charAt(0).toUpperCase()}
  </div>
)}
```

## 🐛 常见问题

### Q: 头像不显示？
A: 检查以下几点：
1. `avatar_url` 字段是否存在
2. URL是否有效
3. 检查浏览器控制台的错误信息
4. 确认图片格式正确

### Q: 上传失败？
A: 可能原因：
1. 文件大小超过2MB
2. 文件类型不是图片
3. 浏览器不支持FileReader API

### Q: 图片变形？
A: 确保使用了 `object-cover` 类：
```tsx
className="... object-cover ..."
```

### Q: 深色模式边框不明显？
A: 使用条件类：
```tsx
className="... border-white dark:border-gray-700"
```

## 🚀 快速测试

### 1. 测试头像上传
```bash
# 1. 启动开发服务器
npm run dev

# 2. 访问个人中心
http://localhost:3000/profile

# 3. 上传测试图片
# 4. 保存并查看效果
```

### 2. 测试头像显示
```bash
# 1. 发送一条消息
# 2. 检查消息列表中的头像
# 3. 检查成员列表中的头像
# 4. 检查@提及选择器中的头像
```

## 💡 开发技巧

### 1. 调试头像URL
```tsx
console.log('Avatar URL:', user.avatar_url)
```

### 2. 测试回退机制
```tsx
// 故意使用无效URL测试
<img src="invalid-url" onError={...} />
```

### 3. 查看Base64大小
```tsx
const sizeInKB = (base64.length * 0.75) / 1024
console.log(`Image size: ${sizeInKB.toFixed(2)} KB`)
```

## 📊 性能优化

### Base64存储
- ✅ 优点：简单、无需外部服务
- ⚠️ 缺点：增加数据库大小、传输慢

### 建议优化
1. 压缩图片（使用canvas）
2. 限制尺寸（如最大500x500px）
3. 迁移到云存储服务

### 图片压缩示例
```tsx
const compressImage = (file: File, maxWidth: number = 500): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        let width = img.width
        let height = img.height
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}
```

## 🎯 下一步

- [ ] 集成Supabase Storage
- [ ] 添加图片裁剪功能
- [ ] 支持拖拽上传
- [ ] 添加头像缓存
- [ ] 优化加载性能
