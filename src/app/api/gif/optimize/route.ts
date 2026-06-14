import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile, writeFile, unlink } from 'fs/promises'
import path from 'path'

const TMP_DIR = '/home/z/my-project/tmp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputPath, colors, lossy } = body

    if (!inputPath) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const id = path.basename(inputPath).replace('-input.gif', '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    const inputBuffer = await readFile(inputPath)

    const gifOptions: sharp.GifOptions = { effort: 10 }
    
    if (colors) {
      gifOptions.colours = Number(colors)
    }

    await sharp(inputBuffer, { animated: true })
      .gif(gifOptions)
      .toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    try { await unlink(inputPath) } catch {}
    try { await unlink(outputPath) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="optimized.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Optimize error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
