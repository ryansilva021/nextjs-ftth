/**
 * JWT helpers for the FiberOps mobile API.
 * Uses jose (already a transitive dep of next-auth).
 * Tokens expire in 30 days.
 */

import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'fiberops-mobile-secret-change-me'
)

const ISSUER   = 'fiberops-mobile'
const AUDIENCE = 'fiberops-app'
const EXPIRY   = '30d'

export async function signMobileToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(EXPIRY)
    .sign(SECRET)
}

export async function verifyMobileToken(token) {
  const { payload } = await jwtVerify(token, SECRET, {
    issuer:   ISSUER,
    audience: AUDIENCE,
  })
  return payload
}

export function extractBearerToken(req) {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}
