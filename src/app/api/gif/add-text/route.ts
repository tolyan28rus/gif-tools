import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink, mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
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
    const { inputPath, text, fontSize, fontColor, positionX, positionY, strokeColor, strokeWidth } = body

    if (!inputPath || !text) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)
    const framesDir = path.join(TMP_DIR, `${id}-text-frames`)
    const outFramesDir = path.join(TMP_DIR, `${id}-text-out`)

    await mkdir(framesDir, { recursive: true })
    await mkdir(outFramesDir, { recursive: true })

    const sharp = (await import('sharp')).default

    const inputBuffer = await readFile(safeInputPath)
    const metadata = await sharp(inputBuffer, { animated: true }).metadata()
    const pages = metadata.pages || 1
    const delays = metadata.delay || []
    const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length) : 100

    if (pages > 1) {
      await execFfmpeg([
        '-i', safeInputPath,
        '-fps_mode', 'passthrough',
        path.join(framesDir, 'frame_%04d.png'),
      ])

      const { readdir } = await import('fs/promises')
      const frameFiles = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()

      const size = Number(fontSize) || 24
      const color = fontColor || '#ffffff'
      const stroke = strokeColor || '#000000'
      const sw = Number(strokeWidth) || 2
      const px = Number(positionX) || 10
      const py = Number(positionY) || 30

      const svgText = `<svg width="1" height="1"><text x="0" y="${size}" font-size="${size}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" font-family="Arial, Helvetica, sans-serif">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text></svg>`
      const textMeta = await sharp(Buffer.from(svgText)).metadata()
      const textW = textMeta.width || text.length * size * 0.6
      const textH = textMeta.height || size

      for (const frameFile of frameFiles) {
        const framePath = path.join(framesDir, frameFile)
        const outPath = path.join(outFramesDir, frameFile)

        const frameMeta = await sharp(await readFile(framePath)).metadata()
        const fw = frameMeta.width || 100
        const fh = frameMeta.height || 100

        const textSvg = `<svg width="${fw}" height="${fh}"><text x="${px}" y="${py + size}" font-size="${size}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" font-family="Arial, Helvetica, sans-serif">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text></svg>`

        await sharp(framePath)
          .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
          .png()
          .toFile(outPath)

        await unlink(framePath)
      }

      const fps = avgDelay > 0 ? (1000 / avgDelay) : 10
      await execFfmpeg([
        '-framerate', String(fps),
        '-i', path.join(outFramesDir, 'frame_%04d.png'),
        '-lavfi', 'palettegen=stats_mode=diff[pal],[0:v][pal]paletteuse=dither=bayer:bayer_scale=3',
        outputPath,
      ])
    } else {
      const size = Number(fontSize) || 24
      const color = fontColor || '#ffffff'
      const stroke = strokeColor || '#000000'
      const sw = Number(strokeWidth) || 2
      const px = Number(positionX) || 10
      const py = Number(positionY) || 30

      const imgMeta = await sharp(inputBuffer).metadata()
      const fw = imgMeta.width || 100
      const fh = imgMeta.height || 100

      const textSvg = `<svg width="${fw}" height="${fh}"><text x="${px}" y="${py + size}" font-size="${size}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" font-family="Arial, Helvetica, sans-serif">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text></svg>`

      await sharp(inputBuffer)
        .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
        .png()
        .toFile(outputPath)
    }

    const outputBuffer = await readFile(outputPath)

    try { await unlink(outputPath) } catch {}
    try { await rm(framesDir, { recursive: true, force: true }) } catch {}
    try { await rm(outFramesDir, { recursive: true, force: true }) } catch {}

    const contentType = pages > 1 ? 'image/gif' : 'image/png'
    const filename = pages > 1 ? 'text-added.gif' : 'text-added.png'

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Add text error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
