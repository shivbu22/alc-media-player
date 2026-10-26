import { useEffect, useRef, useState } from 'react'
import { Activity, Disc3, Radio, Waves } from 'lucide-react'

export type VisualizerMode = 'cyber-bars' | 'radial-pulse' | 'waveform'

interface AudioVisualizerProps {
  mediaElement: HTMLAudioElement | HTMLVideoElement | null
  isPlaying: boolean
  title?: string
  accentColor?: string
}

export function AudioVisualizer({
  mediaElement,
  isPlaying,
  title,
  accentColor = '#3565ed',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mode, setMode] = useState<VisualizerMode>('cyber-bars')
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [isAudioConnected, setIsAudioConnected] = useState(false)

  // Initialize Web Audio API connection
  useEffect(() => {
    if (!mediaElement) return

    const setupAudio = () => {
      try {
        if (!audioContextRef.current) {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          if (!AudioCtx) return
          audioContextRef.current = new AudioCtx()
        }

        const ctx = audioContextRef.current
        if (ctx.state === 'suspended' && isPlaying) {
          void ctx.resume()
        }

        if (!analyserRef.current) {
          analyserRef.current = ctx.createAnalyser()
          analyserRef.current.fftSize = 256
          analyserRef.current.smoothingTimeConstant = 0.8
        }

        if (!sourceRef.current) {
          // Avoid multiple createMediaElementSource calls on same element
          sourceRef.current = ctx.createMediaElementSource(mediaElement)
          sourceRef.current.connect(analyserRef.current)
          analyserRef.current.connect(ctx.destination)
          setIsAudioConnected(true)
        }
      } catch (err) {
        // May fail if cross-origin or already hooked - fallback simulator will take over
        setIsAudioConnected(false)
      }
    }

    if (isPlaying) {
      setupAudio()
    }
  }, [mediaElement, isPlaying])

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let phase = 0

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      let dataArray: Uint8Array
      if (analyserRef.current && isAudioConnected) {
        const bufferLength = analyserRef.current.frequencyBinCount
        dataArray = new Uint8Array(bufferLength)
        if (mode === 'waveform') {
          analyserRef.current.getByteTimeDomainData(dataArray as unknown as Uint8Array<ArrayBuffer>)
        } else {
          analyserRef.current.getByteFrequencyData(dataArray as unknown as Uint8Array<ArrayBuffer>)
        }
      } else {
        // Dynamic simulated reactive frequencies if audio context is disconnected/CORS
        const bufferLength = 64
        dataArray = new Uint8Array(bufferLength)
        const time = Date.now() / 1000
        for (let i = 0; i < bufferLength; i++) {
          if (!isPlaying) {
            dataArray[i] = Math.sin(i * 0.2 + time) * 8 + 12
          } else {
            const beat = Math.sin(time * 3.5) * 40 + Math.sin(time * 7) * 20
            const wave = Math.sin(i * 0.15 + phase) * 60 + Math.cos(i * 0.3 - phase * 0.5) * 40
            dataArray[i] = Math.max(10, Math.min(255, 90 + beat + wave))
          }
        }
      }

      phase += 0.04

      if (mode === 'cyber-bars') {
        drawCyberBars(ctx, width, height, dataArray, isPlaying, accentColor)
      } else if (mode === 'radial-pulse') {
        drawRadialPulse(ctx, width, height, dataArray, isPlaying, phase)
      } else {
        drawWaveform(ctx, width, height, dataArray, isPlaying, phase)
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [mode, isPlaying, isAudioConnected, accentColor])

  // Resize canvas for device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="visualizer-container">
      {/* Background ambient lighting aura */}
      <div className={`visualizer-ambient ${isPlaying ? 'pulse' : ''}`} />

      {/* Floating Vinyl Centerpiece for Audio */}
      <div className={`visualizer-disc-wrap ${isPlaying ? 'spinning' : ''}`}>
        <div className="visualizer-disc">
          <div className="disc-grooves" />
          <div className="disc-center">
            <Disc3 size={32} className="disc-icon" />
          </div>
        </div>
      </div>

      {/* Canvas Graphics */}
      <canvas ref={canvasRef} className="visualizer-canvas" />

      {/* Track Label */}
      {title && (
        <div className="visualizer-track-card">
          <span className="visualizer-status">
            <span className={`live-pulse-dot ${isPlaying ? 'active' : ''}`} />
            {isPlaying ? 'NOW PLAYING' : 'PAUSED'}
          </span>
          <strong className="visualizer-track-title" title={title}>
            {title}
          </strong>
        </div>
      )}

      {/* Visualizer Mode Controls */}
      <div className="visualizer-mode-bar" role="toolbar" aria-label="Visualizer Animation Mode">
        <button
          type="button"
          className={`vis-mode-btn ${mode === 'cyber-bars' ? 'active' : ''}`}
          onClick={() => setMode('cyber-bars')}
          title="Cyber Spectrum Bars"
        >
          <Activity size={14} />
          <span>Spectrum</span>
        </button>
        <button
          type="button"
          className={`vis-mode-btn ${mode === 'radial-pulse' ? 'active' : ''}`}
          onClick={() => setMode('radial-pulse')}
          title="Radial Pulse Kaleidoscope"
        >
          <Radio size={14} />
          <span>Radial</span>
        </button>
        <button
          type="button"
          className={`vis-mode-btn ${mode === 'waveform' ? 'active' : ''}`}
          onClick={() => setMode('waveform')}
          title="Oscilloscope Wave Ribbon"
        >
          <Waves size={14} />
          <span>Waveform</span>
        </button>
      </div>
    </div>
  )
}

function drawCyberBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: Uint8Array,
  isPlaying: boolean,
  accentColor: string,
) {
  const barCount = 48
  const barWidth = width / barCount - 3
  const step = Math.floor(data.length / barCount)

  for (let i = 0; i < barCount; i++) {
    const val = data[i * step] || 0
    const percent = val / 255
    const barHeight = Math.max(4, percent * (height * 0.45))
    const x = i * (barWidth + 3) + 1.5
    const y = height - barHeight - 20

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, 0, height - 20)
    if (isPlaying) {
      grad.addColorStop(0, '#56d8ff')
      grad.addColorStop(0.4, accentColor)
      grad.addColorStop(1, 'rgba(53, 101, 237, 0.15)')
    } else {
      grad.addColorStop(0, 'rgba(120, 150, 170, 0.4)')
      grad.addColorStop(1, 'rgba(120, 150, 170, 0.05)')
    }

    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0])
    ctx.fill()

    // Glowing cap at the top of each bar
    if (isPlaying && barHeight > 10) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, y - 2, barWidth, 2)
      ctx.shadowColor = '#56d8ff'
      ctx.shadowBlur = 8
    }
  }
  ctx.shadowBlur = 0
}

function drawRadialPulse(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: Uint8Array,
  isPlaying: boolean,
  phase: number,
) {
  const cx = width / 2
  const cy = height / 2 - 10
  const baseRadius = Math.min(width, height) * 0.22
  const points = 64
  const step = Math.floor(data.length / points)

  // Outer glowing pulse ring
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(phase * 0.3)

  ctx.beginPath()
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2
    const val = data[i * step] || 0
    const intensity = (val / 255) * (isPlaying ? 45 : 8)
    const r = baseRadius + intensity
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()

  ctx.strokeStyle = isPlaying ? '#4facfe' : 'rgba(130, 160, 190, 0.3)'
  ctx.lineWidth = 2.5
  ctx.shadowColor = '#00f2fe'
  ctx.shadowBlur = isPlaying ? 16 : 4
  ctx.stroke()

  // Inner orbital ring
  ctx.beginPath()
  ctx.arc(0, 0, baseRadius * 0.72, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Floating constellation particles
  if (isPlaying) {
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2 + phase
      const dist = baseRadius * 1.35 + Math.sin(phase * 2 + j) * 15
      ctx.fillStyle = '#00f2fe'
      ctx.beginPath()
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: Uint8Array,
  isPlaying: boolean,
  phase: number,
) {
  const cy = height / 2 + 30
  const sliceWidth = width / data.length

  ctx.beginPath()
  ctx.moveTo(0, cy)

  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const wave = isPlaying ? Math.sin(i * 0.1 + phase) * 14 : 0
    const y = (v * (height * 0.28)) + cy - (height * 0.14) + wave
    const x = i * sliceWidth

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }

  ctx.lineTo(width, cy)
  ctx.strokeStyle = isPlaying ? '#38ef7d' : 'rgba(130, 160, 190, 0.4)'
  ctx.lineWidth = 3
  ctx.shadowColor = '#11998e'
  ctx.shadowBlur = isPlaying ? 15 : 0
  ctx.stroke()

  // Mirror ribbon wave
  ctx.beginPath()
  ctx.moveTo(0, cy)
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const wave = isPlaying ? Math.cos(i * 0.08 - phase) * 10 : 0
    const y = cy - ((v - 1) * (height * 0.18)) + wave
    const x = i * sliceWidth
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = isPlaying ? '#00f2fe' : 'rgba(100, 140, 170, 0.2)'
  ctx.lineWidth = 1.8
  ctx.shadowColor = '#00f2fe'
  ctx.shadowBlur = isPlaying ? 10 : 0
  ctx.stroke()
}
