import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink, mkdir, readdir, rm } from 'fs/promises'
import path from 'path'
import { execFfmpeg } from '@/lib/ffmpeg-path'

const TMP_DIR = path.join(process.cwd(), 'tmp')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputPath } = body

    if (!inputPath) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const safeInputPath = path.join(TMP_DIR, path.basename(inputPath))
    const id = path.basename(inputPath).replace(/-input\.[^.]+$/, '')
    const framesDir = path.join(TMP_DIR, `${id}-split-frames`)

    await mkdir(framesDir, { recursive: true })
    await execFfmpeg([
      '-i', safeInputPath,
      '-vsync', 'passthrough',
      path.join(framesDir, 'frame_%04d.png'),
    ])

    const files = (await readdir(framesDir)).filter(f => f.endsWith('.png')).sort()

    const frameData = []
    for (const frame of files) {
      const framePath = path.join(framesDir, frame)
      const buffer = await readFile(framePath)
      frameData.push({
        name: frame,
        data: `data:image/png;base64,${buffer.toString('base64')}`,
        size: buffer.length,
      })
      try { await unlink(framePath) } catch {}
    }

    try { await rm(framesDir, { recursive: true, force: true }) } catch {}

    return NextResponse.json({ frames: frameData })
  } catch (error: any) {
    console.error('Split error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
