import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { existsSync } from 'fs'
import { readFile, mkdir } from 'fs/promises'
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
    const { inputPath, direction } = body

    if (!inputPath || !direction) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const fmt = detectFormat(inputPath)
    const outputExt = pickOutputFormat(fmt.ext)
    const formatKey = extensionToFormat(outputExt)
    const outputPath = path.join(TMP_DIR, `${id}-output.${outputExt}`)

    const inputBuffer = await readFile(safeInputPath)
    const metadata = await sharp(inputBuffer, { animated: fmt.isAnimated }).metadata()
    const pages = metadata.pages || 1

    const doHFlip = direction === 'horizontal' || direction === 'both'
    const doVFlip = direction === 'vertical' || direction === 'both'

    if (pages > 1 && fmt.isGif) {
      const { execFfmpeg } = await import('@/lib/ffmpeg-path')
      const framesDir = path.join(TMP_DIR, `${id}-flip-frames`)
      const outFramesDir = path.join(TMP_DIR, `${id}-flip-out`)
      const { readdir, unlink, rm } = await import('fs/promises')

      await mkdir(framesDir, { recursive: true })
      await mkdir(outFramesDir, { recursive: true })

      await execFfmpeg([
        '-i', safeInputPath,
        '-fps_mode', 'passthrough',
        path.join(framesDir, 'frame_%04d.png'),
      ])

      const frameFiles = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()

      for (const frameFile of frameFiles) {
        const frameInput = path.join(framesDir, frameFile)
        const frameOutput = path.join(outFramesDir, frameFile)
        let p = sharp(await readFile(frameInput))
        if (doHFlip) p = p.flop()
        if (doVFlip) p = p.flip()
        await p.png().toFile(frameOutput)
        await unlink(frameInput)
      }

      const delays = metadata.delay || []
      const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length) : 100
      const fps = avgDelay > 0 ? (1000 / avgDelay) : 10

      await execFfmpeg([
        '-framerate', String(fps),
        '-i', path.join(outFramesDir, 'frame_%04d.png'),
        '-lavfi', 'palettegen=stats_mode=diff[pal],[0:v][pal]paletteuse=dither=bayer:bayer_scale=3',
        outputPath,
      ])

      try { await rm(framesDir, { recursive: true, force: true }) } catch {}
      try { await rm(outFramesDir, { recursive: true, force: true }) } catch {}
    } else {
      let pipeline = sharp(inputBuffer)
      if (doHFlip) pipeline = pipeline.flop()
      if (doVFlip) pipeline = pipeline.flip()
      await pipeline.toFormat(formatKey, { effort: 10 } as any).toFile(outputPath)
    }

    const outputBuffer = await readFile(outputPath)

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': fmt.mimeType,
        'Content-Disposition': `attachment; filename="flipped.${outputExt}"`,
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Flip error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
