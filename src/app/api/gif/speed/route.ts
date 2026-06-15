import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { existsSync } from 'fs'
import { readFile, unlink, mkdir } from 'fs/promises'
import path from 'path'

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
    const { inputPath, speedMultiplier } = body

    if (!inputPath || !speedMultiplier || Number(speedMultiplier) <= 0) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    const inputBuffer = await readFile(safeInputPath)
    const metadata = await sharp(inputBuffer, { animated: true }).metadata()
    
    const multiplier = Number(speedMultiplier)
    const currentDelay = metadata.delay || []
    const newDelay = currentDelay.map(d => {
      const newD = Math.round(d / multiplier)
      return Math.max(2, Math.min(newD, 6000))
    })

    // We need to use sharp with custom delay
    // Re-encode with new delays
    await sharp(inputBuffer, { animated: true })
      .gif({ effort: 10, delay: newDelay as any })
      .toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="speed-changed.gif"',
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Speed error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
