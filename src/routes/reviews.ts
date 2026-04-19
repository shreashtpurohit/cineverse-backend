import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth'
import { getIo } from '../lib/socket'

const router = Router()

const reviewSchema = z.object({
  content: z.string().min(10).max(2000),
  rating: z.number().int().min(1).max(5),
  movieId: z.string(),
})

// GET /api/reviews/:movieId  — get reviews for a movie
router.get('/:movieId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { movieId } = req.params
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const skip = (page - 1) * limit

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { movieId },
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
          _count: { select: { likes: true } },
          ...(req.user
            ? {
                likes: {
                  where: { userId: req.user.id },
                  select: { id: true },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { movieId } }),
    ])

    const formatted = reviews.map((r: any) => ({
      ...r,
      likeCount: r._count.likes,
      likedByMe: req.user ? r.likes?.length > 0 : false,
      _count: undefined,
      likes: undefined,
    }))

    return res.json({ reviews: formatted, total, page, pages: Math.ceil(total / limit) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

// POST /api/reviews — create review
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = reviewSchema.parse(req.body)

    // Check movie exists
    const movie = await prisma.movie.findUnique({ where: { id: body.movieId } })
    if (!movie) return res.status(404).json({ error: 'Movie not found' })

    // One review per user per movie
    const existing = await prisma.review.findFirst({
      where: { userId: req.user!.id, movieId: body.movieId },
    })
    if (existing) return res.status(409).json({ error: 'You already reviewed this movie' })

    const review = await prisma.review.create({
      data: {
        content: body.content,
        rating: body.rating,
        movieId: body.movieId,
        userId: req.user!.id,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
        _count: { select: { likes: true } },
      },
    })

    return res.status(201).json({ ...review, likeCount: 0, likedByMe: false })
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(400).json({ error: e.errors[0].message })
    console.error(e)
    return res.status(500).json({ error: 'Failed to create review' })
  }
})

// PUT /api/reviews/:id — edit own review
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } })
    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your review' })
    }

    const body = z
      .object({ content: z.string().min(10).max(2000).optional(), rating: z.number().int().min(1).max(5).optional() })
      .parse(req.body)

    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: body,
      include: { user: { select: { id: true, name: true, avatar: true, role: true } }, _count: { select: { likes: true } } },
    })

    return res.json({ ...updated, likeCount: updated._count.likes })
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(400).json({ error: e.errors[0].message })
    console.error(e)
    return res.status(500).json({ error: 'Failed to update review' })
  }
})

// DELETE /api/reviews/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } })
    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your review' })
    }

    await prisma.review.delete({ where: { id: req.params.id } })
    return res.json({ message: 'Review deleted' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to delete review' })
  }
})

// POST /api/reviews/:id/like — toggle like
router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const review = await prisma.review.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true } } },
    })
    if (!review) return res.status(404).json({ error: 'Review not found' })

    const existing = await prisma.reviewLike.findUnique({
      where: { reviewId_userId: { reviewId: req.params.id, userId: req.user!.id } },
    })

    if (existing) {
      // Unlike
      await prisma.reviewLike.delete({ where: { id: existing.id } })
    } else {
      // Like
      await prisma.reviewLike.create({
        data: { reviewId: req.params.id, userId: req.user!.id },
      })

      // Notify review author (not self-like)
      if (review.user.id !== req.user!.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: review.user.id,
            type: 'REVIEW_LIKE',
            message: `${req.user!.name} liked your review`,
            data: { reviewId: req.params.id, fromUserId: req.user!.id },
          },
        })

        // Emit real-time notification via Socket.io
        try {
          const io = getIo()
          io.to(`user:${review.user.id}`).emit('notification', notification)
        } catch {
          // Socket.io not available — ignore
        }
      }
    }

    const likeCount = await prisma.reviewLike.count({ where: { reviewId: req.params.id } })
    return res.json({ liked: !existing, likeCount })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to toggle like' })
  }
})

export default router
