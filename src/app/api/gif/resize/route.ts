import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { existsSync } from 'fs'
import { readFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { detectFormat, pickOutputFormat, extensionToFormat } from '@/lib/format-helper'

const TMP_DIR = path.join(process.cwd(), 'tmp')

async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTmpDir()
    const body = await request.json()
    const { inputPath, width, height, maintainAspect } = body

    if (!inputPath || !width) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const fmt = detectFormat(inputPath)
    const outputExt = pickOutputFormat(fmt.ext)
    const outputPath = path.join(TMP_DIR, `${id}-output.${outputExt}`)
    const formatKey = extensionToFormat(outputExt)

    const inputBuffer = await readFile(safeInputPath)

    let resizeOptions: sharp.ResizeOptions = {
      width: Number(width),
      withoutEnlargement: true,
    }

    if (height) {
      resizeOptions.height = Number(height)
    }

    if (maintainAspect === true) {
      resizeOptions.fit = 'inside'
    }

    await sharp(inputBuffer, { animated: fmt.isAnimated })
      .resize(resizeOptions)
      .toFormat(formatKey, { effort: 10 } as any)
      .toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': fmt.mimeType,
        'Content-Disposition': `attachment; filename="resized.${outputExt}"`,
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Resize error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
