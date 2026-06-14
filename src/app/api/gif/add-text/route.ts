import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, unlink } from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const TMP_DIR = '/home/z/my-project/tmp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputPath, text, fontSize, fontColor, positionX, positionY, strokeColor, strokeWidth } = body

    if (!inputPath || !text) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const id = path.basename(inputPath).replace('-input.gif', '')
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    // Use ffmpeg to add text overlay
    const vf = `drawtext=text='${text.replace(/'/g, "\\'")}':fontsize=${fontSize || 24}:fontcolor=${fontColor || 'white'}:x=${positionX || 10}:y=${positionY || 10}${strokeColor ? `:borderw=${strokeWidth || 1}:bordercolor=${strokeColor}` : ''}`

    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vf', vf,
      '-gifflags', '+transdiff',
      outputPath,
    ])

    const outputBuffer = await readFile(outputPath)

    try { await unlink(inputPath) } catch {}
    try { await unlink(outputPath) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="text-added.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Add text error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
