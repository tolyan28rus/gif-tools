import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile, writeFile, unlink } from 'fs/promises'
import path from 'path'

const TMP_DIR = '/home/z/my-project/tmp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputPath, speedMultiplier } = body

    if (!inputPath || !speedMultiplier) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const id = path.basename(inputPath).replace('-input.gif', '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    const inputBuffer = await readFile(inputPath)
    const metadata = await sharp(inputBuffer, { animated: true }).metadata()
    
    // delay is in centiseconds per frame
    const currentDelay = metadata.delay || []
    const newDelay = currentDelay.map(d => {
      const newD = Math.round(d / speedMultiplier)
      return Math.max(2, Math.min(newD, 6000)) // clamp between 20ms and 60s
    })

    // We need to use sharp with custom delay
    // Re-encode with new delays
    await sharp(inputBuffer, { animated: true })
      .gif({ effort: 10, delay: newDelay as any })
      .toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    try { await unlink(inputPath) } catch {}
    try { await unlink(outputPath) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="speed-changed.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Speed error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
