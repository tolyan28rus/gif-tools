import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile, unlink } from 'fs/promises'
import path from 'path'

const TMP_DIR = path.join(process.cwd(), 'tmp')

const effectHandlers: Record<string, (pipeline: sharp.Sharp) => sharp.Sharp> = {
  grayscale: (p) => p.grayscale(),
  sepia: (p) => p.recomb([
    [0.393, 0.769, 0.189],
    [0.349, 0.686, 0.168],
    [0.272, 0.534, 0.131],
  ]),
  blur: (p) => p.blur(3),
  sharpen: (p) => p.sharpen(),
  negate: (p) => p.negate(),
  normalize: (p) => p.normalize(),
  brightness: (p) => p.modulate({ brightness: 1.5 }),
  darken: (p) => p.modulate({ brightness: 0.5 }),
  saturate: (p) => p.modulate({ saturation: 2 }),
  desaturate: (p) => p.modulate({ saturation: 0.5 }),
  contrast: (p) => p.linear(1.5, -(128 * 0.5)),
  vintage: (p) => p.recomb([
    [0.6, 0.3, 0.1],
    [0.2, 0.6, 0.2],
    [0.1, 0.2, 0.7],
  ]).modulate({ brightness: 1.1 }),
  cool: (p) => p.recomb([
    [0.8, 0.1, 0.1],
    [0.1, 0.9, 0.1],
    [0.2, 0.2, 1.2],
  ]),
  warm: (p) => p.recomb([
    [1.2, 0.2, 0.1],
    [0.1, 0.9, 0.1],
    [0.1, 0.1, 0.8],
  ]),
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputPath, effect, brightness, contrast: contrastVal, saturation } = body

    if (!inputPath || !effect) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    const inputBuffer = await readFile(safeInputPath)
    let pipeline = sharp(inputBuffer, { animated: true })

    const handler = effectHandlers[effect]
    if (!handler) {
      return NextResponse.json({ error: `Unknown effect: ${effect}` }, { status: 400 })
    }
    pipeline = handler(pipeline)

    // Apply additional adjustments
    const modulateOptions: Record<string, number> = {}
    if (brightness && brightness !== 100) modulateOptions.brightness = brightness / 100
    if (saturation && saturation !== 100) modulateOptions.saturation = saturation / 100
    if (Object.keys(modulateOptions).length > 0) {
      pipeline = pipeline.modulate(modulateOptions)
    }

    if (contrastVal && contrastVal !== 100) {
      const factor = contrastVal / 100
      pipeline = pipeline.linear(factor, -(128 * (factor - 1)))
    }

    await pipeline.gif({ effort: 10 }).toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    try { await unlink(outputPath) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="effects.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Effects error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
