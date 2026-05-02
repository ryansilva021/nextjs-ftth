/**
 * /api/noc/connections/[...path]
 *
 * Proxy autenticado para o gerenciamento de conexões do fiberops-network-lab.
 * Evita chamadas diretas do browser para o lab (port 4000), eliminando
 * problemas de CORS, autenticação e "Failed to fetch".
 *
 * Repassa GET / POST / PUT / DELETE para:
 *   NEXT_PUBLIC_NETWORK_LAB_URL/api/connections/[...path]
 */

import { NextResponse } from 'next/server'
import { auth }         from '@/lib/auth'
import { hasPermission, PERM } from '@/lib/permissions'

const LAB_BASE = process.env.NEXT_PUBLIC_NETWORK_LAB_URL ?? 'http://localhost:4000'

async function requireNOC() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }
  if (!hasPermission((session.user as any).role, PERM.ACCESS_NOC)) {
    return { error: NextResponse.json({ error: 'Acesso restrito ao NOC' }, { status: 403 }) }
  }
  return { session }
}

function labOffline() {
  return NextResponse.json(
    { error: 'network-lab offline', labOnline: false },
    { status: 503 }
  )
}

async function proxyRequest(request: Request, segments: string[], method: string) {
  const path    = segments.join('/')
  const labUrl  = new URL(`${LAB_BASE}/api/connections/${path}`)

  // Forward query params
  const sp = new URL(request.url).searchParams
  sp.forEach((v, k) => labUrl.searchParams.set(k, v))

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = process.env.NETWORK_LAB_TOKEN
  if (token) headers['Authorization'] = `Bearer ${token}`

  const opts: RequestInit = {
    method,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  }

  if (method !== 'GET' && method !== 'DELETE') {
    try { opts.body = await request.text() } catch { opts.body = '{}' }
  }

  try {
    const res  = await fetch(labUrl.toString(), opts)
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    console.error('[noc/connections proxy]', e.message)
    return labOffline()
  }
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: Request, { params }: Ctx) {
  const { error } = await requireNOC()
  if (error) return error
  const { path } = await params
  return proxyRequest(req, path ?? [], 'GET')
}

export async function POST(req: Request, { params }: Ctx) {
  const { error } = await requireNOC()
  if (error) return error
  const { path } = await params
  return proxyRequest(req, path ?? [], 'POST')
}

export async function PUT(req: Request, { params }: Ctx) {
  const { error } = await requireNOC()
  if (error) return error
  const { path } = await params
  return proxyRequest(req, path ?? [], 'PUT')
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { error } = await requireNOC()
  if (error) return error
  const { path } = await params
  return proxyRequest(req, path ?? [], 'DELETE')
}
