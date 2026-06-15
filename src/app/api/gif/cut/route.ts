import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { readFile, unlink, rename, mkdir, readdir, rm } from 'fs/promises'
import path from 'path'
import { execFfmpeg } from '@/lib/ffmpeg-path'
import { detectFormat } from '@/lib/format-helper'

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
    const { inputPath, startFrame, endFrame } = body

    if (!inputPath || startFrame === undefined || endFrame === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const sFrame = Number(startFrame)
    const eFrame = Number(endFrame)
    if (sFrame < 0 || eFrame < 0 || eFrame < sFrame) {
      return NextResponse.json({ error: 'Invalid frame range' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const fmt = detectFormat(inputPath)
    const outputPath = path.join(TMP_DIR, `${id}-output.${fmt.ext}`)
    const framesDir = path.join(TMP_DIR, `${id}-cut-frames`)

    await mkdir(framesDir, { recursive: true })
    await execFfmpeg([
      '-i', safeInputPath,
      '-vsync', 'passthrough',
      path.join(framesDir, 'frame_%04d.png'),
    ])

    const allFrames = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()
    const selectedFrames = allFrames.slice(sFrame, eFrame + 1)

    for (let i = 0; i < selectedFrames.length; i++) {
      const oldPath = path.join(framesDir, selectedFrames[i])
      const newPath = path.join(framesDir, `cut_${String(i + 1).padStart(4, '0')}.png`)
      await rename(oldPath, newPath)
    }

    for (const frame of allFrames) {
      if (!selectedFrames.includes(frame)) {
        try { await unlink(path.join(framesDir, frame)) } catch {}
      }
    }

    const palettePath = path.join(TMP_DIR, `${id}-palette.png`)
    await execFfmpeg([
      '-i', path.join(framesDir, 'cut_%04d.png'),
      '-vf', 'palettegen=stats_mode=diff',
      palettePath,
    ])
    await execFfmpeg([
      '-i', path.join(framesDir, 'cut_%04d.png'),
      '-i', palettePath,
      '-filter_complex', 'paletteuse=dither=bayer:bayer_scale=3',
      outputPath,
    ])
    try { await unlink(palettePath) } catch {}

    const outputBuffer = await readFile(outputPath)

    try { await rm(framesDir, { recursive: true, force: true }) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': fmt.mimeType,
        'Content-Disposition': `attachment; filename="cut.${fmt.ext}"`,
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Cut error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
