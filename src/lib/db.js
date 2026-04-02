/**
 * src/lib/db.js
 * Singleton de conexão MongoDB com Mongoose para Next.js 16.
 *
 * Em ambientes serverless (Vercel, etc.) o módulo é reavaliado a cada
 * cold start mas o objeto `global` persiste entre requisições quentes.
 * Por isso o cache é guardado em `global._mongooseCache`.
 *
 * Uso em Server Actions:
 *   import { connectDB } from '@/lib/db'
 *   await connectDB()
 */

import mongoose from 'mongoose'

/** @type {{ conn: mongoose.Connection | null; promise: Promise<mongoose.Connection> | null }} */
const cached = global._mongooseCache ?? { conn: null, promise: null }
global._mongooseCache = cached

/**
 * Garante uma única conexão ativa com o MongoDB.
 * Idempotente: chamadas subsequentes retornam a conexão em cache.
 *
 * @returns {Promise<mongoose.Connection>}
 */
export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI não definida. Adicione ao .env.local:\n' +
      'MONGODB_URI=mongodb+srv://user:pass@cluster/ftthdb'
    )
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
      })
      .then((m) => m.connection)
      .catch((err) => {
        cached.promise = null
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}
