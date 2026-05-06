import { redirect } from 'next/navigation'
import {
  DesktopRelease,
  License,
  Tenant,
  TenantDevice,
  TenantReleaseAssignment,
} from '@/app/actions'
import AdminDashboard from '@/components/AdminDashboard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSuperAdminSession } from '@/lib/super-admin-auth'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  if (!session) {
    redirect('/login')
  }

  const [tenantsResult, licensesResult, releasesResult, devicesResult, assignmentsResult] =
    await Promise.all([
      supabaseAdmin
        .from('tenants')
        .select('id, name, subdomain, is_active, disabled_reason, created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('licenses')
        .select('id, tenant_id, license_key, client_name, is_active, expires_at, created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('desktop_releases')
        .select(
          'id, version, channel, platform, notes, artifact_url, artifact_signature, artifact_size_bytes, is_mandatory, is_active, created_at'
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('tenant_devices')
        .select('id, tenant_id, device_code, device_name, hostname, current_version, status, last_seen_at, created_at')
        .order('last_seen_at', { ascending: false }),
      supabaseAdmin
        .from('tenant_release_assignments')
        .select('id, tenant_id, release_id, is_required, is_enabled, assigned_at')
        .order('assigned_at', { ascending: false }),
    ])

  return (
    <AdminDashboard
      adminEmail={session.email}
      tenants={(tenantsResult.data || []) as Tenant[]}
      licenses={(licensesResult.data || []) as License[]}
      releases={(releasesResult.data || []) as DesktopRelease[]}
      devices={(devicesResult.data || []) as TenantDevice[]}
      assignments={(assignmentsResult.data || []) as TenantReleaseAssignment[]}
    />
  )
}
