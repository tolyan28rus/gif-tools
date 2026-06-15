import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { readFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { execFfmpeg } from '@/lib/ffmpeg-path'

const TMP_DIR = path.join(process.cwd(), 'tmp')

async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTmpDir()
    const formData = await request.formData()
    const file = formData.get('file') as File
    const startTime = formData.get('startTime') as string || '0'
    const duration = formData.get('duration') as string || '5'
    const fps = formData.get('fps') as string || '10'
    const width = formData.get('width') as string || '480'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const id = randomUUID()
    const inputPath = path.join(TMP_DIR, `${id}-input${file.name.endsWith('.mp4') ? '.mp4' : file.name.endsWith('.webm') ? '.webm' : '.mp4'}`)
    const palettePath = path.join(TMP_DIR, `${id}-palette.png`)
    const outputPath = path.join(TMP_DIR, `${id}-output.gif`)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)

    await execFfmpeg([
      '-ss', startTime,
      '-t', duration,
      '-i', inputPath,
      '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
      palettePath,
    ])

    await execFfmpeg([
      '-ss', startTime,
      '-t', duration,
      '-i', inputPath,
      '-i', palettePath,
      '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
      outputPath,
    ])

    const outputBuffer = await readFile(outputPath)

    // Clean up
    try { await unlink(palettePath) } catch {}

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="video-to-gif.gif"',
        'X-Output-Path': outputPath,
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Video to GIF error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal processing error' }, { status: 500 })
  }
}
