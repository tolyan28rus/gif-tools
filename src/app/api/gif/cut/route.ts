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
    const { inputPath, startFrame, endFrame } = body

    if (!inputPath || startFrame === undefined || endFrame === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const id = path.basename(inputPath).replace('-input.gif', '')
    const framesDir = path.join(TMP_DIR, `${id}-cut-frames`)
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    // Extract all frames
    await execFileAsync('mkdir', ['-p', framesDir])
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vsync', 'passthrough',
      path.join(framesDir, 'frame_%04d.png'),
    ])

    // Select only frames in range
    const { stdout } = await execFileAsync('ls', [framesDir])
    const allFrames = stdout.trim().split('\n').filter(Boolean).sort()
    const selectedFrames = allFrames.slice(Number(startFrame), Number(endFrame) + 1)

    // Copy selected frames with new naming
    for (let i = 0; i < selectedFrames.length; i++) {
      const oldPath = path.join(framesDir, selectedFrames[i])
      const newPath = path.join(framesDir, `cut_%04d.png`.replace('%04d', String(i + 1).padStart(4, '0')))
      await rename(oldPath, newPath)
    }

    // Remove non-selected frames
    for (const frame of allFrames) {
      if (!selectedFrames.includes(frame)) {
        try { await unlink(path.join(framesDir, frame)) } catch {}
      }
    }

    // Reassemble
    await execFileAsync('ffmpeg', [
      '-i', path.join(framesDir, 'cut_%04d.png'),
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
        'Content-Disposition': 'attachment; filename="cut.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Cut error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
