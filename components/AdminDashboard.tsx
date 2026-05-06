'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Activity,
  Building2,
  Laptop,
  Loader2,
  LogOut,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Rocket,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  assignReleaseToAllTenants,
  assignReleaseToTenant,
  createDesktopRelease,
  createLicenseForTenant,
  createTenant,
  deleteTenant,
  DesktopRelease,
  getReleaseUploadSignedUrl,
  License,
  setLicenseStatus,
  Tenant,
  TenantDevice,
  TenantReleaseAssignment,
  toggleTenantStatus,
} from '@/app/actions'
import { logoutAdmin } from '@/app/login/actions'

type TabId = 'tenants' | 'releases' | 'devices'

interface AdminDashboardProps {
  adminEmail: string
  tenants: Tenant[]
  licenses: License[]
  releases: DesktopRelease[]
  devices: TenantDevice[]
  assignments: TenantReleaseAssignment[]
}

interface CreateReleaseFormState {
  version: string
  channel: 'stable' | 'beta' | 'hotfix'
  platform: string
  artifactUrl: string
  artifactSignature: string
  artifactSizeBytes: string
  notes: string
  isMandatory: boolean
}

const initialReleaseFormState: CreateReleaseFormState = {
  version: '',
  channel: 'stable',
  platform: 'windows-x64',
  artifactUrl: '',
  artifactSignature: '',
  artifactSizeBytes: '',
  notes: '',
  isMandatory: false,
}

function cardStyle(): React.CSSProperties {
  return {
    borderRadius: 28,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--card)',
    backdropFilter: 'blur(18px)',
  }
}

function sectionTitleStyle(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: -0.4,
  }
}

function secondaryTextStyle(): React.CSSProperties {
  return {
    margin: 0,
    color: 'var(--muted)',
    fontSize: 14,
    lineHeight: 1.5,
  }
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    border: '1px solid var(--border)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '0 14px',
    outline: 'none',
  }
}

function textareaStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    minHeight: 120,
    padding: '14px',
    resize: 'vertical',
  }
}

function ghostButtonStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    borderRadius: 14,
    border: '1px solid var(--border)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '0 14px',
    cursor: 'pointer',
  }
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    minHeight: 48,
    borderRadius: 16,
    border: 'none',
    background: 'linear-gradient(135deg, #f8fafc, #dbeafe)',
    color: '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '0 18px',
  }
}

function destructiveButtonStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    borderRadius: 14,
    border: '1px solid rgba(248,113,113,0.22)',
    backgroundColor: 'rgba(248,113,113,0.12)',
    color: '#fecaca',
    cursor: 'pointer',
    padding: '0 14px',
  }
}

