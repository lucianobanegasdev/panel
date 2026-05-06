import { redirect } from 'next/navigation'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { getSuperAdminSession } from '@/lib/super-admin-auth'
import { login } from './actions'

interface LoginPageProps {
  searchParams: Promise<{
    error?: string
  }>
}

function fieldStyle() {
  return {
    width: '100%',
    height: 54,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '0 16px 0 44px',
    outline: 'none',
  } satisfies React.CSSProperties
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSuperAdminSession()

  if (session) {
    redirect('/')
  }

  const params = await searchParams
  const hasError = params.error === 'true'

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 32,
          border: '1px solid var(--border)',
          backgroundColor: 'rgba(10,12,18,0.8)',
          backdropFilter: 'blur(18px)',
          padding: 32,
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              background: 'linear-gradient(135deg, var(--primary), var(--primary-strong))',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 20px 50px rgba(37,99,235,0.35)',
            }}
          >
            <ShieldCheck size={34} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>Nuevo Panel Admin</h1>
            <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 14 }}>
              Proyecto nuevo e independiente para gestionar OPOS.
            </p>
          </div>
        </div>

        <form action={login} style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Correo electrónico</span>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 15, top: 18, color: 'var(--muted-2)' }} />
              <input name="email" type="email" required placeholder="admin@opos.com" style={fieldStyle()} />
            </div>
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>Contraseña</span>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 15, top: 18, color: 'var(--muted-2)' }} />
              <input name="password" type="password" required placeholder="••••••••" style={fieldStyle()} />
            </div>
          </label>

          {hasError && (
            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(248,113,113,0.25)',
                backgroundColor: 'rgba(248,113,113,0.12)',
                color: '#fecaca',
                padding: '14px 16px',
                fontSize: 14,
              }}
            >
              Credenciales incorrectas.
            </div>
          )}

          <button
            type="submit"
            style={{
              height: 54,
              borderRadius: 18,
              border: 'none',
              background: 'linear-gradient(135deg, #f8fafc, #dbeafe)',
              color: '#0f172a',
              fontWeight: 800,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Ingresar al panel
          </button>
        </form>
      </section>
    </main>
  )
}
