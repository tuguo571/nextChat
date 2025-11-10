# 实时聊天室系统 - 技术设计文档

## 项目概述

这是一个功能完备的实时聊天室系统，基于Next.js 14、Supabase、WebSocket和WebDAV构建，支持多人在线聊天、文件共享、@提及通知、消息搜索等核心功能。

## 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **UI组件**: 
  - react-markdown (Markdown渲染)
  - react-syntax-highlighter (代码高亮)
  - emoji-picker-react (表情选择器)
  - react-virtuoso (虚拟滚动)

### 后端
- **数据库**: Supabase (PostgreSQL)
- **实时通信**: WebSocket (ws)
- **文件存储**: WebDAV
- **认证**: Supabase Auth

### 开发工具
- **包管理器**: npm/yarn/pnpm
- **代码质量**: ESLint, TypeScript
- **Git**: .gitignore已配置

## 项目结构

```
chat/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # 根布局
│   │   ├── page.tsx              # 首页 (重定向逻辑)
│   │   ├── globals.css           # 全局样式
│   │   ├── auth/                 # 认证相关页面
│   │   │   ├── login/            # 登录页
│   │   │   └── register/         # 注册页
│   │   ├── chat/                 # 聊天室页面
│   │   │   ├── page.tsx          # 聊天室列表
│   │   │   └── [roomId]/         # 单个聊天室
│   │   └── profile/              # 用户资料页面
│   ├── components/               # 可复用组件
│   │   ├── ThemeProvider.tsx     # 主题管理
│   │   ├── AuthProvider.tsx      # 认证管理
│   │   ├── ChatMessage.tsx       # 消息组件
│   │   ├── MessageInput.tsx      # 消息输入框
│   │   ├── FileUploader.tsx      # 文件上传组件
│   │   ├── NotificationCenter.tsx # 通知中心
│   │   └── ...
│   ├── lib/                      # 工具库
│   │   ├── supabase.ts           # Supabase客户端
│   │   ├── websocket.ts          # WebSocket客户端
│   │   ├── webdav.ts             # WebDAV客户端
│   │   └── utils.ts              # 通用工具函数
│   ├── hooks/                    # 自定义Hooks
│   │   ├── useWebSocket.ts       # WebSocket Hook
│   │   ├── useMessages.ts        # 消息管理Hook
│   │   └── useNotifications.ts   # 通知管理Hook
│   ├── stores/                   # Zustand状态管理
│   │   ├── chatStore.ts          # 聊天状态
│   │   └── uiStore.ts            # UI状态
│   └── types/                    # TypeScript类型定义
│       └── index.ts              # 类型定义
├── database/                     # 数据库相关
│   └── schema.sql                # 数据库Schema
├── public/                       # 静态资源
├── .env.local                    # 环境变量 (不提交到Git)
├── next.config.js                # Next.js配置
├── tailwind.config.js            # Tailwind配置
├── tsconfig.json                 # TypeScript配置
├── package.json                  # 项目依赖
└── README.md                     # 项目文档
```

## 安装步骤

### 1. 安装依赖

```powershell
npm install
# 或
yarn install
# 或
pnpm install
```

### 2. 配置环境变量

已创建 `.env.local` 文件，包含以下配置：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=http://sbp-ikairbucachjzcos.supabase.opentrust.net
NEXT_PUBLIC_SUPABASE_ANON_KEY=sbp-ikairbucachjzcos
SUPABASE_SERVICE_ROLE_KEY=

# AI配置
NEXT_PUBLIC_AI_API_URL=https://bbwh.netlib.re/v1/chat/completions
NEXT_PUBLIC_AI_API_KEY=
NEXT_PUBLIC_AI_MODEL=gemini-2.5-pro

# WebDAV配置 (需要配置)
WEBDAV_URL=
WEBDAV_USERNAME=
WEBDAV_PASSWORD=

# WebSocket配置
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# JWT密钥
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### 3. 初始化数据库

在Supabase控制台执行 `database/schema.sql` 中的SQL脚本：

1. 登录Supabase: http://sbp-ikairbucachjzcos.supabase.opentrust.net/
2. 进入SQL Editor
3. 复制并执行 `database/schema.sql` 的内容
4. 验证表已创建成功

### 4. 启动开发服务器

```powershell
npm run dev
```

访问 http://localhost:3000

## 核心功能模块

