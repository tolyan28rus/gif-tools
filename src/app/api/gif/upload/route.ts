import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const TMP_DIR = path.join(process.cwd(), 'tmp')
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_MIME_TYPES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'video/mp4', 'video/webm']

async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTmpDir()
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const id = randomUUID()
    const ext = file.name.split('.').pop() || 'gif'
    const inputPath = path.join(TMP_DIR, `${id}-input.${ext}`)
    await writeFile(inputPath, buffer)

    const metadata = await sharp(inputPath, { animated: true }).metadata()
    const width = metadata.width || 200
    const height = metadata.height || 200
    const pages = metadata.pages || 1
    const inputSize = buffer.length

    return NextResponse.json({
      id,
      width,
      height,
      pages,
      inputSize,
      inputPath,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
