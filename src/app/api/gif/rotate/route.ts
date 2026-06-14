import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { readFile, writeFile, unlink } from 'fs/promises'
import path from 'path'

const TMP_DIR = '/home/z/my-project/tmp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputPath, angle } = body

    if (!inputPath || angle === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const id = path.basename(inputPath).replace('-input.gif', '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    const inputBuffer = await readFile(inputPath)

    await sharp(inputBuffer, { animated: true })
      .rotate(Number(angle))
      .gif({ effort: 10 })
      .toFile(outputPath)

    const outputBuffer = await readFile(outputPath)

    try { await unlink(inputPath) } catch {}
    try { await unlink(outputPath) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="rotated.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Rotate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
