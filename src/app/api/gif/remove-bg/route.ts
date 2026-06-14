import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink, mkdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)
const TMP_DIR = '/home/z/my-project/tmp'

async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true })
  }
}

/**
 * Convert hex color to ffmpeg color format (0xRRGGBB)
 */
function hexToFfmpegColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0xFFFFFF'
  return `0x${result[1]}${result[2]}${result[3]}`
}

/**
 * Convert tolerance (0-150 distance) to ffmpeg similarity (0.0-1.0)
 * Higher tolerance = more similar colors removed = higher similarity value
 */
function toleranceToSimilarity(tolerance: number): number {
  // tolerance 0 = exact match only (similarity ~0.0)
  // tolerance 150 = very loose match (similarity ~1.0)
  return Math.min(1.0, tolerance / 150)
}

/**
 * Convert tolerance to ffmpeg blend parameter (0.0-1.0)
 * This controls how much blending at the edges
 */
function toleranceToBlend(tolerance: number): number {
  if (tolerance <= 0) return 0
  return Math.min(1.0, tolerance / 200)
}

export async function POST(request: NextRequest) {
  try {
    await ensureTmpDir()
    const formData = await request.formData()
    const file = formData.get('file') as File
    const bgColor = formData.get('bgColor') as string || '#ffffff'
    const tolerance = Number(formData.get('tolerance') || '30')
    const mode = (formData.get('mode') as string) || 'flood'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const id = randomUUID()
    const buffer = Buffer.from(await file.arrayBuffer())
    const isGif = (file.type || '').includes('gif') || file.name.endsWith('.gif')
    const ffmpegColor = hexToFfmpegColor(bgColor)
    const similarity = toleranceToSimilarity(tolerance)
    const blend = toleranceToBlend(tolerance)

    if (isGif) {
      // ==================== GIF: use ffmpeg colorkey on each frame ====================
      const framesDir = path.join(TMP_DIR, `${id}-bg-frames`)
      const outputDir = path.join(TMP_DIR, `${id}-bg-output`)
      const inputGifPath = path.join(TMP_DIR, `${id}-input.gif`)
      await mkdir(framesDir, { recursive: true })
      await mkdir(outputDir, { recursive: true })
      await writeFile(inputGifPath, buffer)

      // Extract frames
      await execFileAsync('ffmpeg', [
        '-i', inputGifPath,
        '-fps_mode', 'passthrough',
        path.join(framesDir, 'frame_%04d.png'),
      ])

      // Get delay info
      const { default: sharp } = await import('sharp')
      const metadata = await sharp(buffer, { animated: true }).metadata()
      const delays = metadata.delay || []
      const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length) : 100

      // Process each frame with ffmpeg colorkey
      const frameFiles = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()

      for (const frameFile of frameFiles) {
        const frameInput = path.join(framesDir, frameFile)
        const frameOutput = path.join(outputDir, frameFile)

        if (mode === 'exact') {
          // Exact mode: very low similarity
          await execFileAsync('ffmpeg', [
            '-i', frameInput,
            '-vf', `colorkey=${ffmpegColor}:0.01:0.0`,
            frameOutput,
          ])
        } else if (mode === 'global') {
          // Global mode: use colorkey with higher similarity
          await execFileAsync('ffmpeg', [
            '-i', frameInput,
            '-vf', `colorkey=${ffmpegColor}:${similarity.toFixed(3)}:${blend.toFixed(3)}`,
            frameOutput,
          ])
        } else {
          // Flood mode (default): ffmpeg colorkey naturally removes connected regions
          await execFileAsync('ffmpeg', [
            '-i', frameInput,
            '-vf', `colorkey=${ffmpegColor}:${similarity.toFixed(3)}:${blend.toFixed(3)}`,
            frameOutput,
          ])
        }

        await unlink(frameInput)
      }

      // Reassemble as GIF with transparency
      const outputGifPath = path.join(TMP_DIR, `${id}-output.gif`)
      const fps = avgDelay > 0 ? (1000 / avgDelay) : 10
      await execFileAsync('ffmpeg', [
        '-framerate', String(fps),
        '-i', path.join(outputDir, 'frame_%04d.png'),
        '-lavfi', 'palettegen=reserve_transparent=1:stats_mode=diff[pal],[0:v][pal]paletteuse=dither=bayer:bayer_scale=3:alpha_threshold=128',
        outputGifPath,
      ])

      const outputBuffer = await readFile(outputGifPath)

      // Cleanup
      try { await unlink(inputGifPath) } catch {}
      try { await unlink(outputGifPath) } catch {}
      try { await execFileAsync('rm', ['-rf', framesDir]) } catch {}
      try { await execFileAsync('rm', ['-rf', outputDir]) } catch {}

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': 'image/gif',
          'Content-Disposition': 'attachment; filename="bg-removed.gif"',
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    } else {
      // ==================== Static image: use ffmpeg colorkey ====================
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const inputPath = path.join(TMP_DIR, `${id}-input.${ext}`)
      const outputPath = path.join(TMP_DIR, `${id}-output.png`)
      await writeFile(inputPath, buffer)

      if (mode === 'exact') {
        await execFileAsync('ffmpeg', [
          '-i', inputPath,
          '-vf', `colorkey=${ffmpegColor}:0.01:0.0`,
          outputPath,
        ])
      } else {
        await execFileAsync('ffmpeg', [
          '-i', inputPath,
          '-vf', `colorkey=${ffmpegColor}:${similarity.toFixed(3)}:${blend.toFixed(3)}`,
          outputPath,
        ])
      }

      const outputBuffer = await readFile(outputPath)

      // Cleanup
      try { await unlink(inputPath) } catch {}
      try { await unlink(outputPath) } catch {}

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': 'attachment; filename="bg-removed.png"',
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    }
  } catch (error: any) {
    console.error('Remove BG error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
