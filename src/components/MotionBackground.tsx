import { useEffect, useRef } from 'react'

interface MotionBackgroundProps {
  intensity?: 'subtle' | 'vibrant'
  interactive?: boolean
}

interface Particle {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  alpha: number
  color: string
}

export function MotionBackground({ intensity = 'subtle', interactive = true }: MotionBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: Particle[] = []
    const particleCount = intensity === 'vibrant' ? 42 : 24
    const colors = ['rgba(53, 101, 237, ', 'rgba(86, 216, 255, ', 'rgba(112, 204, 192, ', 'rgba(168, 85, 247, ']

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2.5 + 1.2,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        alpha: Math.random() * 0.4 + 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      }
    }

    const handleMouseLeave = () => {
      mouseRef.current.active = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      // Connect near particles with delicate constellation lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 110) {
            const lineAlpha = (1 - dist / 110) * 0.18
            ctx.strokeStyle = `rgba(53, 101, 237, ${lineAlpha})`
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Update and draw each particle
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy

        // Wrap edges smoothly
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        // Gentle mouse interaction repulsion
        if (mouseRef.current.active) {
          const mdx = p.x - mouseRef.current.x
          const mdy = p.y - mouseRef.current.y
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
          if (mDist < 120 && mDist > 0) {
            const force = (120 - mDist) / 120
            p.x += (mdx / mDist) * force * 1.8
            p.y += (mdy / mDist) * force * 1.8
          }
        }

        ctx.fillStyle = `${p.color}${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [intensity, interactive])

  return <canvas ref={canvasRef} className="motion-background-canvas" />
}
