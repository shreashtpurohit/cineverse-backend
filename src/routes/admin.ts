import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/admin/stats
router.get('/stats', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [userCount, reviewCount, movieCount] = await Promise.all([
      prisma.user.count(),
      prisma.review.count(),
      prisma.movie.count(),
    ])

    // Active today (users who wrote reviews today)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const activeToday = await prisma.review.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: todayStart } },
    })

    // Growth: users and reviews per month for last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyReviews = await prisma.review.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    })
    const monthlyUsers = await prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    })

    // Group by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const growthMap: Record<string, { users: number; reviews: number }> = {}

    monthlyUsers.forEach(u => {
      const key = months[u.createdAt.getMonth()]
      if (!growthMap[key]) growthMap[key] = { users: 0, reviews: 0 }
      growthMap[key].users++
    })
    monthlyReviews.forEach(r => {
      const key = months[r.createdAt.getMonth()]
      if (!growthMap[key]) growthMap[key] = { users: 0, reviews: 0 }
      growthMap[key].reviews++
    })

    const growth = Object.entries(growthMap).map(([month, data]) => ({ month, ...data }))

    // Top genres from movies
    const movies = await prisma.movie.findMany({ select: { genres: true } })
    const genreMap: Record<string, number> = {}
    movies.forEach(m => m.genres.forEach(g => { genreMap[g] = (genreMap[g] || 0) + 1 }))
    const genres = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, count]) => ({ genre, count }))

    // Recent users
    const recentUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { reviews: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return res.json({
      users: userCount,
      reviews: reviewCount,
      movies: movieCount,
      activeToday: activeToday.length,
      growth,
      genres,
      recentUsers: recentUsers.map(u => ({
        ...u,
        reviews: u._count.reviews,
        _count: undefined,
      })),
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch admin stats' })
  }
})

// GET /api/admin/users — list all users
router.get('/users', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.json(users.map(u => ({ ...u, reviews: u._count.reviews, _count: undefined })))
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// PUT /api/admin/users/:id/ban — ban/unban user (sets role to USER, optionally delete)
router.delete('/users/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' })
    }
    await prisma.user.delete({ where: { id: req.params.id } })
    return res.json({ message: 'User deleted' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to delete user' })
  }
})

export default router
