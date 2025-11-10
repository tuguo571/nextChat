/**
 * Next.js + Socket.IO 集成服务器
 * 单一进程同时运行 Next.js 和 Socket.IO
 */

// {{ AURA: Add - 加载环境变量文件 }}
require('dotenv').config({ path: '.env.local' })

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { setupSocketHandlers } = require('./socketHandlers')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

// 创建 Next.js 应用
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // 创建 HTTP 服务器
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  // 创建 Socket.IO 服务器
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? 'http://localhost:3000' : false,
      methods: ['GET', 'POST'],
    },
    // 连接选项
    pingTimeout: 60000,
    pingInterval: 25000,
    // 传输方式
    transports: ['websocket', 'polling'],
  })

  // 设置 Socket.IO 事件处理器
  setupSocketHandlers(io)

  // 启动服务器
  httpServer.listen(port, (err) => {
    if (err) throw err
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║  🚀 服务器启动成功！                              ║
║                                                   ║
║  📡 Next.js + Socket.IO 运行在:                   ║
║     http://${hostname}:${port}                           ║
║                                                   ║
║  💬 Socket.IO 端点:                               ║
║     ws://${hostname}:${port}                             ║
║                                                   ║
║  🔧 模式: ${dev ? 'Development' : 'Production'}                        ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `)
  })

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('🛑 收到 SIGTERM 信号，准备关闭服务器...')
    
    io.close(() => {
      console.log('✅ Socket.IO 服务器已关闭')
    })

    httpServer.close(() => {
      console.log('✅ HTTP 服务器已关闭')
      process.exit(0)
    })
  })
})
