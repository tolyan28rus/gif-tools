import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink, mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
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
    const formData = await request.formData()
    const file = formData.get('file') as File
    const x = Number(formData.get('x') || '0')
    const y = Number(formData.get('y') || '0')
    const width = Number(formData.get('width') || '0')
    const height = Number(formData.get('height') || '0')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!width || !height) {
      return NextResponse.json({ error: 'Invalid crop dimensions' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const id = randomUUID()
    const inputPath = path.join(TMP_DIR, `${id}-input.gif`)
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)
    await writeFile(inputPath, buffer)

    const sharp = (await import('sharp')).default
    const isGif = (file.type || '').includes('gif') || file.name.endsWith('.gif')

    if (isGif) {
      const metadata = await sharp(buffer, { animated: true }).metadata()
      const pages = metadata.pages || 1

      if (pages > 1) {
        const framesDir = path.join(TMP_DIR, `${id}-crop-frames`)
        const outFramesDir = path.join(TMP_DIR, `${id}-crop-out`)
        const { readdir } = await import('fs/promises')

        await mkdir(framesDir, { recursive: true })
        await mkdir(outFramesDir, { recursive: true })

        await execFfmpeg([
          '-i', inputPath,
          '-fps_mode', 'passthrough',
          path.join(framesDir, 'frame_%04d.png'),
        ])

        const frameFiles = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()

        for (const frameFile of frameFiles) {
          const frameInput = path.join(framesDir, frameFile)
          const frameOutput = path.join(outFramesDir, frameFile)

          const frame = await sharp(await readFile(frameInput))
          const fm = await frame.metadata()
          const fw = fm.width || 0
          const fh = fm.height || 0

          const clampedX = Math.min(x, fw - 1)
          const clampedY = Math.min(y, fh - 1)
          const clampedW = Math.min(width, fw - clampedX)
          const clampedH = Math.min(height, fh - clampedY)

          await frame
            .extract({ left: clampedX, top: clampedY, width: clampedW, height: clampedH })
            .png()
            .toFile(frameOutput)

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

        const outputBuffer = await readFile(outputPath)

        try { await rm(framesDir, { recursive: true, force: true }) } catch {}
        try { await rm(outFramesDir, { recursive: true, force: true }) } catch {}
        try { await unlink(outputPath) } catch {}

        return new NextResponse(outputBuffer, {
          headers: {
            'Content-Type': 'image/gif',
            'Content-Disposition': 'attachment; filename="cropped.gif"',
            'X-Output-Size': outputBuffer.length.toString(),
          },
        })
      }
    }

    const meta = await sharp(inputPath).metadata()
    const fw = meta.width || 0
    const fh = meta.height || 0
    const clampedX = Math.min(x, fw - 1)
    const clampedY = Math.min(y, fh - 1)
    const clampedW = Math.min(width, fw - clampedX)
    const clampedH = Math.min(height, fh - clampedY)

    await sharp(inputPath)
      .extract({ left: clampedX, top: clampedY, width: clampedW, height: clampedH })
      .png()
      .toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    try { await unlink(outputPath) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="cropped.png"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Crop error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
