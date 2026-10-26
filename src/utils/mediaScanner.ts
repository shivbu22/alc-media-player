export type MediaCategory = 'video' | 'audio' | 'image' | 'stream'

export interface MediaAsset {
  id: string
  name: string
  type: MediaCategory
  size: string
  source: string
  extension: string
  remote?: boolean
  streamType?: 'hls' | 'youtube' | 'vimeo' | 'direct'
  youtubeId?: string
  vimeoId?: string
  folderPath?: string
}

export const VIDEO_EXTENSIONS = [
  'mp4',
  'mov',
  'mkv',
  'webm',
  'avi',
  'm4v',
  'ts',
  'flv',
  'wmv',
  '3gp',
  'ogv',
  'mts',
]

export const AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'flac',
  'm4a',
  'aac',
  'ogg',
  'opus',
  'wma',
  'aiff',
  'mka',
]

export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'bmp',
  'avif',
  'tiff',
  'ico',
]

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function detectMediaType(filename: string): MediaCategory | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  return null
}

export function parseInternetUrl(rawUrl: string): {
  type: MediaCategory
  name: string
  streamType: 'hls' | 'youtube' | 'vimeo' | 'direct'
  youtubeId?: string
  vimeoId?: string
  extension: string
} {
  const url = rawUrl.trim()

  // 1. YouTube Detection
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/,
  )
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'video',
      name: `YouTube: ${ytMatch[1]}`,
      streamType: 'youtube',
      youtubeId: ytMatch[1],
      extension: 'YOUTUBE',
    }
  }

  // 2. Vimeo Detection
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'video',
      name: `Vimeo: ${vimeoMatch[1]}`,
      streamType: 'vimeo',
      vimeoId: vimeoMatch[1],
      extension: 'VIMEO',
    }
  }

  // 3. HLS (.m3u8) Stream Detection
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return {
      type: 'video',
      name: 'Online Media Stream',
      streamType: 'direct',
      extension: 'STREAM',
    }
  }

  const pathname = parsed.pathname.toLowerCase()
  if (pathname.includes('.m3u8')) {
    const rawName = decodeURIComponent(parsed.pathname.split('/').pop() || 'HLS Live Stream')
    return {
      type: 'video',
      name: rawName,
      streamType: 'hls',
      extension: 'HLS',
    }
  }

  // 4. File extension from URL path
  const ext = pathname.split('.').pop()?.toLowerCase() ?? ''
  const mediaType = detectMediaType(pathname) || 'video'
  const name = decodeURIComponent(parsed.pathname.split('/').pop() || parsed.hostname) || 'Online Media'

  return {
    type: mediaType,
    name,
    streamType: 'direct',
    extension: ext ? ext.toUpperCase() : 'URL',
  }
}

// Recursive directory scanning for drag-and-drop
export async function scanFileSystemEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      ;(entry as FileSystemFileEntry).file(
        (file) => resolve([file]),
        () => resolve([]),
      )
    })
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const entries: FileSystemEntry[] = []

    const readBatch = async (): Promise<FileSystemEntry[]> => {
      return new Promise((resolve) => {
        reader.readEntries(
          (results) => {
            if (results.length > 0) {
              entries.push(...results)
              readBatch().then(resolve)
            } else {
              resolve(entries)
            }
          },
          () => resolve(entries),
        )
      })
    }

    const allEntries = await readBatch()
    const files = await Promise.all(allEntries.map((child) => scanFileSystemEntry(child)))
    return files.flat()
  }

  return []
}

export async function scanDataTransfer(items: DataTransferItemList): Promise<File[]> {
  const promises: Promise<File[]>[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry()
      if (entry) promises.push(scanFileSystemEntry(entry))
    } else {
      const file = item.getAsFile()
      if (file) promises.push(Promise.resolve([file]))
    }
  }
  const fileLists = await Promise.all(promises)
  return fileLists.flat()
}
