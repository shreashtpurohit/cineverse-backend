import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { getIo } from '../lib/socket'

const router = Router()

// GET /api/users/:id/profile
router.get('/:id/profile', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            reviews: true,
            followers: true,
            following: true,
          },
        },
      },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const recentReviews = await prisma.review.findMany({
      where: { userId: req.params.id },
      include: { movie: { select: { id: true, title: true, posterPath: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return res.json({ ...user, recentReviews })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// POST /api/users/:id/follow — toggle follow
router.post('/:id/follow', authenticate, async (req: AuthRequest, res: Response) => {
  const targetId = req.params.id
  const userId = req.user!.id

  if (targetId === userId) return res.status(400).json({ error: 'Cannot follow yourself' })

  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } })
    if (!target) return res.status(404).json({ error: 'User not found' })

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: targetId } },
    })

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } })
      return res.json({ following: false })
    } else {
      await prisma.follow.create({ data: { followerId: userId, followingId: targetId } })

      // Notify the followed user
      const notification = await prisma.notification.create({
        data: {
          userId: targetId,
          type: 'NEW_FOLLOWER',
          message: `${req.user!.name} started following you`,
          data: { fromUserId: userId },
        },
      })

      try {
        const io = getIo()
        io.to(`user:${targetId}`).emit('notification', notification)
      } catch {
        // Socket.io not available
      }

      return res.json({ following: true })
    }
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to toggle follow' })
  }
})

export default router
