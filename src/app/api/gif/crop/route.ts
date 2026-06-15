import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink, mkdir, rm, writeFile } from 'fs/promises'
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
    const contentType = request.headers.get('content-type') || ''
    let inputPath: string
    let x: number, y: number, width: number, height: number

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File
      x = Number(formData.get('x') || '0')
      y = Number(formData.get('y') || '0')
      width = Number(formData.get('width') || '0')
      height = Number(formData.get('height') || '0')

      const formInputPath = formData.get('inputPath') as string | null
      if (formInputPath) {
        inputPath = path.join(TMP_DIR, path.basename(formInputPath))
      } else if (file) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const id = randomUUID()
        inputPath = path.join(TMP_DIR, `${id}-input.${(file.type || '').includes('gif') || file.name.endsWith('.gif') ? 'gif' : 'png'}`)
        await writeFile(inputPath, buffer)
      } else {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
    } else {
      const body = await request.json()
      const input = body.inputPath as string
      x = Number(body.x || '0')
      y = Number(body.y || '0')
      width = Number(body.width || '0')
      height = Number(body.height || '0')

      if (!input) {
        return NextResponse.json({ error: 'No inputPath provided' }, { status: 400 })
      }
      inputPath = path.join(TMP_DIR, path.basename(input))
    }

    if (!width || !height) {
      return NextResponse.json({ error: 'Invalid crop dimensions' }, { status: 400 })
    }

    const sharp = (await import('sharp')).default
    const metadata = await sharp(inputPath, { animated: true }).metadata()
    const pages = metadata.pages || 1
    const outputPath = path.join(TMP_DIR, `${randomUUID()}-output.${pages > 1 ? 'gif' : 'png'}`)

    if (pages > 1) {
      const id = randomUUID()
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

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="cropped.gif"',
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
        },
      })
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

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="cropped.png"',
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    console.error('Crop error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
