import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const MOVIES = [
  {
    tmdbId: 27205,
    title: 'Inception',
    year: 2010,
    rating: 8.8,
    voteCount: 2341,
    director: 'Christopher Nolan',
    cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page', 'Tom Hardy', 'Ken Watanabe'],
    genres: ['Sci-Fi', 'Thriller', 'Action'],
    overview: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
    posterPath: null,
    color: '#1a2040',
  },
  {
    tmdbId: 157336,
    title: 'Interstellar',
    year: 2014,
    rating: 8.6,
    voteCount: 1987,
    director: 'Christopher Nolan',
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Michael Caine'],
    genres: ['Sci-Fi', 'Drama', 'Adventure'],
    overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    posterPath: null,
    color: '#0d2010',
  },
  {
    tmdbId: 155,
    title: 'The Dark Knight',
    year: 2008,
    rating: 9.0,
    voteCount: 3102,
    director: 'Christopher Nolan',
    cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Maggie Gyllenhaal'],
    genres: ['Action', 'Crime', 'Drama'],
    overview: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
    posterPath: null,
    color: '#200d0d',
  },
  {
    tmdbId: 496243,
    title: 'Parasite',
    year: 2019,
    rating: 8.5,
    voteCount: 1654,
    director: 'Bong Joon-ho',
    cast: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong', 'Choi Woo-shik'],
    genres: ['Thriller', 'Drama', 'Comedy'],
    overview: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.',
    posterPath: null,
    color: '#1a1020',
  },
  {
    tmdbId: 438631,
    title: 'Dune',
    year: 2021,
    rating: 8.0,
    voteCount: 1432,
    director: 'Denis Villeneuve',
    cast: ['Timothée Chalamet', 'Rebecca Ferguson', 'Zendaya', 'Oscar Isaac'],
    genres: ['Sci-Fi', 'Adventure', 'Drama'],
    overview: 'Paul Atreides, a brilliant and gifted young man born into a great destiny, must travel to the most dangerous planet in the universe to ensure the future of his family and his people.',
    posterPath: null,
    color: '#201510',
  },
  {
    tmdbId: 872585,
    title: 'Oppenheimer',
    year: 2023,
    rating: 8.9,
    voteCount: 2218,
    director: 'Christopher Nolan',
    cast: ['Cillian Murphy', 'Emily Blunt', 'Matt Damon', 'Robert Downey Jr.'],
    genres: ['Drama', 'History', 'Biography'],
    overview: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.',
    posterPath: null,
    color: '#201a00',
  },
]

async function main() {
  console.log('🌱 Seeding database...\n')

  // Create admin user
  const adminPass = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cineverse.com' },
    update: {},
    create: {
      name: 'admin',
      email: 'admin@cineverse.com',
      password: adminPass,
      role: 'ADMIN',
      bio: 'CineVerse platform administrator',
    },
  })
  console.log(`✅ Admin: admin@cineverse.com / admin123`)

  // Create sample users
  const userPass = await bcrypt.hash('password123', 12)
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'rahul@example.com' },
      update: {},
      create: { name: 'rahul_k', email: 'rahul@example.com', password: userPass, role: 'USER' },
    }),
    prisma.user.upsert({
      where: { email: 'priya@example.com' },
      update: {},
      create: { name: 'priya_m', email: 'priya@example.com', password: userPass, role: 'USER' },
    }),
    prisma.user.upsert({
      where: { email: 'arjun@example.com' },
      update: {},
      create: { name: 'arjun_s', email: 'arjun@example.com', password: userPass, role: 'USER' },
    }),
    prisma.user.upsert({
      where: { email: 'kavya@example.com' },
      update: {},
      create: { name: 'kavya_r', email: 'kavya@example.com', password: userPass, role: 'USER' },
    }),
  ])
  console.log(`✅ Sample users created (password: password123)`)

  // Create movies
  const createdMovies: any[] = []
  for (const movie of MOVIES) {
    const m = await prisma.movie.upsert({
      where: { tmdbId: movie.tmdbId },
      update: {},
      create: {
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        rating: movie.rating,
        voteCount: movie.voteCount,
        director: movie.director,
        cast: movie.cast,
        genres: movie.genres,
        overview: movie.overview,
        posterPath: movie.posterPath,
        color: movie.color,
      },
    })
    createdMovies.push(m)
  }
  console.log(`✅ ${createdMovies.length} movies seeded`)

  // Create sample reviews
  const reviewData = [
    { movieIdx: 0, userIdx: 0, rating: 5, content: 'Mind-blowing! The concept of dreams within dreams is executed flawlessly. Nolan is a genius. The practical effects and Hans Zimmer score elevate this to pure cinema.' },
    { movieIdx: 0, userIdx: 1, rating: 4, content: 'Visually stunning and intellectually stimulating. The score by Hans Zimmer is hauntingly perfect. A must-watch for anyone who loves cerebral films.' },
    { movieIdx: 1, userIdx: 2, rating: 5, content: 'Absolutely transcendent. The last 30 minutes left me speechless. Docking Score was NOT a plot hole! A love letter to space exploration and human perseverance.' },
    { movieIdx: 2, userIdx: 3, rating: 5, content: 'The greatest superhero film ever made. Heath Ledger\'s Joker is iconic, terrifying and mesmerizing all at once. A perfect crime thriller.' },
    { movieIdx: 3, userIdx: 0, rating: 5, content: 'Bong Joon-ho crafts a masterpiece of social commentary. The film operates on so many levels simultaneously — comedy, thriller, tragedy.' },
    { movieIdx: 5, userIdx: 3, rating: 4, content: 'Cillian Murphy delivers a career-defining performance. The Trinity test sequence is unforgettable. A towering achievement in historical filmmaking.' },
    { movieIdx: 4, userIdx: 1, rating: 4, content: "Denis Villeneuve's Dune is a visual feast. The world-building is extraordinary and the sound design deserves all the awards." },
    { movieIdx: 2, userIdx: 2, rating: 5, content: 'Every rewatch reveals new layers. The interrogation scene, the ferry sequence — pure filmmaking mastery. Batman Begins is great but this transcends the genre.' },
  ]

  for (const rd of reviewData) {
    const existing = await prisma.review.findFirst({
      where: { userId: rd.userIdx === 0 ? users[0].id : rd.userIdx === 1 ? users[1].id : rd.userIdx === 2 ? users[2].id : users[3].id, movieId: createdMovies[rd.movieIdx].id },
    })
    if (!existing) {
      await prisma.review.create({
        data: {
          content: rd.content,
          rating: rd.rating,
          movieId: createdMovies[rd.movieIdx].id,
          userId: rd.userIdx === 0 ? users[0].id : rd.userIdx === 1 ? users[1].id : rd.userIdx === 2 ? users[2].id : users[3].id,
        },
      })
    }
  }
  console.log(`✅ Sample reviews created`)

  console.log('\n🎬 Seed complete!\n')
  console.log('Login credentials:')
  console.log('  Admin:  admin@cineverse.com / admin123')
  console.log('  User:   rahul@example.com   / password123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
