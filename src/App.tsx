import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileAudio,
  FileVideo,
  Film,
  FolderOpen,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Music2,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Repeat,
  Repeat1,
  RotateCw,
  Search,
  Shuffle,
  Sparkles,
  Sun,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import alcMark from './assets/alc-mark.svg'
import { AudioVisualizer } from './components/AudioVisualizer'
import { ImageStudio } from './components/ImageStudio'
import { MotionBackground } from './components/MotionBackground'
import {
  detectMediaType,
  formatBytes,
  MediaAsset,
  MediaCategory,
  parseInternetUrl,
  scanDataTransfer,
} from './utils/mediaScanner'

export type LibraryFilter = 'all' | MediaCategory
type LoopMode = 'off' | 'all' | 'one'

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return '00:00'
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = Math.floor(value % 60)
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function App() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [inputUrlOrPath, setInputUrlOrPath] = useState('')
  const [libraryQuery, setLibraryQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => Number(window.localStorage.getItem('alc-volume') ?? 0.85))
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isDropActive, setIsDropActive] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null)
  const [loopMode, setLoopMode] = useState<LoopMode>('off')
  const [isShuffle, setIsShuffle] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTheater, setIsTheater] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [showOverlayControls, setShowOverlayControls] = useState(true)
  const overlayTimerRef = useRef<number | null>(null)

  // Glass Theme: default 'light' (White & Clear Transparent Glass)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (window.localStorage.getItem('alc-theme') as 'light' | 'dark') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('alc-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const activeAsset = useMemo(
    () => assets.find((asset) => asset.id === activeAssetId) ?? null,
    [activeAssetId, assets],
  )

  // Segregation counts
  const counts = useMemo(() => {
    const video = assets.filter((a) => a.type === 'video').length
    const audio = assets.filter((a) => a.type === 'audio').length
    const image = assets.filter((a) => a.type === 'image').length
    const stream = assets.filter((a) => a.remote).length
    return { all: assets.length, video, audio, image, stream }
  }, [assets])

  // Filtered & searched assets
  const visibleAssets = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase()
    return assets.filter((asset) => {
      let matchesFilter = true
      if (filter === 'stream') matchesFilter = Boolean(asset.remote)
      else if (filter !== 'all') matchesFilter = asset.type === filter
      const matchesQuery = !query || asset.name.toLowerCase().includes(query)
      return matchesFilter && matchesQuery
    })
  }, [assets, filter, libraryQuery])

  const showToast = (message: string) => setToast(message)

  useEffect(() => {
    window.localStorage.setItem('alc-volume', String(volume))
  }, [volume])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement)
      setIsFullscreen(active)
      setShowOverlayControls(true)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Auto-hide HUD on inactivity while playing
  const handleStageActivity = () => {
    setShowOverlayControls(true)
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current)
    }
    if (isPlaying) {
      overlayTimerRef.current = window.setTimeout(() => {
        setShowOverlayControls(false)
      }, 2500)
    }
  }

  const handleStageMouseLeave = () => {
    if (isFullscreen && isPlaying) {
      setShowOverlayControls(false)
    }
  }

  useEffect(() => {
    if (isPlaying) {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = window.setTimeout(() => {
        setShowOverlayControls(false)
      }, 2500)
    } else {
      setShowOverlayControls(true)
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current)
    }
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current)
    }
  }, [isPlaying])

  // Track Picture-in-Picture state on video element
  useEffect(() => {
    const video = mediaRef.current as HTMLVideoElement | null
    if (!video || activeAsset?.type !== 'video') return

    const onEnterPiP = () => setIsPiP(true)
    const onLeavePiP = () => setIsPiP(false)

    video.addEventListener('enterpictureinpicture', onEnterPiP)
    video.addEventListener('leavepictureinpicture', onLeavePiP)

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP)
      video.removeEventListener('leavepictureinpicture', onLeavePiP)
    }
  }, [activeAssetId, activeAsset?.type])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlayback()
      }
      if (event.key.toLowerCase() === 'f') toggleFullscreen()
      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        toggleTheater()
      }
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        void togglePiP()
      }
      if (event.key.toLowerCase() === 'm') toggleMute()
      if (event.key === 'ArrowLeft') {
        if (activeAsset?.type === 'image') selectNextAsset(-1)
        else seekBy(-5)
      }
      if (event.key === 'ArrowRight') {
        if (activeAsset?.type === 'image') selectNextAsset(1)
        else seekBy(5)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Global Clipboard Paste (Ctrl+V) listener
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

      // 1. Files in clipboard
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        event.preventDefault()
        addFiles(Array.from(event.clipboardData.files))
        return
      }

      // 2. Text in clipboard (URL or folder path)
      const pastedText = event.clipboardData?.getData('text')?.trim()
      if (pastedText) {
        event.preventDefault()
        handleUrlOrFolderPath(pastedText)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  // HLS stream binding
  useEffect(() => {
    if (!activeAsset || activeAsset.type !== 'video' || activeAsset.streamType !== 'hls') {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      return
    }

    const videoEl = mediaRef.current as HTMLVideoElement | null
    if (!videoEl) return

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy()
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })
      hls.loadSource(activeAsset.source)
      hls.attachMedia(videoEl)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void videoEl.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) showToast(`Stream issue: ${data.details}`)
      })
      hlsRef.current = hls
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = activeAsset.source
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [activeAsset])

  const selectAsset = (asset: MediaAsset) => {
    setActiveAssetId(asset.id)
    setCurrentTime(Number(window.localStorage.getItem(`alc-position:${asset.name}`) ?? 0))
    setDuration(0)
    setIsPlaying(false)
  }

  // Helper to resolve high-performance media stream URL in Electron
  const getLocalMediaSource = (filePath?: string, fileBlob?: File): string => {
    if (window.electronAPI?.isElectron && filePath) {
      const clean = filePath.replace(/\\/g, '/')
      return `alc-media://local/${encodeURI(clean)}`
    }
    if (fileBlob) {
      return URL.createObjectURL(fileBlob)
    }
    if (filePath) {
      const clean = filePath.replace(/\\/g, '/')
      return clean.startsWith('/') ? `file://${clean}` : `file:///${clean}`
    }
    return ''
  }

  // Adding local files and segregating
  const addFiles = (files: File[]) => {
    const nextAssets: MediaAsset[] = []
    let rejected = 0
    let videoCount = 0
    let audioCount = 0
    let imageCount = 0

    files.forEach((file) => {
      const type = detectMediaType(file.name)
      if (!type) {
        rejected += 1
        return
      }
      if (type === 'video') videoCount++
      if (type === 'audio') audioCount++
      if (type === 'image') imageCount++

      const electronPath = (file as unknown as { path?: string }).path
      const source = getLocalMediaSource(electronPath, file)

      nextAssets.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type,
        size: formatBytes(file.size),
        source,
        extension: file.name.split('.').pop()?.toUpperCase() ?? 'FILE',
        folderPath: electronPath,
      })
    })

    if (nextAssets.length > 0) {
      setAssets((current) => [...nextAssets, ...current])
      setActiveAssetId((current) => current ?? nextAssets[0].id)
      setCurrentTime(0)
      setDuration(0)

      const summary = [
        videoCount ? `${videoCount} video${videoCount > 1 ? 's' : ''}` : '',
        audioCount ? `${audioCount} audio` : '',
        imageCount ? `${imageCount} image${imageCount > 1 ? 's' : ''}` : '',
      ]
        .filter(Boolean)
        .join(', ')

      showToast(`Added ${nextAssets.length} segregated items: ${summary}`)
    } else if (rejected > 0) {
      showToast('No playable video, audio, or image files found in selection')
    }
  }

  // Native or HTML5 folder scan
  const handleOpenFolder = async () => {
    if (window.electronAPI?.openFolderDialog) {
      setIsScanning(true)
      showToast('Scanning folder and subfolders...')
      try {
        const scanned = await window.electronAPI.openFolderDialog()
        if (scanned && scanned.length > 0) {
          const nextAssets: MediaAsset[] = []
          scanned.forEach((file) => {
            const type = detectMediaType(file.name)
            if (!type) return
            nextAssets.push({
              id: `${file.name}-${Math.random().toString(36).slice(2)}`,
              name: file.name,
              type,
              size: formatBytes(file.size),
              source: getLocalMediaSource(file.path),
              extension: file.extension.toUpperCase() || 'FILE',
              folderPath: file.path,
            })
          })
          if (nextAssets.length > 0) {
            setAssets((current) => [...nextAssets, ...current])
            setActiveAssetId((curr) => curr ?? nextAssets[0].id)
            showToast(`Folder imported: ${nextAssets.length} media files segregated!`)
          } else {
            showToast('No media found in the selected folder')
          }
        }
      } catch (err) {
        showToast('Error scanning folder')
      } finally {
        setIsScanning(false)
      }
    } else {
      folderInputRef.current?.click()
    }
  }

  // Handler for pasted text or URL bar input
  const handleUrlOrFolderPath = async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return

    // 1. Check if user pasted a local directory path (e.g. C:\... or /home/...) in Electron
    if (window.electronAPI?.readDirectory && (trimmed.includes(':\\') || trimmed.startsWith('/') || trimmed.startsWith('\\'))) {
      setIsScanning(true)
      showToast('Scanning pasted folder path...')
      try {
        const scanned = await window.electronAPI.readDirectory(trimmed)
        if (scanned && scanned.length > 0) {
          const nextAssets: MediaAsset[] = []
          scanned.forEach((file) => {
            const type = detectMediaType(file.name)
            if (!type) return
            nextAssets.push({
              id: `${file.name}-${Math.random().toString(36).slice(2)}`,
              name: file.name,
              type,
              size: formatBytes(file.size),
              source: getLocalMediaSource(file.path),
              extension: file.extension.toUpperCase() || 'FILE',
              folderPath: file.path,
            })
          })
          if (nextAssets.length > 0) {
            setAssets((curr) => [...nextAssets, ...curr])
            setActiveAssetId((curr) => curr ?? nextAssets[0].id)
            setInputUrlOrPath('')
            showToast(`Imported ${nextAssets.length} media files from folder!`)
            return
          }
        }
      } catch (_) {}
      setIsScanning(false)
    }

    // 2. Parse as internet URL (HLS, YouTube, Vimeo, direct video/audio/image)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = parseInternetUrl(trimmed)
      const asset: MediaAsset = {
        id: `remote-${Date.now()}`,
        name: parsed.name,
        type: parsed.type,
        size: 'Internet Stream',
        source: trimmed,
        extension: parsed.extension,
        remote: true,
        streamType: parsed.streamType,
        youtubeId: parsed.youtubeId,
        vimeoId: parsed.vimeoId,
      }

      setAssets((current) => [asset, ...current])
      setActiveAssetId(asset.id)
      setInputUrlOrPath('')
      setCurrentTime(0)
      setDuration(0)
      showToast(`Added ${parsed.extension} stream: ${parsed.name}`)
      return
    }

    showToast('Paste a valid internet URL or a folder path')
  }

  const handleUrlSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleUrlOrFolderPath(inputUrlOrPath)
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDropActive(false)
    setIsScanning(true)
    try {
      const files = await scanDataTransfer(event.dataTransfer.items)
      if (files.length > 0) {
        addFiles(files)
      } else if (event.dataTransfer.files.length > 0) {
        addFiles(Array.from(event.dataTransfer.files))
      }
    } catch (err) {
      showToast('Error reading dropped files')
    } finally {
      setIsScanning(false)
    }
  }

  const removeAsset = (asset: MediaAsset) => {
    if (!asset.remote && asset.source.startsWith('blob:')) {
      URL.revokeObjectURL(asset.source)
    }
    const remaining = assets.filter((item) => item.id !== asset.id)
    setAssets(remaining)
    if (asset.id === activeAssetId) {
      setActiveAssetId(remaining[0]?.id ?? null)
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
    }
    showToast(`${asset.name} removed`)
  }

  const selectNextAsset = (direction: 1 | -1) => {
    if (visibleAssets.length === 0) return
    const currentIndex = visibleAssets.findIndex((asset) => asset.id === activeAssetId)
    let nextIndex = 0

    if (isShuffle && visibleAssets.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * visibleAssets.length)
      } while (nextIndex === currentIndex)
    } else {
      nextIndex = (currentIndex + direction + visibleAssets.length) % visibleAssets.length
    }

    selectAsset(visibleAssets[nextIndex])
  }

  const togglePlayback = () => {
    if (activeAsset?.type === 'image') return
    if (!mediaRef.current || !activeAsset) {
      showToast('Choose media to start playback')
      return
    }
    if (mediaRef.current.paused) {
      void mediaRef.current.play()
    } else {
      mediaRef.current.pause()
    }
  }

  const seekBy = (amount: number) => {
    if (!mediaRef.current) return
    mediaRef.current.currentTime = Math.max(0, Math.min(duration, mediaRef.current.currentTime + amount))
  }

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value)
    setCurrentTime(nextTime)
    if (mediaRef.current) mediaRef.current.currentTime = nextTime
  }

  const changeRate = (event: ChangeEvent<HTMLSelectElement>) => {
    const rate = Number(event.target.value)
    setPlaybackRate(rate)
    if (mediaRef.current) mediaRef.current.playbackRate = rate
  }

  const changeVolume = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value)
    setVolume(nextVolume)
    setIsMuted(nextVolume === 0)
    if (mediaRef.current) {
      mediaRef.current.volume = nextVolume
      mediaRef.current.muted = nextVolume === 0
    }
  }

  const toggleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (mediaRef.current) mediaRef.current.muted = nextMuted
  }

  const toggleFullscreen = () => {
    if (!stageRef.current) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stageRef.current.requestFullscreen()
  }

  const toggleTheater = () => {
    setIsTheater((prev) => !prev)
  }

  const togglePiP = async () => {
    const video = mediaRef.current as HTMLVideoElement | null
    if (!video || activeAsset?.type !== 'video') {
      showToast('Picture-in-Picture is only available for videos')
      return
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
      } else {
        showToast('Picture-in-Picture is not supported in this environment')
      }
    } catch (_) {
      showToast('Could not start Picture-in-Picture')
    }
  }

  const toggleLoopMode = () => {
    if (loopMode === 'off') setLoopMode('all')
    else if (loopMode === 'all') setLoopMode('one')
    else setLoopMode('off')
  }

  const handleMediaLoaded = () => {
    if (!mediaRef.current) return
    const nextDuration = mediaRef.current.duration || 0
    setDuration(nextDuration)
    const savedPosition = activeAsset
      ? Number(window.localStorage.getItem(`alc-position:${activeAsset.name}`) ?? 0)
      : 0
    if (savedPosition > 0 && savedPosition < nextDuration) {
      mediaRef.current.currentTime = savedPosition
      setCurrentTime(savedPosition)
    }
    mediaRef.current.volume = volume
    mediaRef.current.muted = isMuted
    mediaRef.current.playbackRate = playbackRate
  }

  const handleTimeUpdate = () => {
    const nextTime = mediaRef.current?.currentTime ?? 0
    setCurrentTime(nextTime)
    if (activeAsset) {
      window.localStorage.setItem(`alc-position:${activeAsset.name}`, String(nextTime))
    }
  }

  const handleMediaEnded = () => {
    setIsPlaying(false)
    if (loopMode === 'one') {
      if (mediaRef.current) {
        mediaRef.current.currentTime = 0
        void mediaRef.current.play()
      }
    } else if (loopMode === 'all' || isShuffle) {
      selectNextAsset(1)
    }
  }

  // Universal Downloader (Local, Remote, Stream)
  const downloadActive = async () => {
    if (!activeAsset) {
      showToast('Choose media to download')
      return
    }

    // 1. In Electron with native save dialog
    if (window.electronAPI?.downloadUrl && activeAsset.remote) {
      showToast(`Downloading ${activeAsset.name}...`)
      try {
        const res = await window.electronAPI.downloadUrl(activeAsset.source, activeAsset.name)
        if (res.success) {
          showToast(`Saved to ${res.path}`)
        } else if (!res.canceled) {
          showToast(`Download failed: ${res.error || 'Server error'}`)
        }
      } catch (err) {
        showToast('Download error')
      }
      return
    }

    // 2. Local file / blob
    if (!activeAsset.remote) {
      const a = document.createElement('a')
      a.href = activeAsset.source
      a.download = activeAsset.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast(`Downloaded ${activeAsset.name}`)
      return
    }

    // 3. Remote URL stream download with progress
    showToast(`Downloading ${activeAsset.name}...`)
    setDownloadProgress('Connecting...')
    try {
      const response = await fetch(activeAsset.source)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentLength = Number(response.headers.get('content-length')) || 0
      const reader = response.body?.getReader()

      if (!reader) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = activeAsset.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        showToast(`Downloaded ${activeAsset.name}`)
        setDownloadProgress(null)
        return
      }

      const chunks: Uint8Array[] = []
      let received = 0
      const startTime = Date.now()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.length
          if (contentLength > 0) {
            const percent = Math.round((received / contentLength) * 100)
            const elapsed = (Date.now() - startTime) / 1000
            const speed = (received / (elapsed || 1) / (1024 * 1024)).toFixed(1)
            setDownloadProgress(`${percent}% (${speed} MB/s)`)
          } else {
            setDownloadProgress(`${(received / (1024 * 1024)).toFixed(1)} MB`)
          }
        }
      }

      const blob = new Blob(chunks as unknown as BlobPart[])
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = activeAsset.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(downloadUrl)
      showToast(`Saved ${activeAsset.name} successfully`)
    } catch (_) {
      // Fallback
      const a = document.createElement('a')
      a.href = activeAsset.source
      a.download = activeAsset.name
      a.target = '_blank'
      a.rel = 'noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast('Download requested from source server')
    } finally {
      setDownloadProgress(null)
    }
  }

  // Render media stage content based on segregated type
  const renderMedia = () => {
    if (!activeAsset) {
      return (
        <div className="preview-empty">
          <MotionBackground intensity="vibrant" />
          <div className="preview-empty-mark">
            <Sparkles size={28} />
          </div>
          <strong>ALC Media Studio Ready</strong>
          <span>Drop entire folders, paste any internet video URL, or import files.</span>
          <div className="empty-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} /> Import Files
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={handleOpenFolder}
            >
              <FolderPlus size={15} /> Import Folder
            </button>
          </div>
        </div>
      )
    }

    // 1. YouTube Player
    if (activeAsset.streamType === 'youtube' && activeAsset.youtubeId) {
      return (
        <div className="stream-frame-wrap">
          <iframe
            key={activeAsset.id}
            src={`https://www.youtube.com/embed/${activeAsset.youtubeId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com&widget_referrer=https://www.youtube.com`}
            title={activeAsset.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="stream-iframe"
          />
        </div>
      )
    }

    // 2. Vimeo Player
    if (activeAsset.streamType === 'vimeo' && activeAsset.vimeoId) {
      return (
        <div className="stream-frame-wrap">
          <iframe
            key={activeAsset.id}
            src={`https://player.vimeo.com/video/${activeAsset.vimeoId}?autoplay=1`}
            title={activeAsset.name}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="stream-iframe"
          />
        </div>
      )
    }

    // 3. Image Studio
    if (activeAsset.type === 'image') {
      return (
        <ImageStudio
          src={activeAsset.source}
          name={activeAsset.name}
          size={activeAsset.size}
          extension={activeAsset.extension}
          onPrev={() => selectNextAsset(-1)}
          onNext={() => selectNextAsset(1)}
          onDownload={downloadActive}
          hasPrev={visibleAssets.length > 1}
          hasNext={visibleAssets.length > 1}
        />
      )
    }

    // 4. Video Player (Direct or HLS)
    if (activeAsset.type === 'video') {
      return (
        <div className="video-player-wrap">
          {/* Reactive Ambient Glow */}
          <div className={`video-ambient-glow ${isPlaying ? 'glow-active' : ''}`} />
          <video
            key={activeAsset.id}
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            className="media-element"
            src={activeAsset.streamType === 'hls' ? undefined : activeAsset.source}
            onLoadedMetadata={handleMediaLoaded}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleMediaEnded}
            onError={() =>
              showToast(
                activeAsset.remote
                  ? 'Streaming error: Link could not be decoded'
                  : 'Video format could not be decoded',
              )
            }
            playsInline
            controls={false}
          />
        </div>
      )
    }

    // 5. Audio Player with Dynamic Canvas Visualizer
    return (
      <div className="audio-station-wrap">
        <AudioVisualizer
          mediaElement={mediaRef.current}
          isPlaying={isPlaying}
          title={activeAsset.name}
        />
        <audio
          key={activeAsset.id}
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={activeAsset.source}
          onLoadedMetadata={handleMediaLoaded}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleMediaEnded}
          onError={() =>
            showToast(
              activeAsset.remote
                ? 'Audio stream could not be loaded'
                : 'Audio format could not be decoded',
            )
          }
        />
      </div>
    )
  }

  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        e.preventDefault()
        setIsDropActive(true)
      }}
    >
      {/* Ambient Liquid Glass Atmosphere */}
      <div className="liquid-glass-background" aria-hidden="true">
        <div className="liquid-orb liquid-orb-1" />
        <div className="liquid-orb liquid-orb-2" />
        <div className="liquid-orb liquid-orb-3" />
        <div className="liquid-orb liquid-orb-4" />
        <div className="liquid-orb liquid-orb-5" />
        <div className="liquid-glass-mesh" />
      </div>

      {/* File inputs */}
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="audio/*,video/*,image/*,.mp3,.mp4,.mov,.mkv,.webm,.wav,.flac,.m4a,.aac,.ogg,.opus,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.avif"
        multiple
        onChange={(e) => {
          if (e.target.files) addFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      {/* Folder input */}
      <input
        ref={folderInputRef}
        className="visually-hidden"
        type="file"
        // @ts-expect-error webkitdirectory is standard for folder inputs
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          if (e.target.files) addFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-symbol">
            <img src={alcMark} alt="ALC" />
          </div>
          <div>
            <strong className="brand-name">ALC</strong>
            <span className="brand-version">STUDIO</span>
          </div>
        </div>

        <div className="topbar-message">
          <strong>Folders · Streams · Visualizer</strong>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Nebula Glass' : 'Switch to White Clear Transparent Glass'}
            aria-label="Toggle Glass Theme"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'White Glass'}</span>
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleOpenFolder}
            title="Import whole folder with images, videos, audio"
          >
            <FolderPlus size={15} /> Import Folder
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15} /> Import Files
          </button>
        </div>
      </header>

      <main className="workspace">
        {/* Universal URL & Folder Input Form */}
        <form className="url-panel" onSubmit={handleUrlSubmit}>
          <div className="url-icon">
            <Globe size={18} />
          </div>
          <div className="url-copy">
            <strong>Stream Any Video or Paste Folder Path</strong>
            <span>YouTube, Vimeo, HLS (.m3u8), MP4, MP3 or folder path</span>
          </div>
          <input
            value={inputUrlOrPath}
            onChange={(e) => setInputUrlOrPath(e.target.value)}
            placeholder="Paste internet video link (e.g. YouTube, .m3u8 stream) or local folder path..."
            aria-label="Media link or folder path"
          />
          <button type="submit" className="button button-secondary">
            <Link2 size={14} /> Open
          </button>
        </form>

        <div className={`player-layout ${isTheater ? 'theater-mode' : ''}`}>
          {/* Library Panel with Media Segregation Tabs */}
          <aside className="library-panel">
            <div className="panel-heading">
              <div>
                <span className="kicker">SEGREGATED MEDIA</span>
                <h1>
                  Library <small>{assets.length}</small>
                </h1>
              </div>
              <div className="heading-buttons">
                <button
                  type="button"
                  className="icon-button"
                  title="Import Folder"
                  onClick={handleOpenFolder}
                >
                  <FolderPlus size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="Import Files"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                </button>
              </div>
            </div>

            <div className="library-tools">
              <label className="search-field">
                <Search size={14} />
                <input
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  placeholder="Search in segregated library…"
                  aria-label="Search media"
                />
              </label>

              {/* Segregated Category Tabs */}
              <div className="filter-tabs" role="tablist" aria-label="Media segregation filter">
                <button
                  type="button"
                  className={filter === 'all' ? 'active' : ''}
                  onClick={() => setFilter('all')}
                >
                  <Layers size={13} /> All <span className="tab-pill">{counts.all}</span>
                </button>
                <button
                  type="button"
                  className={filter === 'video' ? 'active tab-video' : 'tab-video'}
                  onClick={() => setFilter('video')}
                >
                  <Film size={13} /> Videos <span className="tab-pill">{counts.video}</span>
                </button>
                <button
                  type="button"
                  className={filter === 'audio' ? 'active tab-audio' : 'tab-audio'}
                  onClick={() => setFilter('audio')}
                >
                  <Music2 size={13} /> Music <span className="tab-pill">{counts.audio}</span>
                </button>
                <button
                  type="button"
                  className={filter === 'image' ? 'active tab-image' : 'tab-image'}
                  onClick={() => setFilter('image')}
                >
                  <ImageIcon size={13} /> Images <span className="tab-pill">{counts.image}</span>
                </button>
                {counts.stream > 0 && (
                  <button
                    type="button"
                    className={filter === 'stream' ? 'active tab-stream' : 'tab-stream'}
                    onClick={() => setFilter('stream')}
                  >
                    <Globe size={13} /> Streams <span className="tab-pill">{counts.stream}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Media Item List */}
            <div
              className={`media-list ${isDropActive ? 'drag-active' : ''}`}
              onDragEnter={(e) => {
                e.preventDefault()
                setIsDropActive(true)
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setIsDropActive(false)
              }}
              onDrop={handleDrop}
            >
              {isScanning ? (
                <div className="library-scanning">
                  <Loader2 size={24} className="spinning" />
                  <span>Scanning and segregating media...</span>
                </div>
              ) : visibleAssets.length === 0 ? (
                <div className="library-empty">
                  <div className="empty-graphic">
                    <FolderOpen size={22} />
                  </div>
                  <strong>
                    {assets.length === 0 ? 'Drop Whole Folder Here' : 'No items in this category'}
                  </strong>
                  <span>
                    {assets.length === 0
                      ? 'Folders, videos, music, photos, or internet stream links.'
                      : 'Switch tabs or add more media.'}
                  </span>
                  {assets.length === 0 && (
                    <div className="empty-btn-group">
                      <button
                        type="button"
                        className="button button-secondary small"
                        onClick={handleOpenFolder}
                      >
                        <FolderPlus size={13} /> Select Folder
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                visibleAssets.map((asset) => {
                  const isSelected = activeAssetId === asset.id
                  const isCurrentPlaying = isSelected && isPlaying

                  return (
                    <div
                      className={`media-row ${isSelected ? 'selected' : ''}`}
                      key={asset.id}
                    >
                      <button
                        type="button"
                        className="media-row-main"
                        onClick={() => selectAsset(asset)}
                      >
                        <div className={`media-thumb ${asset.type}`}>
                          {asset.type === 'video' && <FileVideo size={17} />}
                          {asset.type === 'audio' && <FileAudio size={17} />}
                          {asset.type === 'image' && <ImageIcon size={17} />}
                          <span>{asset.extension}</span>
                        </div>

                        <span className="media-row-copy">
                          <strong title={asset.name}>{asset.name}</strong>
                          <small>
                            {asset.remote
                              ? `Online ${asset.streamType?.toUpperCase() || 'STREAM'}`
                              : asset.type.toUpperCase()}{' '}
                            · {asset.size}
                          </small>
                        </span>

                        {/* Animated miniature equalizer icon for playing audio/video */}
                        {isCurrentPlaying && (
                          <div className="mini-equalizer" title="Playing">
                            <span className="eq-bar bar-1" />
                            <span className="eq-bar bar-2" />
                            <span className="eq-bar bar-3" />
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        className="row-remove"
                        aria-label={`Remove ${asset.name}`}
                        title="Remove from library"
                        onClick={() => removeAsset(asset)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )
                })
              )}

              {isDropActive && (
                <div className="drop-overlay">
                  <Upload size={22} />
                  <span>Release to import folder or files</span>
                  <small>Auto-segregates Videos, Music, and Images</small>
                </div>
              )}
            </div>
          </aside>

          {/* Active Player Panel */}
          <section className="player-panel">
            <div className="player-heading">
              <div className="heading-left">
                <span className="kicker">
                  {activeAsset
                    ? `${activeAsset.type.toUpperCase()} PLAYER`
                    : 'MEDIA PLAYER'}
                </span>
                <h2>{activeAsset?.name ?? 'Choose media or drop a folder'}</h2>
              </div>
              <span className={`source-badge badge-${activeAsset?.type || 'ready'}`}>
                {activeAsset
                  ? activeAsset.remote
                    ? `STREAM · ${activeAsset.extension}`
                    : activeAsset.type.toUpperCase()
                  : 'READY'}
              </span>
            </div>

            {/* Stage containing Video, Audio Visualizer, or Image Studio */}
            <div
              ref={stageRef}
              className={`preview-stage ${isFullscreen && !showOverlayControls ? 'hide-cursor' : ''}`}
              onMouseMove={handleStageActivity}
              onMouseEnter={handleStageActivity}
              onMouseLeave={handleStageMouseLeave}
            >
              {renderMedia()}

              {/* On-Screen HUD Overlay for Fullscreen and Active Playback Hover */}
              {activeAsset && activeAsset.type !== 'image' && (
                <div
                  className={`stage-overlay-controls ${
                    showOverlayControls || !isPlaying ? 'visible' : ''
                  }`}
                >
                  <div className="overlay-top-bar">
                    <div className="overlay-title-group">
                      <span className="overlay-kicker">
                        {isFullscreen
                          ? 'FULLSCREEN HUD'
                          : isTheater
                          ? 'THEATER VIEW'
                          : 'NOW PLAYING'}
                      </span>
                      <span className="overlay-title" title={activeAsset.name}>
                        {activeAsset.name}
                      </span>
                    </div>

                    <div className="overlay-top-actions">
                      {activeAsset.type === 'video' && (
                        <button
                          type="button"
                          className={`overlay-icon-btn ${isPiP ? 'active' : ''}`}
                          title={isPiP ? 'Exit Picture-in-Picture (P)' : 'Picture-in-Picture (P)'}
                          onClick={togglePiP}
                        >
                          <PictureInPicture2 size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        className={`overlay-icon-btn ${isTheater ? 'active' : ''}`}
                        title={isTheater ? 'Exit Theater Mode (T)' : 'Theater Mode (T)'}
                        onClick={toggleTheater}
                      >
                        <RectangleHorizontal size={16} />
                      </button>
                      <button
                        type="button"
                        className="overlay-icon-btn"
                        title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                        onClick={toggleFullscreen}
                      >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="overlay-bottom-bar">
                    <div className="overlay-seek-row">
                      <span className="overlay-timecode">{formatTime(currentTime)}</span>
                      <div className="overlay-range-wrap">
                        <input
                          aria-label="Seek"
                          type="range"
                          min="0"
                          max={duration || 1}
                          step="0.01"
                          value={Math.min(currentTime, duration || 1)}
                          onChange={handleSeek}
                        />
                        <span
                          className="overlay-range-progress"
                          style={{
                            width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="overlay-timecode muted">{formatTime(duration)}</span>
                    </div>

                    <div className="overlay-actions-row">
                      <div className="overlay-cluster">
                        <button
                          type="button"
                          className={`overlay-btn icon-btn ${isShuffle ? 'active' : ''}`}
                          title={isShuffle ? 'Shuffle ON' : 'Shuffle OFF'}
                          onClick={() => setIsShuffle(!isShuffle)}
                        >
                          <Shuffle size={14} />
                        </button>
                        <button
                          type="button"
                          className="overlay-btn icon-btn"
                          title="Previous item"
                          onClick={() => selectNextAsset(-1)}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          type="button"
                          className="overlay-btn skip-btn"
                          title="Rewind 5s (←)"
                          onClick={() => seekBy(-5)}
                        >
                          <span className="skip-number">5</span>
                          <ChevronLeft size={13} />
                        </button>
                        <button
                          type="button"
                          className="overlay-play-btn"
                          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                          onClick={togglePlayback}
                        >
                          {isPlaying ? (
                            <Pause size={20} fill="currentColor" />
                          ) : (
                            <Play size={20} fill="currentColor" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="overlay-btn skip-btn"
                          title="Forward 5s (→)"
                          onClick={() => seekBy(5)}
                        >
                          <ChevronRight size={13} />
                          <span className="skip-number">5</span>
                        </button>
                        <button
                          type="button"
                          className="overlay-btn icon-btn"
                          title="Next item"
                          onClick={() => selectNextAsset(1)}
                        >
                          <ChevronRight size={18} />
                        </button>
                        <button
                          type="button"
                          className={`overlay-btn icon-btn ${
                            loopMode !== 'off' ? 'active' : ''
                          }`}
                          title={`Loop: ${loopMode.toUpperCase()}`}
                          onClick={toggleLoopMode}
                        >
                          {loopMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                        </button>
                      </div>

                      <div className="overlay-cluster right">
                        <div className="overlay-volume-group">
                          <button
                            type="button"
                            className="overlay-btn icon-btn"
                            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                            onClick={toggleMute}
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX size={15} />
                            ) : (
                              <Volume2 size={15} />
                            )}
                          </button>
                          <input
                            className="overlay-volume-slider"
                            aria-label="Volume"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={changeVolume}
                          />
                        </div>

                        {activeAsset.type === 'video' && (
                          <button
                            type="button"
                            className={`overlay-btn icon-btn ${isPiP ? 'active' : ''}`}
                            title={
                              isPiP ? 'Exit Picture-in-Picture (P)' : 'Picture-in-Picture (P)'
                            }
                            onClick={togglePiP}
                          >
                            <PictureInPicture2 size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          className={`overlay-btn icon-btn ${isTheater ? 'active' : ''}`}
                          title={isTheater ? 'Exit Theater Mode (T)' : 'Theater Mode (T)'}
                          onClick={toggleTheater}
                        >
                          <RectangleHorizontal size={15} />
                        </button>

                        <button
                          type="button"
                          className="overlay-btn icon-btn"
                          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                          onClick={toggleFullscreen}
                        >
                          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="stage-label">
                {activeAsset
                  ? activeAsset.remote
                    ? `INTERNET ${activeAsset.streamType?.toUpperCase() || 'STREAM'}`
                    : 'LOCAL ASSET'
                  : 'PREVIEW'}
              </div>
            </div>

            {/* Controls (for Video & Audio) */}
            {activeAsset && activeAsset.type !== 'image' && (
              <div className="player-controls">
                {/* Seek Bar */}
                <div className="seek-row">
                  <span className="timecode">{formatTime(currentTime)}</span>
                  <div className="range-wrap">
                    <input
                      aria-label="Seek"
                      type="range"
                      min="0"
                      max={duration || 1}
                      step="0.01"
                      value={Math.min(currentTime, duration || 1)}
                      onChange={handleSeek}
                    />
                    <span
                      className="range-progress"
                      style={{
                        width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="timecode muted">{formatTime(duration)}</span>
                </div>

                {/* Control buttons */}
                <div className="controls-row">
                  <div className="control-cluster">
                    <button
                      type="button"
                      className={`icon-button control ${isShuffle ? 'active-toggle' : ''}`}
                      aria-label="Shuffle"
                      title={isShuffle ? 'Shuffle ON' : 'Shuffle OFF'}
                      onClick={() => setIsShuffle(!isShuffle)}
                    >
                      <Shuffle size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button control"
                      aria-label="Previous item"
                      title="Previous"
                      onClick={() => selectNextAsset(-1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button control skip"
                      aria-label="Back 5 seconds"
                      onClick={() => seekBy(-5)}
                    >
                      <span>5</span>
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      className="play-button"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      onClick={togglePlayback}
                    >
                      {isPlaying ? (
                        <Pause size={19} fill="currentColor" />
                      ) : (
                        <Play size={19} fill="currentColor" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="icon-button control skip"
                      aria-label="Forward 5 seconds"
                      onClick={() => seekBy(5)}
                    >
                      <ChevronRight size={12} />
                      <span>5</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button control"
                      aria-label="Next item"
                      title="Next"
                      onClick={() => selectNextAsset(1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      className={`icon-button control ${loopMode !== 'off' ? 'active-toggle' : ''}`}
                      aria-label="Loop Mode"
                      title={`Loop: ${loopMode.toUpperCase()}`}
                      onClick={toggleLoopMode}
                    >
                      {loopMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                    </button>
                  </div>

                  <div className="control-cluster control-right">
                    <div className="volume-control">
                      <button
                        type="button"
                        className="icon-button control"
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                        onClick={toggleMute}
                      >
                        {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                      </button>
                      <input
                        aria-label="Volume"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={changeVolume}
                      />
                    </div>

                    <label className="speed-control">
                      <span>Speed</span>
                      <select
                        value={playbackRate}
                        onChange={changeRate}
                        aria-label="Playback speed"
                      >
                        <option value="0.25">0.25×</option>
                        <option value="0.5">0.5×</option>
                        <option value="0.75">0.75×</option>
                        <option value="1">1×</option>
                        <option value="1.25">1.25×</option>
                        <option value="1.5">1.5×</option>
                        <option value="2">2×</option>
                      </select>
                    </label>

                    {activeAsset.type === 'video' && (
                      <button
                        type="button"
                        className={`icon-button control ${isPiP ? 'active-toggle' : ''}`}
                        aria-label="Picture in Picture"
                        title={isPiP ? 'Exit Picture-in-Picture (P)' : 'Picture-in-Picture (P)'}
                        onClick={togglePiP}
                      >
                        <PictureInPicture2 size={17} />
                      </button>
                    )}

                    <button
                      type="button"
                      className={`icon-button control ${isTheater ? 'active-toggle' : ''}`}
                      aria-label="Theater Mode"
                      title={isTheater ? 'Exit Theater Mode (T)' : 'Theater Mode (T)'}
                      onClick={toggleTheater}
                    >
                      <RectangleHorizontal size={17} />
                    </button>

                    <button
                      type="button"
                      className="icon-button control"
                      aria-label="Fullscreen"
                      title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer with Universal Downloader */}
            <div className="player-footer">
              <span className="footer-details">
                {activeAsset ? (
                  <>
                    <strong>{activeAsset.extension}</strong> ·{' '}
                    {activeAsset.remote ? 'Internet Source' : 'Local Storage'} · {activeAsset.size}
                    {downloadProgress && (
                      <span className="download-badge">
                        <Loader2 size={12} className="spinning" /> {downloadProgress}
                      </span>
                    )}
                  </>
                ) : (
                  'No media loaded. Drag a folder or paste any stream link.'
                )}
              </span>

              <div className="footer-actions">
                <button
                  type="button"
                  className="button button-ghost small"
                  disabled={!activeAsset}
                  onClick={downloadActive}
                  title="Download / save media to disk"
                >
                  <Download size={14} /> Download
                </button>
                <button
                  type="button"
                  className="button button-ghost small"
                  disabled={!activeAsset}
                  onClick={() => activeAsset && removeAsset(activeAsset)}
                >
                  Remove
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="statusbar">
        <span>
          <span className="live-dot" /> Universal Media Studio Active
        </span>
        <span>
          Videos: <strong>{counts.video}</strong>
        </span>
        <span>
          Audio: <strong>{counts.audio}</strong>
        </span>
        <span>
          Images: <strong>{counts.image}</strong>
        </span>
        <span className="spacer" />
        <span>Space: play/pause</span>
        <span>F: fullscreen</span>
        <span>Ctrl+V: paste folder or link</span>
      </footer>

      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">✓</span>
          <span>{toast}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default App
