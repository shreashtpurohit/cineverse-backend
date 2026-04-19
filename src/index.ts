import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'

import { setIo } from './lib/socket'
import authRoutes from './routes/auth'
import moviesRoutes from './routes/movies'
import reviewsRoutes from './routes/reviews'
import watchlistRoutes from './routes/watchlist'
import usersRoutes from './routes/users'
import notificationsRoutes from './routes/notifications'
import adminRoutes from './routes/admin'

const app = express()
const httpServer = createServer(app)

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// ── Socket.io ─────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

setIo(io)

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next() // allow unauthenticated connections
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
    socket.data.userId = payload.id
    next()
  } catch {
    next() // don't block connection, just won't be in user room
  }
})

io.on('connection', socket => {
  const userId = socket.data.userId
  if (userId) {
    socket.join(`user:${userId}`)
    console.log(`[Socket] User ${userId} connected`)
  }

  socket.on('disconnect', () => {
    if (userId) console.log(`[Socket] User ${userId} disconnected`)
  })
})

// ── Middleware ────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}))
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', limiter)

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts, please try again later' },
})
app.use('/api/auth', authLimiter)

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/movies', moviesRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/watchlist', watchlistRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/admin', adminRoutes)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`\n🎬 CineVerse API running on http://localhost:${PORT}`)
  console.log(`📡 Socket.io ready`)
  console.log(`🌍 Accepting requests from: ${FRONTEND_URL}\n`)
})

export default app
