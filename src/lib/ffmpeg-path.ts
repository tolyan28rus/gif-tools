import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { existsSync } from 'fs'

const FFMPEG_OVERRIDE = process.env.FFMPEG_PATH

function findFfmpegPath(): string {
  if (FFMPEG_OVERRIDE && existsSync(FFMPEG_OVERRIDE)) {
    return FFMPEG_OVERRIDE
  }
  const bundled = path.join(process.cwd(), 'resources', 'ffmpeg', 'ffmpeg.exe')
  if (existsSync(bundled)) {
    return bundled
  }
  return 'ffmpeg'
}

const _execFileAsync = promisify(execFile)

export async function execFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return _execFileAsync(findFfmpegPath(), args)
}
