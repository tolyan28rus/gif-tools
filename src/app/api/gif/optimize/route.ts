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
    const { inputPath, colors } = body

    if (!inputPath) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    const inputBuffer = await readFile(safeInputPath)

    const gifOptions: sharp.GifOptions = { effort: 10 }
    
    if (colors) {
      gifOptions.colours = Number(colors)
    }

    await sharp(inputBuffer, { animated: true })
      .gif(gifOptions)
      .toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="optimized.gif"',
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Optimize error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
