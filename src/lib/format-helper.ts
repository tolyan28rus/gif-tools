import path from 'path'

export interface FormatInfo {
  ext: string
  isGif: boolean
  isAnimated: boolean
  isImage: boolean
  isVideo: boolean
  mimeType: string
}

export function detectFormat(inputPath: string): FormatInfo {
  const ext = path.extname(inputPath).replace('.', '').toLowerCase()
  const mimeTypes: Record<string, string> = {
    gif: 'image/gif',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/avi',
    mov: 'video/quicktime',
  }
  const videoExts = ['mp4', 'webm', 'avi', 'mov']
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif']
  const isGif = ext === 'gif'
  return {
    ext,
    isGif,
    isAnimated: isGif,
    isImage: imageExts.includes(ext) || isGif,
    isVideo: videoExts.includes(ext),
    mimeType: mimeTypes[ext] || 'application/octet-stream',
  }
}

export function extensionToFormat(ext: string): 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff' {
  const e = ext.toLowerCase()
  if (e === 'jpg') return 'jpeg'
  if (e === 'tif') return 'tiff'
  return e as any
}

export function pickOutputFormat(inputExt: string, preferredFormat?: string): string {
  if (preferredFormat) return preferredFormat
  const e = inputExt.toLowerCase()
  if (['gif', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'].includes(e)) return e
  return 'png'
}

export function clampCrop(x: number, y: number, w: number, h: number, fw: number, fh: number) {
  const clampedX = Math.min(x, fw - 1)
  const clampedY = Math.min(y, fh - 1)
  const clampedW = Math.min(w, fw - clampedX)
  const clampedH = Math.min(h, fh - clampedY)
  return { left: Math.max(0, clampedX), top: Math.max(0, clampedY), width: Math.max(1, clampedW), height: Math.max(1, clampedH) }
}
