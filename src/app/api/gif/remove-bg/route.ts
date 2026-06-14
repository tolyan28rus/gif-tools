import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile, writeFile, unlink, mkdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const TMP_DIR = '/home/z/my-project/tmp'

async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true })
  }
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 }
}

/**
 * Remove background color from raw pixel buffer (RGBA)
 * Sets alpha to 0 for pixels within tolerance of the target color
 */
function removeBgFromBuffer(
  buffer: Buffer,
  width: number,
  height: number,
  targetColor: { r: number; g: number; b: number },
  tolerance: number,
  mode: 'exact' | 'flood' | 'global'
): Buffer {
  const result = Buffer.from(buffer)
  const channels = 4 // RGBA

  if (mode === 'global') {
    // Remove ALL pixels matching the color within tolerance
    for (let i = 0; i < result.length; i += channels) {
      const r = result[i]
      const g = result[i + 1]
      const b = result[i + 2]
      const a = result[i + 3]

      if (a === 0) continue

      const dist = Math.sqrt(
        (r - targetColor.r) ** 2 +
        (g - targetColor.g) ** 2 +
        (b - targetColor.b) ** 2
      )

      if (dist <= tolerance) {
        // Full transparency for pixels within tolerance
        // Partial transparency for edge pixels (anti-aliasing)
        const edgeDist = tolerance * 0.8
        if (dist > edgeDist) {
          result[i + 3] = Math.round(255 * (dist - edgeDist) / (tolerance - edgeDist))
        } else {
          result[i + 3] = 0
        }
      }
    }
  } else if (mode === 'flood') {
    // Flood fill from edges - only remove connected background
    const visited = new Uint8Array(width * height)
    const queue: number[] = []

    // Start from all edge pixels
    for (let x = 0; x < width; x++) {
      queue.push(x) // top row
      queue.push((height - 1) * width + x) // bottom row
    }
    for (let y = 0; y < height; y++) {
      queue.push(y * width) // left column
      queue.push(y * width + (width - 1)) // right column
    }

    while (queue.length > 0) {
      const idx = queue.pop()!
      if (visited[idx]) continue
      visited[idx] = 1

      const px = idx * channels
      const r = result[px]
      const g = result[px + 1]
      const b = result[px + 2]
      const a = result[px + 3]

      if (a === 0) continue

      const dist = Math.sqrt(
        (r - targetColor.r) ** 2 +
        (g - targetColor.g) ** 2 +
        (b - targetColor.b) ** 2
      )

      if (dist <= tolerance) {
        // Make transparent
        const edgeDist = tolerance * 0.8
        if (dist > edgeDist) {
          result[px + 3] = Math.round(255 * (dist - edgeDist) / (tolerance - edgeDist))
        } else {
          result[px + 3] = 0
        }

        // Add neighbors to queue
        const x = idx % width
        const y = Math.floor(idx / width)
        if (x > 0) queue.push(idx - 1)
        if (x < width - 1) queue.push(idx + 1)
        if (y > 0) queue.push(idx - width)
        if (y < height - 1) queue.push(idx + width)
      }
    }
  } else {
    // Exact mode - remove only exact color match
    for (let i = 0; i < result.length; i += channels) {
      const r = result[i]
      const g = result[i + 1]
      const b = result[i + 2]
      const a = result[i + 3]

      if (a === 0) continue

      if (r === targetColor.r && g === targetColor.g && b === targetColor.b) {
        result[i + 3] = 0
      }
    }
  }

  return result
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
    const mimeType = file.type || ''
    const isGif = mimeType.includes('gif') || file.name.endsWith('.gif')
    const targetColor = hexToRgb(bgColor)

    const buffer = Buffer.from(await file.arrayBuffer())

    if (isGif) {
      // ==================== GIF: process each frame ====================
      const framesDir = path.join(TMP_DIR, `${id}-bg-frames`)
      const outputDir = path.join(TMP_DIR, `${id}-bg-output`)
      await mkdir(framesDir, { recursive: true })
      await mkdir(outputDir, { recursive: true })

      // Extract frames as PNG (to preserve full color)
      await execFileAsync('ffmpeg', [
        '-i', path.join(TMP_DIR, `${id}-input.gif`),
        '-vsync', 'passthrough',
        path.join(framesDir, 'frame_%04d.png'),
      ])
      await writeFile(path.join(TMP_DIR, `${id}-input.gif`), buffer)

      // Re-extract after writing
      await execFileAsync('ffmpeg', [
        '-i', path.join(TMP_DIR, `${id}-input.gif`),
        '-vsync', 'passthrough',
        path.join(framesDir, 'frame_%04d.png'),
      ])

      // Get metadata for delay
      const metadata = await sharp(buffer, { animated: true }).metadata()
      const delays = metadata.delay || []
      const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length) : 100

      // Process each frame
      const frameFiles = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()
      
      for (const frameFile of frameFiles) {
        const framePath = path.join(framesDir, frameFile)
        const frameBuffer = await readFile(framePath)
        const frameMeta = await sharp(frameBuffer).metadata()
        const width = frameMeta.width!
        const height = frameMeta.height!

        // Get raw RGBA data
        const rawBuffer = await sharp(frameBuffer)
          .ensureAlpha()
          .raw()
          .toBuffer()

        // Remove background
        const processedBuffer = removeBgFromBuffer(rawBuffer, width, height, targetColor, tolerance, mode as any)

        // Write processed frame
        const outputPath = path.join(outputDir, frameFile)
        await sharp(processedBuffer, { raw: { width, height, channels: 4 } })
          .png()
          .toFile(outputPath)

        // Cleanup original frame
        await unlink(framePath)
      }

      // Reassemble as GIF with transparency
      const outputPath = path.join(TMP_DIR, `${id}-output.gif`)
      await execFileAsync('ffmpeg', [
        '-i', path.join(outputDir, 'frame_%04d.png'),
        '-lavfi', `palettegen=reserve_transparent=1:stats_mode=diff[pal],[0:v][pal]paletteuse=dither=bayer:bayer_scale=3:alpha_threshold=128`,
        outputPath,
      ])

      const outputBuffer = await readFile(outputPath)

      // Cleanup
      try { await unlink(path.join(TMP_DIR, `${id}-input.gif`)) } catch {}
      try { await unlink(outputPath) } catch {}
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
      // ==================== Static image: single frame ====================
      const inputPath = path.join(TMP_DIR, `${id}-input.png`)
      await writeFile(inputPath, buffer)

      const imgMeta = await sharp(inputPath).metadata()
      const width = imgMeta.width!
      const height = imgMeta.height!

      // Get raw RGBA data
      const rawBuffer = await sharp(inputPath)
        .ensureAlpha()
        .raw()
        .toBuffer()

      // Remove background
      const processedBuffer = removeBgFromBuffer(rawBuffer, width, height, targetColor, tolerance, mode as any)

      // Output as PNG (supports transparency)
      const outputPng = await sharp(processedBuffer, { raw: { width, height, channels: 4 } })
        .png()
        .toBuffer()

      try { await unlink(inputPath) } catch {}

      return new NextResponse(outputPng, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': 'attachment; filename="bg-removed.png"',
          'X-Output-Size': outputPng.length.toString(),
        },
      })
    }
  } catch (error: any) {
    console.error('Remove BG error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
