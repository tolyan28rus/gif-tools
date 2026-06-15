import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink, mkdir, readdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { execFfmpeg } from '@/lib/ffmpeg-path'

const TMP_DIR = path.join(process.cwd(), 'tmp')

async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true })
  }
}

function hexToFfmpegColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0xFFFFFF'
  return `0x${result[1]}${result[2]}${result[3]}`
}

function toleranceToSimilarity(tolerance: number): number {
  return Math.min(1.0, tolerance / 150)
}

function toleranceToBlend(tolerance: number): number {
  if (tolerance <= 0) return 0
  return Math.min(1.0, tolerance / 200)
}

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function floodFillRemoveBg(inputPath: string, outputPath: string, tolerance: number): Promise<void> {
  const { default: sharp } = await import('sharp')

  const image = sharp(inputPath)
  const metadata = await image.metadata()
  const w = metadata.width || 1
  const h = metadata.height || 1

  const raw = await image.ensureAlpha().raw().toBuffer()
  const ch = 4

  // Sample edge pixels — more corners, weighted
  const edgeSamples: { r: number; g: number; b: number }[] = []
  const step = Math.max(1, Math.floor(Math.min(w, h) / 30))

  // Top/bottom rows
  for (let x = 0; x < w; x += step) {
    const ti = (0 * w + x) * ch
    edgeSamples.push({ r: raw[ti], g: raw[ti + 1], b: raw[ti + 2] })
    const bi = ((h - 1) * w + x) * ch
    edgeSamples.push({ r: raw[bi], g: raw[bi + 1], b: raw[bi + 2] })
  }
  // Left/right columns
  for (let y = 0; y < h; y += step) {
    const li = (y * w + 0) * ch
    edgeSamples.push({ r: raw[li], g: raw[li + 1], b: raw[li + 2] })
    const ri = (y * w + (w - 1)) * ch
    edgeSamples.push({ r: raw[ri], g: raw[ri + 1], b: raw[ri + 2] })
  }
  // Extra corner samples
  for (let dy = 0; dy < Math.min(5, h); dy++) {
    for (let dx = 0; dx < Math.min(5, w); dx++) {
      const corners = [
        [dx, dy], [w - 1 - dx, dy],
        [dx, h - 1 - dy], [w - 1 - dx, h - 1 - dy],
      ]
      for (const [cx, cy] of corners) {
        const ci = (cy * w + cx) * ch
        edgeSamples.push({ r: raw[ci], g: raw[ci + 1], b: raw[ci + 2] })
      }
    }
  }

  // Find dominant bg: pick median of each channel across ALL edge pixels
  const bgR = Math.round(median(edgeSamples.map(c => c.r)))
  const bgG = Math.round(median(edgeSamples.map(c => c.g)))
  const bgB = Math.round(median(edgeSamples.map(c => c.b)))
  console.log(`[Flood Fill] Detected bg: rgb(${bgR},${bgG},${bgB}), samples: ${edgeSamples.length}`)

  // Base threshold from tolerance — much more conservative
  // tolerance 0-150 maps to colorDist 0-80
  const threshold = 20 + (tolerance / 150) * 60
  const maxDepth = Math.floor(Math.min(w, h) * 0.35)

  console.log(`[Flood Fill] threshold=${threshold.toFixed(1)}, maxDepth=${maxDepth}`)

  const visited = new Uint8Array(w * h)
  const isBg = new Uint8Array(w * h)
  // BFS queue: [index, depth]
  const queue: [number, number][] = []

  const pxIdx = (x: number, y: number) => y * w + x

  // Seed from edges
  for (let x = 0; x < w; x++) {
    queue.push([pxIdx(x, 0), 0])
    queue.push([pxIdx(x, h - 1), 0])
  }
  for (let y = 1; y < h - 1; y++) {
    queue.push([pxIdx(0, y), 0])
    queue.push([pxIdx(w - 1, y), 0])
  }

  let head = 0
  while (head < queue.length) {
    const [idx, depth] = queue[head++]
    if (visited[idx]) continue
    if (depth > maxDepth) continue
    visited[idx] = 1

    const px = idx % w
    const py = (idx / w) | 0
    const bi = idx * ch
    const r = raw[bi], g = raw[bi + 1], b = raw[bi + 2]

    const dist = colorDist(r, g, b, bgR, bgG, bgB)

    // Stricter threshold at depth — harder to qualify deeper in
    const depthPenalty = depth > 10 ? (depth - 10) * 0.5 : 0
    const effectiveThreshold = threshold - depthPenalty

    if (dist > effectiveThreshold) continue

    isBg[idx] = 1

    const nd = depth + 1
    if (px > 0) queue.push([pxIdx(px - 1, py), nd])
    if (px < w - 1) queue.push([pxIdx(px + 1, py), nd])
    if (py > 0) queue.push([pxIdx(px, py - 1), nd])
    if (py < h - 1) queue.push([pxIdx(px, py + 1), nd])
  }

  // Anti-alias: smooth 3px edge transition
  const alpha = new Uint8Array(w * h)
  const radius = 3

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = pxIdx(x, y)
      if (!isBg[idx]) {
        alpha[idx] = 255
        continue
      }

      // Check proximity to foreground
      let closestFgDist = radius + 1
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
          if (!isBg[pxIdx(nx, ny)]) {
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < closestFgDist) closestFgDist = d
          }
        }
      }

      if (closestFgDist <= radius) {
        alpha[idx] = Math.round((closestFgDist / radius) * 80)
      } else {
        alpha[idx] = 0
      }
    }
  }

  const output = Buffer.alloc(raw.length)
  raw.copy(output)
  for (let i = 0; i < w * h; i++) {
    output[i * ch + 3] = alpha[i]
  }

  await sharp(output, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(outputPath)
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

    if (isGif) {
      const framesDir = path.join(TMP_DIR, `${id}-bg-frames`)
      const outputDir = path.join(TMP_DIR, `${id}-bg-output`)
      const inputGifPath = path.join(TMP_DIR, `${id}-input.gif`)
      await mkdir(framesDir, { recursive: true })
      await mkdir(outputDir, { recursive: true })
      await writeFile(inputGifPath, buffer)

      await execFfmpeg([
        '-i', inputGifPath,
        '-fps_mode', 'passthrough',
        path.join(framesDir, 'frame_%04d.png'),
      ])

      const { default: sharp } = await import('sharp')
      const metadata = await sharp(buffer, { animated: true }).metadata()
      const delays = metadata.delay || []
      const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length) : 100

      const frameFiles = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()
      const ffmpegColor = hexToFfmpegColor(bgColor)
      const similarity = toleranceToSimilarity(tolerance)
      const blend = toleranceToBlend(tolerance)

      for (const frameFile of frameFiles) {
        const frameInput = path.join(framesDir, frameFile)
        const frameOutput = path.join(outputDir, frameFile)

        if (mode === 'ai') {
          await floodFillRemoveBg(frameInput, frameOutput, tolerance)
        } else if (mode === 'exact') {
          await execFfmpeg([
            '-i', frameInput,
            '-vf', `colorkey=${ffmpegColor}:0.01:0.0`,
            frameOutput,
          ])
        } else {
          await execFfmpeg([
            '-i', frameInput,
            '-vf', `colorkey=${ffmpegColor}:${similarity.toFixed(3)}:${blend.toFixed(3)}`,
            frameOutput,
          ])
        }

        await unlink(frameInput)
      }

      const outputGifPath = path.join(TMP_DIR, `${id}-output.gif`)
      const fps = avgDelay > 0 ? (1000 / avgDelay) : 10
      await execFfmpeg([
        '-framerate', String(fps),
        '-i', path.join(outputDir, 'frame_%04d.png'),
        '-lavfi', 'palettegen=reserve_transparent=1:stats_mode=diff[pal],[0:v][pal]paletteuse=dither=bayer:bayer_scale=3:alpha_threshold=128',
        outputGifPath,
      ])

      const outputBuffer = await readFile(outputGifPath)

      try { await unlink(inputGifPath) } catch {}
      try { await unlink(outputGifPath) } catch {}
      try { await rm(framesDir, { recursive: true, force: true }) } catch {}
      try { await rm(outputDir, { recursive: true, force: true }) } catch {}

      return new NextResponse(outputBuffer, {
        headers: {
          'Content-Type': 'image/gif',
          'Content-Disposition': 'attachment; filename="bg-removed.gif"',
          'X-Output-Size': outputBuffer.length.toString(),
        },
      })
    } else {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const inputPath = path.join(TMP_DIR, `${id}-input.${ext}`)
      const outputPath = path.join(TMP_DIR, `${id}-output.png`)
      await writeFile(inputPath, buffer)

      if (mode === 'ai') {
        await floodFillRemoveBg(inputPath, outputPath, tolerance)
      } else if (mode === 'exact') {
        const ffmpegColor = hexToFfmpegColor(bgColor)
        await execFfmpeg([
          '-i', inputPath,
          '-vf', `colorkey=${ffmpegColor}:0.01:0.0`,
          outputPath,
        ])
      } else {
        const ffmpegColor = hexToFfmpegColor(bgColor)
        const similarity = toleranceToSimilarity(tolerance)
        const blend = toleranceToBlend(tolerance)
        await execFfmpeg([
          '-i', inputPath,
          '-vf', `colorkey=${ffmpegColor}:${similarity.toFixed(3)}:${blend.toFixed(3)}`,
          outputPath,
        ])
      }

      const outputBuffer = await readFile(outputPath)

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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
