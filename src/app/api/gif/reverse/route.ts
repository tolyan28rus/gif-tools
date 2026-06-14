import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, unlink, rename } from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const TMP_DIR = '/home/z/my-project/tmp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputPath } = body

    if (!inputPath) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const id = path.basename(inputPath).replace('-input.gif', '')
    const framesDir = path.join(TMP_DIR, `${id}-frames`)
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    // Extract frames using ffmpeg
    await execFileAsync('mkdir', ['-p', framesDir])
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vsync', 'passthrough',
      path.join(framesDir, 'frame_%04d.png'),
    ])

    // Get frame count and reverse order
    const { stdout } = await execFileAsync('ls', [framesDir])
    const frames = stdout.trim().split('\n').filter(Boolean).sort()
    const reversedFrames = [...frames].reverse()

    // Rename frames in reverse order
    for (let i = 0; i < reversedFrames.length; i++) {
      const oldPath = path.join(framesDir, reversedFrames[i])
      const newPath = path.join(framesDir, `rev_${String(i + 1).padStart(4, '0')}.png`)
      await rename(oldPath, newPath)
    }

    await execFileAsync('ffmpeg', [
      '-i', path.join(framesDir, 'rev_%04d.png'),
      '-vf', 'palettegen=stats_mode=diff[pal],[0:v][pal]paletteuse=dither=bayer:bayer_scale=3',
      outputPath,
    ])

    const outputBuffer = await readFile(outputPath)

    // Clean up
    try { await unlink(inputPath) } catch {}
    try { await unlink(outputPath) } catch {}
    try { await execFileAsync('rm', ['-rf', framesDir]) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="reversed.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Reverse error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
