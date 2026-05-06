'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperAdminSession } from '@/lib/super-admin-auth'

export interface ActionResult {
  success: boolean
  error?: string
}

export interface Tenant {
  id: string
  name: string
  subdomain: string
  is_active: boolean
  disabled_reason: string | null
  created_at: string
}

export interface License {
  id: string
  tenant_id: string
  license_key: string
  client_name: string
  is_active: boolean
  expires_at: string | null
  created_at: string
}

export interface DesktopRelease {
  id: string
  version: string
  channel: 'stable' | 'beta' | 'hotfix'
  platform: string
  notes: string
  artifact_url: string
  artifact_signature: string | null
  artifact_size_bytes: number | null
  is_mandatory: boolean
  is_active: boolean
  created_at: string
}

export interface TenantDevice {
  id: string
  tenant_id: string
  device_code: string
  device_name: string | null
  hostname: string | null
  current_version: string | null
  status: 'active' | 'paused' | 'retired'
  last_seen_at: string
  created_at: string
}

export interface TenantReleaseAssignment {
  id: string
  tenant_id: string
  release_id: string
  is_required: boolean
  is_enabled: boolean
  assigned_at: string
}

function sanitizeText(value: string): string {
  return value.trim()
}

function sanitizeSubdomain(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function generateLicenseKey(): string {
  const segment = () => randomBytes(2).toString('hex').toUpperCase()
  return `OPOS-${segment()}-${segment()}-${segment()}`
}

export async function createTenant(input: { name: string; subdomain: string }): Promise<ActionResult> {
  await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  const name = sanitizeText(input.name)
  const subdomain = sanitizeSubdomain(input.subdomain)

  if (!name || !subdomain) {
    return { success: false, error: 'El nombre y el subdominio son obligatorios.' }
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({
      name,
      subdomain,
      is_active: true,
      disabled_reason: null,
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    return { success: false, error: tenantError?.message || 'No se pudo crear el tenant.' }
  }

  const { error: licenseError } = await supabaseAdmin.from('licenses').insert({
    tenant_id: tenant.id,
    license_key: generateLicenseKey(),
    client_name: name,
    is_active: true,
    expires_at: null,
  })

  if (licenseError) {
    return {
      success: false,
      error: `El tenant se creó, pero falló la licencia: ${licenseError.message}`,
    }
  }

  revalidatePath('/')
  return { success: true }
}

export interface UploadReleaseResult {
  success: boolean
  url?: string
  fileName?: string
  sizeBytes?: number
  error?: string
}

const RELEASES_BUCKET = 'releases'

async function ensureReleasesBucket() {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  const exists = buckets?.some(b => b.name === RELEASES_BUCKET)

  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(RELEASES_BUCKET, {
      public: true,
      fileSizeLimit: 300 * 1024 * 1024,
      allowedMimeTypes: [
        'application/vnd.microsoft.portable-executable',
        'application/x-msdownload',
        'application/octet-stream',
        'application/x-executable',
      ],
    })

    if (error) {
      throw new Error(`No se pudo crear el bucket: ${error.message}`)
    }
  }
}

export async function uploadReleaseArtifact(formData: FormData): Promise<UploadReleaseResult> {
  await requireSuperAdminSession()

  try {
    await ensureReleasesBucket()
    const supabaseAdmin = getSupabaseAdmin()

    const file = formData.get('file') as File | null

    if (!file) {
      return { success: false, error: 'No se envió ningún archivo' }
    }

    if (!file.name.toLowerCase().endsWith('.exe')) {
      return { success: false, error: 'Solo se permiten archivos .exe' }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error } = await supabaseAdmin.storage
      .from(RELEASES_BUCKET)
      .upload(fileName, buffer, {
        contentType: 'application/vnd.microsoft.portable-executable',
        upsert: false,
      })

    if (error) {
      return { success: false, error: `Error al subir: ${error.message}` }
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(RELEASES_BUCKET).getPublicUrl(fileName)

    return {
      success: true,
      url: publicUrlData.publicUrl,
      fileName: file.name,
      sizeBytes: buffer.length,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al subir el archivo',
    }
  }
}

export async function toggleTenantStatus(input: {
  tenantId: string
  currentStatus: boolean
  reason: string
}): Promise<ActionResult> {
  await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({
      is_active: !input.currentStatus,
      disabled_reason: input.currentStatus
        ? sanitizeText(input.reason) || 'Suspendido por administración.'
        : null,
    })
    .eq('id', input.tenantId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteTenant(tenantId: string): Promise<ActionResult> {
  await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin.from('tenants').delete().eq('id', tenantId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function createLicenseForTenant(input: {
  tenantId: string
  clientName: string
}): Promise<ActionResult> {
  await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  const clientName = sanitizeText(input.clientName)

  if (!clientName) {
    return { success: false, error: 'El nombre del cliente es obligatorio.' }
  }

  const { error } = await supabaseAdmin.from('licenses').insert({
    tenant_id: input.tenantId,
    license_key: generateLicenseKey(),
    client_name: clientName,
    is_active: true,
    expires_at: null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function setLicenseStatus(input: {
  licenseId: string
  isActive: boolean
}): Promise<ActionResult> {
  await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin
    .from('licenses')
    .update({ is_active: input.isActive })
    .eq('id', input.licenseId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function createDesktopRelease(input: {
  version: string
  channel: 'stable' | 'beta' | 'hotfix'
  platform: string
  artifactUrl: string
  artifactSignature: string
  artifactSizeBytes: string
  notes: string
  isMandatory: boolean
}): Promise<ActionResult> {
  const session = await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()
  const version = sanitizeText(input.version)
  const platform = sanitizeText(input.platform)
  const artifactUrl = sanitizeText(input.artifactUrl)
  const artifactSignature = sanitizeText(input.artifactSignature)
  const notes = sanitizeText(input.notes)
  const artifactSizeBytesValue = sanitizeText(input.artifactSizeBytes)

  if (!version || !platform || !artifactUrl) {
    return { success: false, error: 'Versión, plataforma y URL del artefacto son obligatorios.' }
  }

  const artifactSizeBytes =
    artifactSizeBytesValue.length > 0 ? Number.parseInt(artifactSizeBytesValue, 10) : null

  if (artifactSizeBytesValue.length > 0 && Number.isNaN(artifactSizeBytes)) {
    return { success: false, error: 'El tamaño del artefacto debe ser numérico.' }
  }

  const { error } = await supabaseAdmin.from('desktop_releases').insert({
    version,
    channel: input.channel,
    platform,
    artifact_url: artifactUrl,
    artifact_signature: artifactSignature || null,
    artifact_size_bytes: artifactSizeBytes,
    notes,
    is_mandatory: input.isMandatory,
    created_by: session.email,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function assignReleaseToTenant(input: {
  tenantId: string
  releaseId: string
  isRequired: boolean
}): Promise<ActionResult> {
  const session = await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin.from('tenant_release_assignments').upsert(
    {
      tenant_id: input.tenantId,
      release_id: input.releaseId,
      rollout_scope: 'tenant',
      is_required: input.isRequired,
      is_enabled: true,
      assigned_by: session.email,
    },
    { onConflict: 'tenant_id,release_id' }
  )

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function assignReleaseToAllTenants(input: {
  releaseId: string
  isRequired: boolean
}): Promise<ActionResult> {
  const session = await requireSuperAdminSession()
  const supabaseAdmin = getSupabaseAdmin()

  const { data: tenants, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('is_active', true)

  if (tenantError) {
    return { success: false, error: tenantError.message }
  }

  if (!tenants || tenants.length === 0) {
    return { success: false, error: 'No hay tenants activos para asignar.' }
  }

  const rows = tenants.map(tenant => ({
    tenant_id: tenant.id,
    release_id: input.releaseId,
    rollout_scope: 'global',
    is_required: input.isRequired,
    is_enabled: true,
    assigned_by: session.email,
  }))

  const { error } = await supabaseAdmin
    .from('tenant_release_assignments')
    .upsert(rows, { onConflict: 'tenant_id,release_id' })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}
