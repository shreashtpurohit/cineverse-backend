import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/watchlist — get user's watchlist
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.watchlistItem.findMany({
      where: { userId: req.user!.id },
      include: { movie: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.json(items)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch watchlist' })
  }
})

// POST /api/watchlist — add movie to watchlist
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      movieId: z.string(),
      status: z.enum(['PLAN_TO_WATCH', 'WATCHING', 'WATCHED', 'DROPPED']).optional(),
    }).parse(req.body)

    const movie = await prisma.movie.findUnique({ where: { id: body.movieId } })
    if (!movie) return res.status(404).json({ error: 'Movie not found' })

    const item = await prisma.watchlistItem.upsert({
      where: { userId_movieId: { userId: req.user!.id, movieId: body.movieId } },
      update: { status: body.status || 'PLAN_TO_WATCH' },
      create: {
        userId: req.user!.id,
        movieId: body.movieId,
        status: body.status || 'PLAN_TO_WATCH',
      },
      include: { movie: true },
    })

    return res.status(201).json(item)
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(400).json({ error: e.errors[0].message })
    console.error(e)
    return res.status(500).json({ error: 'Failed to add to watchlist' })
  }
})

// PUT /api/watchlist/:id — update status
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      status: z.enum(['PLAN_TO_WATCH', 'WATCHING', 'WATCHED', 'DROPPED']),
    }).parse(req.body)

    const item = await prisma.watchlistItem.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.userId !== req.user!.id) return res.status(403).json({ error: 'Not your watchlist' })

    const updated = await prisma.watchlistItem.update({
      where: { id: req.params.id },
      data: { status: body.status },
      include: { movie: true },
    })
    return res.json(updated)
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(400).json({ error: e.errors[0].message })
    console.error(e)
    return res.status(500).json({ error: 'Failed to update watchlist' })
  }
})

// DELETE /api/watchlist/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.watchlistItem.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.userId !== req.user!.id) return res.status(403).json({ error: 'Not your watchlist' })

    await prisma.watchlistItem.delete({ where: { id: req.params.id } })
    return res.json({ message: 'Removed from watchlist' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to remove from watchlist' })
  }
})

export default router