### 已完成
✅ 项目初始化与环境配置
✅ 数据库Schema设计
✅ 基础认证Provider
✅ 主题切换Provider
✅ 基础页面结构

### 待开发 (按优先级排序)

1. **用户认证系统** (需求1)
   - [ ] 登录/注册页面UI
   - [ ] 邮箱密码验证
   - [ ] 用户资料管理
   - [ ] 会话管理

2. **聊天室管理** (需求2)
   - [ ] 聊天室列表页面
   - [ ] 创建/加入聊天室
   - [ ] 管理员权限控制
   - [ ] 成员管理

3. **WebSocket实时通信** (需求3)
   - [ ] WebSocket服务器搭建
   - [ ] 消息实时推送
   - [ ] 心跳检测与重连
   - [ ] 在线状态管理

4. **消息类型支持** (需求4)
   - [ ] 文本消息渲染
   - [ ] Markdown支持
   - [ ] 图片/文件消息
   - [ ] @提及功能

5. **消息历史与虚拟滚动** (需求5)
   - [ ] 分批加载历史消息
   - [ ] 虚拟滚动优化
   - [ ] 自动滚动逻辑

6. **WebDAV文件存储** (需求6)
   - [ ] WebDAV客户端集成
   - [ ] 文件上传/下载
   - [ ] 缩略图生成

7. **消息操作与互动** (需求7)
   - [ ] 消息编辑/删除
   - [ ] 消息回复
   - [ ] 表情反应

8. **通知系统** (需求8)
   - [ ] @提及通知
   - [ ] 通知中心UI
   - [ ] 未读计数

9. **消息搜索** (需求9)
   - [ ] 全局搜索功能
   - [ ] 高级筛选
   - [ ] 关键词高亮

10. **UI优化** (需求12)
    - [ ] 响应式布局
    - [ ] 深色/浅色主题完善
    - [ ] 动画效果
    - [ ] Toast提示

## 数据库设计

### 核心表结构

1. **users** - 用户表
2. **chat_rooms** - 聊天室表
3. **room_members** - 聊天室成员表
4. **messages** - 消息表
5. **message_reactions** - 消息反应表
6. **file_metadata** - 文件元数据表
7. **notifications** - 通知表
8. **user_sessions** - 用户会话表
9. **operation_logs** - 操作日志表

详细设计见 `database/schema.sql`

## 开发规范

### 代码风格
- 使用TypeScript严格模式
- 组件使用函数式组件
- 遵循ESLint规则
- 优先使用中文注释

### 命名规范
- 组件: PascalCase (如 `ChatMessage.tsx`)
- 函数/变量: camelCase (如 `sendMessage`)
- 常量: UPPER_SNAKE_CASE (如 `MAX_FILE_SIZE`)
- 类型: PascalCase (如 `Message`, `User`)

### Git提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- test: 测试相关
- chore: 构建/工具相关

## 性能优化策略

1. **虚拟滚动**: 使用react-virtuoso处理大量消息
2. **消息分批加载**: 按天分批加载历史消息
3. **图片懒加载**: 使用Next.js Image组件
4. **WebSocket压缩**: 使用gzip压缩大消息
5. **React.memo**: 优化组件重渲染
6. **代码分割**: 按路由自动分割代码

## 安全考虑

1. **Row Level Security (RLS)**: Supabase数据库层面权限控制
2. **JWT认证**: 安全的会话管理
3. **XSS防护**: React自动转义+DOMPurify清理
4. **CSRF防护**: Next.js内置保护
5. **文件上传验证**: 文件类型、大小验证
6. **密码强度要求**: 至少8位，包含字母和数字

## 下一步计划

1. **立即执行**: 安装依赖 (`npm install`)
2. **初始化数据库**: 执行SQL脚本
3. **开发认证页面**: 实现登录/注册功能
4. **搭建WebSocket服务**: 实现实时通信
5. **开发聊天室核心功能**: 消息发送/接收

## 需要配置的外部服务

- [x] Supabase (已配置)
- [ ] WebDAV服务器 (待配置URL和凭证)
- [ ] AI服务 (已配置，用于智能功能)

## 技术支持

如遇到问题，请检查:
1. Node.js版本 >= 18.x
2. 环境变量是否正确配置
3. Supabase数据库是否已初始化
4. 网络连接是否正常

---

**创建时间**: 2025年11月9日  
**版本**: v0.1.0  
**作者**: AI开发助手
