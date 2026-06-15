import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { readFile, unlink, rename, mkdir, readdir, rm } from 'fs/promises'
import path from 'path'
import { execFfmpeg } from '@/lib/ffmpeg-path'

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
    const { inputPath } = body

    if (!inputPath) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const framesDir = path.join(TMP_DIR, `${id}-frames`)
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    await mkdir(framesDir, { recursive: true })
    await execFfmpeg([
      '-i', safeInputPath,
      '-vsync', 'passthrough',
      path.join(framesDir, 'frame_%04d.png'),
    ])

    const frames = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()
    const reversedFrames = [...frames].reverse()

    for (let i = 0; i < reversedFrames.length; i++) {
      const oldPath = path.join(framesDir, reversedFrames[i])
      const newPath = path.join(framesDir, `rev_${String(i + 1).padStart(4, '0')}.png`)
      await rename(oldPath, newPath)
    }

    const palettePath = path.join(TMP_DIR, `${id}-palette.png`)
    await execFfmpeg([
      '-i', path.join(framesDir, 'rev_%04d.png'),
      '-vf', 'palettegen=stats_mode=diff',
      palettePath,
    ])
    await execFfmpeg([
      '-i', path.join(framesDir, 'rev_%04d.png'),
      '-i', palettePath,
      '-filter_complex', 'paletteuse=dither=bayer:bayer_scale=3',
      outputPath,
    ])
    try { await unlink(palettePath) } catch {}

    const outputBuffer = await readFile(outputPath)

    try { await unlink(outputPath) } catch {}
    try { await rm(framesDir, { recursive: true, force: true }) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="reversed.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Reverse error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
