import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { optionalAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3'
const TMDB_KEY = process.env.TMDB_API_KEY || ''
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500'

// Generic TMDB fetch helper
async function tmdbFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`)
  return res.json() as Promise<any>
}

// Map TMDB movie to our format
function formatMovie(m: any) {
  return {
    id: m.id,
    tmdbId: m.id,
    title: m.title || m.name,
    overview: m.overview,
    posterPath: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : null,
    backdropPath: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
    releaseDate: m.release_date,
    year: m.release_date ? parseInt(m.release_date.slice(0, 4)) : null,
    rating: m.vote_average ? parseFloat(m.vote_average.toFixed(1)) : 0,
    voteCount: m.vote_count || 0,
    genres: (m.genres || m.genre_ids || []).map((g: any) =>
      typeof g === 'object' ? g.name : g
    ),
    director: m.director || null,
    cast: m.cast || [],
  }
}

// GET /api/movies/trending
router.get('/trending', async (_req: Request, res: Response) => {
  try {
    if (!TMDB_KEY) {
      // Return seeded movies from DB as fallback
      const movies = await prisma.movie.findMany({ take: 20, orderBy: { rating: 'desc' } })
      return res.json({ results: movies })
    }
    const data = await tmdbFetch('/trending/movie/week')
    return res.json({ results: data.results.map(formatMovie) })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch trending movies' })
  }
})

// GET /api/movies/search?q=inception
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string) || ''
  if (!q.trim()) return res.json({ results: [] })

  try {
    if (!TMDB_KEY) {
      // Fallback: search local DB
      const movies = await prisma.movie.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        take: 20,
      })
      return res.json({ results: movies })
    }
    const data = await tmdbFetch('/search/movie', { query: q })
    return res.json({ results: data.results.map(formatMovie), total: data.total_results })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'Search failed' })
  }
})

// GET /api/movies/:tmdbId  — fetch movie details, cache in DB
router.get('/:tmdbId', optionalAuth, async (req: AuthRequest, res: Response) => {
  const tmdbId = parseInt(req.params.tmdbId)
  if (isNaN(tmdbId)) return res.status(400).json({ error: 'Invalid ID' })

  try {
    // Check DB cache first
    let movie = await prisma.movie.findUnique({ where: { tmdbId } })

    if (!movie && TMDB_KEY) {
      // Fetch from TMDB and cache
      const data = await tmdbFetch(`/movie/${tmdbId}`, { append_to_response: 'credits' })
      const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name || null
      const cast = data.credits?.cast?.slice(0, 6).map((c: any) => c.name) || []

      movie = await prisma.movie.upsert({
        where: { tmdbId },
        update: {},
        create: {
          tmdbId,
          title: data.title,
          overview: data.overview,
          posterPath: data.poster_path ? `${TMDB_IMG}${data.poster_path}` : null,
          backdropPath: data.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
            : null,
          releaseDate: data.release_date,
          year: data.release_date ? parseInt(data.release_date.slice(0, 4)) : null,
          rating: parseFloat((data.vote_average || 0).toFixed(1)),
          voteCount: data.vote_count || 0,
          genres: (data.genres || []).map((g: any) => g.name),
          director,
          cast,
        },
      })
    }

    if (!movie) return res.status(404).json({ error: 'Movie not found' })

    // Get review stats from our DB
    const reviewStats = await prisma.review.aggregate({
      where: { movieId: movie.id },
      _avg: { rating: true },
      _count: { id: true },
    })

    // If user is authenticated, check watchlist status
    let watchlistStatus = null
    if (req.user) {
      const wItem = await prisma.watchlistItem.findUnique({
        where: { userId_movieId: { userId: req.user.id, movieId: movie.id } },
      })
      watchlistStatus = wItem?.status || null
    }

    return res.json({
      ...movie,
      cvRating: reviewStats._avg.rating ? parseFloat(reviewStats._avg.rating.toFixed(1)) : null,
      cvReviewCount: reviewStats._count.id,
      watchlistStatus,
    })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'Failed to fetch movie' })
  }
})

export default router