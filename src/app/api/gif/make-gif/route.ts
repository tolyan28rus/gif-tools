import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import GIFEncoder from 'gif-encoder-2'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const delay = Number(formData.get('delay') || '100')

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 100) {
      return NextResponse.json({ error: 'Too many files (max 100)' }, { status: 400 })
    }

    // Read all images and get dimensions
    const frames: Buffer[] = []
    let maxWidth = 0
    let maxHeight = 0

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const metadata = await sharp(buffer).metadata()
      maxWidth = Math.max(maxWidth, metadata.width || 0)
      maxHeight = Math.max(maxHeight, metadata.height || 0)
      frames.push(buffer)
    }

    if (maxWidth === 0 || maxHeight === 0) {
      return NextResponse.json({ error: 'Could not determine dimensions' }, { status: 400 })
    }

    const encoder = new GIFEncoder(maxWidth, maxHeight, 'neuquant', true)
    
    const chunks: Buffer[] = []
    const streamPromise = new Promise<void>((resolve) => {
      encoder.createReadStream()
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', resolve)
    })

    encoder.start()
    encoder.setRepeat(0)
    encoder.setDelay(delay)
    encoder.setQuality(10)

    for (const frameBuffer of frames) {
      const resizedBuffer = await sharp(frameBuffer)
        .resize(maxWidth, maxHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .raw()
        .toBuffer()

      encoder.addFrame(resizedBuffer)
    }

    encoder.finish()

    await streamPromise

    const outputBuffer = Buffer.concat(chunks)

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': 'attachment; filename="created.gif"',
        'X-Output-Size': outputBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Make GIF error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
