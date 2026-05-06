import { NextRequest, NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/super-admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const BUCKET_NAME = 'releases'

async function ensureBucket() {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET_NAME)

  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
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

export async function POST(request: NextRequest) {
  try {
    const session = await getSuperAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await ensureBucket()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.exe')) {
      return NextResponse.json({ error: 'Solo se permiten archivos .exe' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: 'application/vnd.microsoft.portable-executable',
        upsert: false,
      })

    if (error) {
      return NextResponse.json({ error: `Error al subir: ${error.message}` }, { status: 500 })
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      fileName: file.name,
      sizeBytes: buffer.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
