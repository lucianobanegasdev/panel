'use server'

import { redirect } from 'next/navigation'
import { clearSuperAdminSession, setSuperAdminSession, validateSuperAdminCredentials } from '@/lib/super-admin-auth'

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!validateSuperAdminCredentials(email, password)) {
    redirect('/login?error=true')
  }

  await setSuperAdminSession(email)
  redirect('/')
}

export async function logoutAdmin(): Promise<void> {
  await clearSuperAdminSession()
  redirect('/login')
}
