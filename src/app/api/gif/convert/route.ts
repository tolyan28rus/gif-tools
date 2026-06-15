import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile, writeFile, unlink, mkdir, rm } from 'fs/promises'
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
    const targetFormat = formData.get('targetFormat') as string || 'mp4'
    const quality = Number(formData.get('quality') || '75')
    const chainInput = formData.get('inputPath') as string | null

    let inputPath: string
    let isGif = false, isVideo = false, isImage = false

    if (chainInput) {
      inputPath = path.join(TMP_DIR, path.basename(chainInput))
      const ext = path.extname(inputPath).replace('.', '').toLowerCase()
      isGif = ext === 'gif'
      isVideo = ['mp4', 'webm', 'avi', 'mov'].includes(ext)
      isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(ext)
    } else if (file) {
      const id = randomUUID()
      const inputExt = file.name.split('.').pop()?.toLowerCase() || 'gif'
      inputPath = path.join(TMP_DIR, `${id}-input.${inputExt}`)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(inputPath, buffer)
      const mimeType = file.type || ''
      isGif = mimeType.includes('gif') || inputExt === 'gif'
      isVideo = mimeType.includes('video') || ['mp4', 'webm', 'avi', 'mov'].includes(inputExt)
      isImage = mimeType.includes('image') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(inputExt)
    } else {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // ==================== GIF → Video (MP4/WebM) ====================
    if (isGif && (targetFormat === 'mp4' || targetFormat === 'webm')) {
      const outputPath = path.join(TMP_DIR, `${id}-output.${targetFormat}`)

      const ffmpegArgs = [
        '-i', inputPath,
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-crf', String(Math.round(63 - (quality / 100) * 51)),
        '-preset', 'medium',
      ]

      if (targetFormat === 'webm') {
        ffmpegArgs.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-b:v', '0')
      } else {
        ffmpegArgs.push('-c:v', 'libx264', '-an')
      }

      ffmpegArgs.push(outputPath)

      await execFfmpeg(ffmpegArgs)

      const outputBuffer = await readFile(outputPath)
      const contentType = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm'

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="converted.${targetFormat}"`,
          'X-Output-Path': outputPath,
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    }

    // ==================== GIF → APNG ====================
    if (isGif && targetFormat === 'apng') {
      const framesDir = path.join(TMP_DIR, `${id}-apng-frames`)
      await mkdir(framesDir, { recursive: true })

      await execFfmpeg([
        '-i', inputPath,
        '-vsync', 'passthrough',
        path.join(framesDir, 'frame_%04d.png'),
      ])

      // Get frame delay info from GIF
      const metadata = await sharp(inputPath, { animated: true }).metadata()
      const delays = metadata.delay || []
      const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length) : 100

      const outputPath = path.join(TMP_DIR, `${id}-output.png`)

      await execFfmpeg([
        '-i', inputPath,
        '-plays', '0',
        '-f', 'apng',
        outputPath,
      ])

      const outputBuffer = await readFile(outputPath)

      try { await rm(framesDir, { recursive: true, force: true }) } catch {}

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': 'image/apng',
          'Content-Disposition': 'attachment; filename="converted.png"',
          'X-Output-Path': outputPath,
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    }

    // ==================== GIF → WebP (animated) ====================
    if (isGif && targetFormat === 'webp') {
      const outputPath = path.join(TMP_DIR, `${id}-output.webp`)

      await sharp(inputPath, { animated: true })
        .webp({ quality, effort: 6 })
        .toFile(outputPath)

      const outputBuffer = await readFile(outputPath)

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Content-Disposition': 'attachment; filename="converted.webp"',
          'X-Output-Path': outputPath,
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    }

    // ==================== Image → Image format conversion ====================
    if (isImage) {
      const outputPath = path.join(TMP_DIR, `${id}-output.${targetFormat}`)

      let pipeline = sharp(inputPath)

      switch (targetFormat) {
        case 'png':
          pipeline = pipeline.png({ quality, effort: 10 })
          break
        case 'jpg':
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality })
          break
        case 'webp':
          pipeline = pipeline.webp({ quality, effort: 6 })
          break
        case 'gif':
          pipeline = pipeline.gif({ effort: 10 })
          break
        case 'bmp':
          pipeline = pipeline.bmp()
          break
        case 'tiff':
          pipeline = pipeline.tiff({ quality })
          break
        default:
          pipeline = pipeline.png({ quality, effort: 10 })
      }

      await pipeline.toFile(outputPath)
      const outputBuffer = await readFile(outputPath)

      const contentTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        bmp: 'image/bmp',
        tiff: 'image/tiff',
      }

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': contentTypes[targetFormat] || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="converted.${targetFormat}"`,
          'X-Output-Path': outputPath,
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    }

    // ==================== Video → Video format ====================
    if (isVideo) {
      const outputPath = path.join(TMP_DIR, `${id}-output.${targetFormat}`)

      const ffmpegArgs = ['-i', inputPath]

      if (targetFormat === 'mp4') {
        ffmpegArgs.push('-c:v', 'libx264', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-crf', String(Math.round(63 - (quality / 100) * 51)))
      } else if (targetFormat === 'webm') {
        ffmpegArgs.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(Math.round(63 - (quality / 100) * 51)))
      } else if (targetFormat === 'gif') {
        const palettePath = path.join(TMP_DIR, `${id}-palette.png`)
        await execFfmpeg([
          '-i', inputPath,
          '-vf', `fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff`,
          palettePath,
        ])
        ffmpegArgs.push('-i', palettePath, '-lavfi', `fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, outputPath)
        await execFfmpeg(ffmpegArgs)
        const outputBuffer = await readFile(outputPath)
        try { await unlink(palettePath) } catch {}
        return new NextResponse(outputBuffer, {
          headers: {
            'Content-Type': 'image/gif',
            'Content-Disposition': 'attachment; filename="converted.gif"',
            'X-Output-Path': outputPath,
            'X-Output-Size': outputBuffer.length.toString(),
          },
        })
      }

      ffmpegArgs.push(outputPath)

      await execFfmpeg(ffmpegArgs)

      const outputBuffer = await readFile(outputPath)

      const contentTypes: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        gif: 'image/gif',
      }

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': contentTypes[targetFormat] || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="converted.${targetFormat}"`,
          'X-Output-Path': outputPath,
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    }

    return NextResponse.json({ error: 'Unsupported conversion' }, { status: 400 })
  } catch (error: any) {
    console.error('Convert error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
