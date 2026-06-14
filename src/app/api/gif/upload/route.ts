import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const TMP_DIR = '/home/z/my-project/tmp'

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const id = randomUUID()
    const inputPath = path.join(TMP_DIR, `${id}-input.gif`)
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
