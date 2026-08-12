import { useEffect, useRef } from 'react'

export default function CcBackground({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let w = 0
    let h = 0
    let particles = []

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1)
      h = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1)
      const count = Math.min(70, Math.floor((w * h) / 26000))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: (Math.random() * 1.6 + 0.6) * (window.devicePixelRatio || 1),
        hue: Math.random() > 0.5 ? 255 : 185,
      }))
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.hue === 255 ? 'rgba(139, 92, 246, 0.28)' : 'rgba(6, 182, 212, 0.22)'
        ctx.fill()
      }
      // connect nearby particles
      const link = 130 * (window.devicePixelRatio || 1)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < link) {
            ctx.strokeStyle = `rgba(139, 92, 246, ${Math.max(0, 0.12 - dist / (link * 1.6))})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      if (!prefersReduced) raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const onVis = () => { if (!document.hidden && !prefersReduced) draw() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className={`cc-bg ${className}`} aria-hidden="true">
      <div className="cc-bg-blob cc-bg-blob-1" />
      <div className="cc-bg-blob cc-bg-blob-2" />
      <div className="cc-bg-blob cc-bg-blob-3" />
      <div className="cc-bg-grid" />
      <canvas ref={canvasRef} className="cc-bg-canvas" />
      <div className="cc-bg-vignette" />
    </div>
  )
}