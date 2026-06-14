import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import JSZip from 'jszip' // We'll use a simple approach instead

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
    const framesDir = path.join(TMP_DIR, `${id}-split-frames`)

    // Extract all frames as PNG
    await mkdir(framesDir, { recursive: true })
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vsync', 'passthrough',
      path.join(framesDir, 'frame_%04d.png'),
    ])

    // Read all frames and return as base64 array
    const { stdout } = await execFileAsync('ls', [framesDir])
    const frames = stdout.trim().split('\n').filter(Boolean).sort()
    
    const frameData = []
    for (const frame of frames) {
      const framePath = path.join(framesDir, frame)
      const buffer = await readFile(framePath)
      frameData.push({
        name: frame,
        data: `data:image/png;base64,${buffer.toString('base64')}`,
        size: buffer.length,
      })
      try { await unlink(framePath) } catch {}
    }

    // Clean up
    try { await unlink(inputPath) } catch {}
    try { await execFileAsync('rm', ['-rf', framesDir]) } catch {}

    return NextResponse.json({ frames: frameData })
  } catch (error: any) {
    console.error('Split error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
