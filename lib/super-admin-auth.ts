import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const SESSION_COOKIE_NAME = 'opos_panel_admin_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 12

export interface SuperAdminSession {
  email: string
  expiresAt: number
}

function getRequiredEnv(name: 'SUPER_ADMIN_EMAIL' | 'SUPER_ADMIN_PASSWORD' | 'SUPER_ADMIN_SECRET'): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`)
  }

  return value
}

function signPayload(payload: string): string {
  return createHmac('sha256', getRequiredEnv('SUPER_ADMIN_SECRET')).update(payload).digest('hex')
}

function encodeSession(session: SuperAdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  const signature = signPayload(payload)
  return `${payload}.${signature}`
}

function decodeSession(token: string): SuperAdminSession | null {
  const [payload, signature] = token.split('.')

  if (!payload || !signature) {
    return null
  }

  const expectedSignature = signPayload(payload)
  const expectedBuffer = Buffer.from(expectedSignature)
  const receivedBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return null
  }

  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as SuperAdminSession

    if (!decoded.email || typeof decoded.expiresAt !== 'number') {
      return null
    }

    if (decoded.expiresAt <= Date.now()) {
      return null
    }

    return decoded
  } catch {
    return null
  }
}

export function validateSuperAdminCredentials(email: string, password: string): boolean {
  return email === getRequiredEnv('SUPER_ADMIN_EMAIL') && password === getRequiredEnv('SUPER_ADMIN_PASSWORD')
}

export async function setSuperAdminSession(email: string): Promise<void> {
  const cookieStore = await cookies()
  const session: SuperAdminSession = {
    email,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }

  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(session.expiresAt),
  })
}

export async function clearSuperAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSuperAdminSession(): Promise<SuperAdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return decodeSession(token)
}

export async function requireSuperAdminSession(): Promise<SuperAdminSession> {
  const session = await getSuperAdminSession()

  if (!session) {
    redirect('/login')
  }

  return session
}
