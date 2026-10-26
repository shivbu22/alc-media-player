import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react'

interface ImageStudioProps {
  src: string
  name: string
  size?: string
  extension?: string
  onPrev?: () => void
  onNext?: () => void
  onDownload?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function ImageStudio({
  src,
  name,
  size,
  extension,
  onPrev,
  onNext,
  onDownload,
  hasPrev = true,
  hasNext = true,
}: ImageStudioProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [isSlideshow, setIsSlideshow] = useState(false)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset transforms when image changes
  useEffect(() => {
    setScale(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setDimensions(null)
  }, [src])

  // Automated slideshow timer
  useEffect(() => {
    if (!isSlideshow || !onNext) return
    const interval = setInterval(() => {
      onNext()
    }, 3500)
    return () => clearInterval(interval)
  }, [isSlideshow, onNext])

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.0015
    setScale((prev) => Math.max(0.2, Math.min(5, prev + delta)))
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
  }

  const zoomIn = () => setScale((s) => Math.min(5, s + 0.25))
  const zoomOut = () => setScale((s) => Math.max(0.2, s - 0.25))
  const resetZoom = () => {
    setScale(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
  }
  const rotateLeft = () => setRotation((r) => r - 90)
  const rotateRight = () => setRotation((r) => r + 90)
  const toggleFlipH = () => setFlipH((f) => !f)
  const toggleFlipV = () => setFlipV((f) => !f)

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void containerRef.current.requestFullscreen()
    }
  }

  return (
    <div ref={containerRef} className="image-studio" onWheel={handleWheel}>
      {/* Ambient backdrop glow based on image */}
      <div
        className="image-ambient-glow"
        style={{ backgroundImage: `url(${src})` }}
      />

      {/* Main Image Viewport */}
      <div className="image-viewport">
        <img
          key={src}
          src={src}
          alt={name}
          className="studio-image"
          onLoad={handleImageLoad}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
          }}
          draggable={false}
        />
      </div>

      {/* Navigation Arrows */}
      {hasPrev && onPrev && (
        <button
          type="button"
          className="image-nav-btn prev"
          onClick={onPrev}
          aria-label="Previous image"
          title="Previous Image (Left Arrow)"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {hasNext && onNext && (
        <button
          type="button"
          className="image-nav-btn next"
          onClick={onNext}
          aria-label="Next image"
          title="Next Image (Right Arrow)"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Image Info Pill */}
      <div className="image-info-tag">
        <span className="info-ext">{extension ?? 'IMAGE'}</span>
        <span className="info-name">{name}</span>
        {dimensions && (
          <span className="info-res">
            {dimensions.width} × {dimensions.height} px
          </span>
        )}
        <span className="info-scale">{Math.round(scale * 100)}%</span>
        {size && <span className="info-size">{size}</span>}
      </div>

      {/* Floating Interactive Toolbar */}
      <div className="image-toolbar" role="toolbar" aria-label="Image Studio Tools">
        <button
          type="button"
          className={`image-tool-btn ${isSlideshow ? 'active' : ''}`}
          onClick={() => setIsSlideshow(!isSlideshow)}
          title={isSlideshow ? 'Pause Slideshow' : 'Start Auto Slideshow (3.5s)'}
        >
          {isSlideshow ? <Pause size={15} /> : <Play size={15} />}
          <span>{isSlideshow ? 'Slideshow ON' : 'Slideshow'}</span>
        </button>

        <div className="tool-divider" />

        <button type="button" className="image-tool-btn icon-only" onClick={zoomOut} title="Zoom Out (-)">
          <ZoomOut size={16} />
        </button>
        <button type="button" className="image-tool-btn icon-only" onClick={zoomIn} title="Zoom In (+)">
          <ZoomIn size={16} />
        </button>
        <button type="button" className="image-tool-btn icon-only" onClick={resetZoom} title="Reset Scale (100%)">
          <Maximize size={16} />
        </button>

        <div className="tool-divider" />

        <button type="button" className="image-tool-btn icon-only" onClick={rotateLeft} title="Rotate Left 90°">
          <RotateCcw size={16} />
        </button>
        <button type="button" className="image-tool-btn icon-only" onClick={rotateRight} title="Rotate Right 90°">
          <RotateCw size={16} />
        </button>
        <button
          type="button"
          className={`image-tool-btn icon-only ${flipH ? 'active' : ''}`}
          onClick={toggleFlipH}
          title="Flip Horizontal"
        >
          <FlipHorizontal size={16} />
        </button>
        <button
          type="button"
          className={`image-tool-btn icon-only ${flipV ? 'active' : ''}`}
          onClick={toggleFlipV}
          title="Flip Vertical"
        >
          <FlipVertical size={16} />
        </button>

        <div className="tool-divider" />

        {onDownload && (
          <button type="button" className="image-tool-btn icon-only" onClick={onDownload} title="Download Image">
            <Download size={16} />
          </button>
        )}
        <button type="button" className="image-tool-btn icon-only" onClick={toggleFullscreen} title="Fullscreen (F)">
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  )
}