export default function AdminDashboard({
  adminEmail,
  tenants,
  licenses,
  releases,
  devices,
  assignments,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('tenants')
  const [tenantName, setTenantName] = useState('')
  const [tenantSubdomain, setTenantSubdomain] = useState('')
  const [tenantError, setTenantError] = useState<string | null>(null)
  const [releaseForm, setReleaseForm] = useState<CreateReleaseFormState>(initialReleaseFormState)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [tenantReleaseSelection, setTenantReleaseSelection] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const latestLicenseByTenant = useMemo(() => {
    return licenses.reduce<Record<string, License>>((accumulator, license) => {
      const current = accumulator[license.tenant_id]

      if (!current || new Date(current.created_at).getTime() < new Date(license.created_at).getTime()) {
        accumulator[license.tenant_id] = license
      }

      return accumulator
    }, {})
  }, [licenses])

  const activeAssignmentByTenant = useMemo(() => {
    return assignments.reduce<Record<string, TenantReleaseAssignment>>((accumulator, assignment) => {
      if (!assignment.is_enabled) {
        return accumulator
      }

      const current = accumulator[assignment.tenant_id]

      if (!current || new Date(current.assigned_at).getTime() < new Date(assignment.assigned_at).getTime()) {
        accumulator[assignment.tenant_id] = assignment
      }

      return accumulator
    }, {})
  }, [assignments])

  const releaseById = useMemo(() => {
    return releases.reduce<Record<string, DesktopRelease>>((accumulator, release) => {
      accumulator[release.id] = release
      return accumulator
    }, {})
  }, [releases])

  const devicesByTenant = useMemo(() => {
    return devices.reduce<Record<string, TenantDevice[]>>((accumulator, device) => {
      const current = accumulator[device.tenant_id] || []
      current.push(device)
      accumulator[device.tenant_id] = current
      return accumulator
    }, {})
  }, [devices])

  const activeTenantsCount = tenants.filter(tenant => tenant.is_active).length
  const pausedTenantsCount = tenants.length - activeTenantsCount

  const handleCreateTenant = () => {
    setTenantError(null)

    startTransition(async () => {
      const result = await createTenant({
        name: tenantName,
        subdomain: tenantSubdomain,
      })

      if (!result.success) {
        setTenantError(result.error || 'No se pudo crear el tenant.')
        return
      }

      window.location.reload()
    })
  }

  const handleCreateRelease = () => {
    setReleaseError(null)

    startTransition(async () => {
      const result = await createDesktopRelease(releaseForm)

      if (!result.success) {
        setReleaseError(result.error || 'No se pudo crear la release.')
        return
      }

      window.location.reload()
    })
  }

  const handleUploadRelease = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const signedResult = await getReleaseUploadSignedUrl(file.name)

      if (!signedResult.success || !signedResult.signedUrl) {
        setUploadError(signedResult.error || 'Error al preparar la subida.')
        return
      }

      const uploadResponse = await fetch(signedResult.signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/vnd.microsoft.portable-executable',
        },
      })

      if (!uploadResponse.ok) {
        setUploadError('Error al subir el archivo a Supabase Storage.')
        return
      }

      setReleaseForm(current => ({
        ...current,
        artifactUrl: signedResult.publicUrl ?? '',
        artifactSizeBytes: String(file.size),
      }))
    } catch {
      setUploadError('Error de conexión al subir el archivo.')
    } finally {
      setIsUploading(false)
      if (event.target) event.target.value = ''
    }
  }

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: 'tenants', label: 'Tenants', icon: Building2 },
    { id: 'releases', label: 'Releases', icon: Rocket },
    { id: 'devices', label: 'Dispositivos', icon: Laptop },
  ]

  return (
    <main style={{ padding: 24 }}>
      <div style={{ maxWidth: 1420, margin: '0 auto', display: 'grid', gap: 20 }}>
        <section
          style={{
            ...cardStyle(),
            padding: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: 'var(--muted-2)',
                  fontWeight: 700,
                }}
              >
                Control Plane
              </p>
              <h1 style={{ margin: '10px 0 0', fontSize: 38, fontWeight: 900, letterSpacing: -1.4 }}>
                Panel Admin Nuevo
              </h1>
              <p style={{ ...secondaryTextStyle(), marginTop: 12, maxWidth: 760 }}>
                Proyecto independiente para gestionar tenants, licencias, releases desktop y dispositivos
                Windows, sin tocar el flujo actual del POS web.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
              <div
                style={{
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--card-strong)',
                  color: 'var(--muted)',
                  padding: '8px 12px',
                  fontSize: 12,
                }}
              >
                {adminEmail}
              </div>
              <form action={logoutAdmin}>
                <button type="submit" style={ghostButtonStyle()}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <LogOut size={16} />
                    Cerrar sesión
                  </span>
                </button>
              </form>
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {[
            { label: 'Tenants activos', value: activeTenantsCount, color: 'var(--success)' },
            { label: 'Tenants pausados', value: pausedTenantsCount, color: 'var(--warning)' },
            { label: 'Dispositivos registrados', value: devices.length, color: 'var(--primary)' },
          ].map(card => (
            <article key={card.label} style={{ ...cardStyle(), padding: 24 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>{card.label}</p>
              <p style={{ margin: '14px 0 0', fontSize: 40, fontWeight: 900, color: card.color }}>{card.value}</p>
            </article>
          ))}
        </section>

        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {tabs.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  minHeight: 44,
                  borderRadius: 16,
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? 'linear-gradient(135deg, #f8fafc, #dbeafe)' : 'var(--card)',
                  color: active ? '#0f172a' : 'var(--text)',
                  fontWeight: active ? 800 : 600,
                  padding: '0 16px',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={16} />
                  {tab.label}
                </span>
              </button>
            )
          })}
        </section>

        {activeTab === 'tenants' && (
          <section style={{ display: 'grid', gap: 20 }}>
            <article style={{ ...cardStyle(), padding: 24 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <h2 style={sectionTitleStyle()}>Nuevo tenant</h2>
                <p style={secondaryTextStyle()}>
                  El contrato actual se mantiene intacto: subdominio → tenant.id → licencia.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 14,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  marginTop: 20,
                }}
              >
                <input
                  value={tenantName}
                  onChange={event => setTenantName(event.target.value)}
                  placeholder="Nombre del negocio"
                  style={inputStyle()}
                />
                <input
                  value={tenantSubdomain}
                  onChange={event => setTenantSubdomain(event.target.value)}
                  placeholder="Subdominio"
                  style={inputStyle()}
                />
                <button disabled={isPending} onClick={handleCreateTenant} style={primaryButtonStyle()}>
                  Crear tenant
                </button>
              </div>

              {tenantError && (
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    border: '1px solid rgba(248,113,113,0.25)',
                    backgroundColor: 'rgba(248,113,113,0.12)',
                    color: '#fecaca',
                    padding: '12px 14px',
                    fontSize: 14,
                  }}
                >
                  {tenantError}
                </div>
              )}
            </article>

            <article style={{ ...cardStyle(), overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                  <thead style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <tr>
                      {['Tenant', 'Estado', 'Licencia', 'Release', 'Dispositivos', 'Acciones'].map(header => (
                        <th
                          key={header}
                          style={{
                            padding: '14px 18px',
                            textAlign: 'left',
                            fontSize: 12,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--muted-2)',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(tenant => {
                      const license = latestLicenseByTenant[tenant.id]
                      const assignment = activeAssignmentByTenant[tenant.id]
                      const release = assignment ? releaseById[assignment.release_id] : null
                      const tenantDevices = devicesByTenant[tenant.id] || []

                      return (
                        <tr key={tenant.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            <div style={{ display: 'grid', gap: 6 }}>
                              <strong>{tenant.name}</strong>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tenant.subdomain}</span>
                            </div>
                          </td>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            <div style={{ display: 'grid', gap: 10 }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  width: 'fit-content',
                                  borderRadius: 999,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  backgroundColor: tenant.is_active ? 'rgba(52,211,153,0.14)' : 'rgba(245,158,11,0.14)',
                                  color: tenant.is_active ? '#a7f3d0' : '#fde68a',
                                }}
                              >
                                {tenant.is_active ? 'Activo' : 'Pausado'}
                              </span>
                              {!tenant.is_active && tenant.disabled_reason && (
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tenant.disabled_reason}</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            {license ? (
                              <div style={{ display: 'grid', gap: 10 }}>
                                <code style={{ fontSize: 12, color: '#bfdbfe' }}>{license.license_key}</code>
                                <button
                                  onClick={() =>
                                    startTransition(async () => {
                                      await setLicenseStatus({
                                        licenseId: license.id,
                                        isActive: !license.is_active,
                                      })
                                      window.location.reload()
                                    })
                                  }
                                  style={ghostButtonStyle()}
                                >
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <RefreshCcw size={15} />
                                    {license.is_active ? 'Revocar' : 'Reactivar'}
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  startTransition(async () => {
                                    await createLicenseForTenant({
                                      tenantId: tenant.id,
                                      clientName: tenant.name,
                                    })
                                    window.location.reload()
                                  })
                                }
                                style={ghostButtonStyle()}
                              >
                                Crear licencia
                              </button>
                            )}
                          </td>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            <div style={{ display: 'grid', gap: 10 }}>
                              {release ? (
                                <div style={{ display: 'grid', gap: 4 }}>
                                  <strong>{release.version}</strong>
                                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {release.channel} · {assignment?.is_required ? 'obligatoria' : 'opcional'}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin asignación</span>
                              )}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <select
                                  value={tenantReleaseSelection[tenant.id] || ''}
                                  onChange={event =>
                                    setTenantReleaseSelection(current => ({
                                      ...current,
                                      [tenant.id]: event.target.value,
                                    }))
                                  }
                                  style={{
                                    ...inputStyle(),
                                    minHeight: 40,
                                    padding: '0 12px',
                                  }}
                                >
                                  <option value="">Elegir release</option>
                                  {releases.map(item => (
                                    <option key={item.id} value={item.id}>
                                      {item.version} · {item.channel}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() =>
                                    startTransition(async () => {
                                      const releaseId = tenantReleaseSelection[tenant.id]

                                      if (!releaseId) {
                                        return
                                      }

                                      await assignReleaseToTenant({
                                        tenantId: tenant.id,
                                        releaseId,
                                        isRequired: false,
                                      })
                                      window.location.reload()
                                    })
                                  }
                                  style={ghostButtonStyle()}
                                >
                                  <Send size={15} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            <div style={{ display: 'grid', gap: 6 }}>
                              <strong>{tenantDevices.length}</strong>
                              {tenantDevices.slice(0, 2).map(device => (
                                <span key={device.id} style={{ fontSize: 12, color: 'var(--muted)' }}>
                                  {device.hostname || device.device_name || device.device_code}
                                  {device.current_version ? ` · ${device.current_version}` : ''}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
                              <button
                                onClick={() =>
                                  startTransition(async () => {
                                    await toggleTenantStatus({
                                      tenantId: tenant.id,
                                      currentStatus: tenant.is_active,
                                      reason: tenant.is_active ? 'Suspendido desde el panel administrativo.' : '',
                                    })
                                    window.location.reload()
                                  })
                                }
                                style={ghostButtonStyle()}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                  {tenant.is_active ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                                  {tenant.is_active ? 'Pausar' : 'Reactivar'}
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    `Se eliminará el tenant ${tenant.name}. Esta acción es irreversible.`
                                  )

                                  if (!confirmed) {
                                    return
                                  }

                                  startTransition(async () => {
                                    await deleteTenant(tenant.id)
                                    window.location.reload()
                                  })
                                }}
                                style={destructiveButtonStyle()}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                  <Trash2 size={15} />
                                  Eliminar
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {activeTab === 'releases' && (
          <section style={{ display: 'grid', gap: 20 }}>
            <article style={{ ...cardStyle(), padding: 24 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <h2 style={sectionTitleStyle()}>Nueva release desktop</h2>
                <p style={secondaryTextStyle()}>
                  Cargá la versión de Tauri y después decidí si la enviás por tenant o a todos.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 14,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  marginTop: 20,
                }}
              >
                <input
                  value={releaseForm.version}
                  onChange={event => setReleaseForm(current => ({ ...current, version: event.target.value }))}
                  placeholder="Versión"
                  style={inputStyle()}
                />
                <select
                  value={releaseForm.channel}
                  onChange={event =>
                    setReleaseForm(current => ({
                      ...current,
                      channel: event.target.value as CreateReleaseFormState['channel'],
                    }))
                  }
                  style={inputStyle()}
                >
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                  <option value="hotfix">Hotfix</option>
                </select>
                <input
                  value={releaseForm.platform}
                  onChange={event => setReleaseForm(current => ({ ...current, platform: event.target.value }))}
                  placeholder="Plataforma"
                  style={inputStyle()}
                />
                <input
                  value={releaseForm.artifactSizeBytes}
                  onChange={event =>
                    setReleaseForm(current => ({ ...current, artifactSizeBytes: event.target.value }))
                  }
                  placeholder="Tamaño del artefacto"
                  style={inputStyle()}
                />
                <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      value={releaseForm.artifactUrl}
                      onChange={event =>
                        setReleaseForm(current => ({ ...current, artifactUrl: event.target.value }))
                      }
                      placeholder="URL del artefacto"
                      style={{ ...inputStyle(), flex: 1 }}
                    />
                    <label
                      style={{
                        ...primaryButtonStyle(),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '0 18px',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        opacity: isUploading ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isUploading ? (
                        <>
                          <Loader2
                            size={16}
                            style={{
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Subir .exe
                        </>
                      )}
                      <input
                        type="file"
                        accept=".exe"
                        onChange={handleUploadRelease}
                        disabled={isUploading}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  {uploadError && (
                    <div
                      style={{
                        borderRadius: 12,
                        border: '1px solid rgba(248,113,113,0.25)',
                        backgroundColor: 'rgba(248,113,113,0.12)',
                        color: '#fecaca',
                        padding: '10px 14px',
                        fontSize: 13,
                      }}
                    >
                      {uploadError}
                    </div>
                  )}
                  {releaseForm.artifactUrl && !uploadError && (
                    <div
                      style={{
                        borderRadius: 12,
                        border: '1px solid rgba(52,211,153,0.25)',
                        backgroundColor: 'rgba(52,211,153,0.08)',
                        color: '#a7f3d0',
                        padding: '8px 14px',
                        fontSize: 12,
                        wordBreak: 'break-all',
                      }}
                    >
                      URL: {releaseForm.artifactUrl}
                    </div>
                  )}
                </div>
                <input
                  value={releaseForm.artifactSignature}
                  onChange={event =>
                    setReleaseForm(current => ({ ...current, artifactSignature: event.target.value }))
                  }
                  placeholder="Firma"
                  style={{ ...inputStyle(), gridColumn: '1 / -1' }}
                />
                <textarea
                  value={releaseForm.notes}
                  onChange={event => setReleaseForm(current => ({ ...current, notes: event.target.value }))}
                  placeholder="Notas"
                  style={{ ...textareaStyle(), gridColumn: '1 / -1' }}
                />
                <button
                  onClick={() =>
                    setReleaseForm(current => ({
                      ...current,
                      isMandatory: !current.isMandatory,
                    }))
                  }
                  style={releaseForm.isMandatory ? primaryButtonStyle() : ghostButtonStyle()}
                >
                  {releaseForm.isMandatory ? 'Release obligatoria' : 'Release opcional'}
                </button>
                <button disabled={isPending} onClick={handleCreateRelease} style={primaryButtonStyle()}>
                  Crear release
                </button>
              </div>

              {releaseError && (
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    border: '1px solid rgba(248,113,113,0.25)',
                    backgroundColor: 'rgba(248,113,113,0.12)',
                    color: '#fecaca',
                    padding: '12px 14px',
                    fontSize: 14,
                  }}
                >
                  {releaseError}
                </div>
              )}
            </article>

            <article style={{ ...cardStyle(), overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                  <thead style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <tr>
                      {['Versión', 'Canal', 'Plataforma', 'Obligatoria', 'Artefacto', 'Acciones'].map(header => (
                        <th
                          key={header}
                          style={{
                            padding: '14px 18px',
                            textAlign: 'left',
                            fontSize: 12,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--muted-2)',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map(release => (
                      <tr key={release.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <td style={{ padding: 18, verticalAlign: 'top' }}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <strong>{release.version}</strong>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{release.notes || 'Sin notas'}</span>
                          </div>
                        </td>
                        <td style={{ padding: 18 }}>{release.channel}</td>
                        <td style={{ padding: 18 }}>{release.platform}</td>
                        <td style={{ padding: 18 }}>{release.is_mandatory ? 'Sí' : 'No'}</td>
                        <td style={{ padding: 18 }}>
                          <a href={release.artifact_url} target="_blank" rel="noreferrer" style={{ color: '#bfdbfe' }}>
                            Abrir artefacto
                          </a>
                        </td>
                        <td style={{ padding: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() =>
                                startTransition(async () => {
                                  await assignReleaseToAllTenants({
                                    releaseId: release.id,
                                    isRequired: release.is_mandatory,
                                  })
                                  window.location.reload()
                                })
                              }
                              style={ghostButtonStyle()}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <Send size={15} />
                                Enviar a todos
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {activeTab === 'devices' && (
          <section style={{ display: 'grid', gap: 20 }}>
            <article style={{ ...cardStyle(), padding: 24 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <h2 style={sectionTitleStyle()}>Dispositivos desktop</h2>
                <p style={secondaryTextStyle()}>
                  Estos registros se llenan desde las APIs nuevas del POS cuando la app Tauri registra
                  dispositivos y reporta instalaciones.
                </p>
              </div>
            </article>

            <article style={{ ...cardStyle(), overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                  <thead style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <tr>
                      {['Dispositivo', 'Tenant', 'Versión actual', 'Estado', 'Última conexión'].map(header => (
                        <th
                          key={header}
                          style={{
                            padding: '14px 18px',
                            textAlign: 'left',
                            fontSize: 12,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--muted-2)',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {devices.length === 0 && (
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <td colSpan={5} style={{ padding: 26, color: 'var(--muted)', textAlign: 'center' }}>
                          Todavía no hay dispositivos registrados.
                        </td>
                      </tr>
                    )}
                    {devices.map(device => {
                      const tenant = tenants.find(item => item.id === device.tenant_id)

                      return (
                        <tr key={device.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            <div style={{ display: 'grid', gap: 6 }}>
                              <strong>{device.device_name || device.hostname || device.device_code}</strong>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{device.device_code}</span>
                            </div>
                          </td>
                          <td style={{ padding: 18, verticalAlign: 'top' }}>
                            <div style={{ display: 'grid', gap: 6 }}>
                              <strong>{tenant?.name || 'Tenant desconocido'}</strong>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tenant?.subdomain || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: 18 }}>{device.current_version || 'Sin informar'}</td>
                          <td style={{ padding: 18 }}>{device.status}</td>
                          <td style={{ padding: 18 }}>{new Date(device.last_seen_at).toLocaleString('es-AR')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>

            <section
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              {[
                {
                  title: '1. Registro',
                  text: 'La app desktop informa device_code, hostname y versión actual.',
                  icon: Activity,
                  color: '#93c5fd',
                },
                {
                  title: '2. Check update',
                  text: 'Consulta la última release asignada al tenant.',
                  icon: RefreshCcw,
                  color: '#86efac',
                },
                {
                  title: '3. Descarga',
                  text: 'Usa la URL del artefacto publicada en el panel.',
                  icon: Rocket,
                  color: '#f0abfc',
                },
                {
                  title: '4. Reporte',
                  text: 'Informa si descargó, instaló o falló.',
                  icon: Send,
                  color: '#fde68a',
                },
              ].map(item => {
                const Icon = item.icon

                return (
                  <article key={item.title} style={{ ...cardStyle(), padding: 20 }}>
                    <Icon size={18} color={item.color} />
                    <h3 style={{ margin: '14px 0 0', fontSize: 16, fontWeight: 800 }}>{item.title}</h3>
                    <p style={{ ...secondaryTextStyle(), marginTop: 8 }}>{item.text}</p>
                  </article>
                )
              })}
            </section>
          </section>
        )}
      </div>
    </main>
  )
}
