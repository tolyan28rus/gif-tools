import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { existsSync } from 'fs'
import { readFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { execFfmpeg } from '@/lib/ffmpeg-path'
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
    const { inputPath, angle } = body

    if (!inputPath || angle === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const fmt = detectFormat(inputPath)
    const outputExt = pickOutputFormat(fmt.ext)
    const outputPath = path.join(TMP_DIR, `${id}-output.${outputExt}`)
    const formatKey = extensionToFormat(outputExt)

    const metadata = await sharp(safeInputPath, { animated: fmt.isAnimated }).metadata()

    if (metadata.pages && metadata.pages > 1) {
      const a = Number(angle) % 360
      const rad = (a * Math.PI) / 180
      const w = metadata.width || 480
      const h = metadata.height || 480
      const cos = Math.abs(Math.cos(rad))
      const sin = Math.abs(Math.sin(rad))
      const outW = Math.ceil(w * cos + h * sin)
      const outH = Math.ceil(w * sin + h * cos)

      let vf: string
      if (a === 90) vf = 'transpose=1'
      else if (a === 180) vf = 'transpose=1,transpose=1'
      else if (a === 270) vf = 'transpose=2'
      else vf = `rotate=${rad}:ow=${outW}:oh=${outH}:c=0x00000000`

      await execFfmpeg([
        '-i', safeInputPath,
        '-vf', vf,
        '-y', outputPath,
      ])
    } else {
      await sharp(safeInputPath)
        .rotate(Number(angle))
        .toFormat(formatKey, { effort: 10 } as any)
        .toFile(outputPath)
    }

    const outputBuffer = await readFile(outputPath)

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': fmt.mimeType,
        'Content-Disposition': `attachment; filename="rotated.${outputExt}"`,
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Rotate error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
