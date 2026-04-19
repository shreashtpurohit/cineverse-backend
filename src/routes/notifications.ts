import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, read: false },
    })
    return res.json({ notifications, unreadCount })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    })
    return res.json({ message: 'All notifications marked as read' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to update notifications' })
  }
})

export default router
