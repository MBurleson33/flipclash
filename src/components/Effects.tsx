// Premium visual effects: spark bursts, impact flash, light sweeps and rays.
// Everything here turns itself off for reduced motion and the "Subtle" animation setting.
import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useSettings } from '../lib/settings'

/** Should decorative effects run? */
export function useFx() {
  const { reduced, settings } = useSettings()
  return !reduced && settings.intensity === 'full'
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  streak: boolean
}

/**
 * A burst of glowing sparks drawn on a canvas that fills its parent.
 * Changing `fire` triggers a new burst. Origin is in 0..1 of the parent box.
 */
export function Sparks({
  fire,
  colors,
  count = 46,
  origin = { x: 0.5, y: 0.5 },
  power = 1,
  gravity = 0.18,
  rise = false,
}: {
  fire: number
  colors: string[]
  count?: number
  origin?: { x: number; y: number }
  power?: number
  gravity?: number
  /** Float upward (embers) instead of exploding outward. */
  rise?: boolean
}) {
  const fx = useFx()
  const ref = useRef<HTMLCanvasElement>(null)
  const parts = useRef<Particle[]>([])
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (!fx || !fire) return
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const ox = origin.x * width
    const oy = origin.y * height
    const scale = Math.min(width, height) / 320
    for (let i = 0; i < count; i++) {
      const a = rise ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2
      const sp = (rise ? 1.2 + Math.random() * 2.4 : 2.5 + Math.random() * 6.5) * power * scale
      const max = rise ? 50 + Math.random() * 40 : 28 + Math.random() * 30
      parts.current.push({
        x: ox + (rise ? (Math.random() - 0.5) * width * 0.5 : 0),
        y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: max,
        max,
        size: (rise ? 1.6 : 1.4 + Math.random() * 2.2) * Math.max(0.8, scale),
        color: colors[i % colors.length],
        streak: !rise && Math.random() < 0.6,
      })
    }

    const tick = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'
      const alive: Particle[] = []
      for (const p of parts.current) {
        p.life -= 1
        if (p.life <= 0) continue
        p.vx *= 0.955
        p.vy = p.vy * 0.955 + (rise ? -0.02 : gravity) * scale
        p.x += p.vx
        p.y += p.vy
        const t = p.life / p.max
        ctx.globalAlpha = Math.min(1, t * 1.4)
        ctx.strokeStyle = p.color
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 8
        if (p.streak) {
          ctx.lineWidth = p.size
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2)
          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (0.6 + t * 0.6), 0, Math.PI * 2)
          ctx.fill()
        }
        alive.push(p)
      }
      parts.current = alive
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      if (alive.length) raf.current = requestAnimationFrame(tick)
      else {
        ctx.clearRect(0, 0, width, height)
        raf.current = null
      }
    }
    if (raf.current == null) raf.current = requestAnimationFrame(tick)
  }, [fire]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    },
    [],
  )

  if (!fx) return null
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
}

/** A bright radial flash + expanding shock ring at the point of impact. */
export function ImpactFlash({ fire, color = '#ff4a3d' }: { fire: number; color?: string }) {
  const fx = useFx()
  if (!fx || !fire) return null
  return (
    <div key={fire} className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
      <motion.div
        className="absolute h-40 w-40 rounded-full"
        style={{ background: `radial-gradient(circle, #fff 0%, ${color}cc 30%, transparent 70%)` }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute h-24 w-24 rounded-full border-4"
        style={{ borderColor: '#fff' }}
        initial={{ scale: 0.3, opacity: 0.9 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

/** A diagonal band of light that sweeps across its (clipped) parent once per `play` change. */
export function Shine({ play, delay = 0, strength = 0.55 }: { play: number; delay?: number; strength?: number }) {
  const fx = useFx()
  if (!fx || !play) return null
  return (
    <div className="card-shape pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        key={play}
        className="absolute inset-y-[-20%] w-[45%] mix-blend-screen"
        style={{
          background: `linear-gradient(105deg, transparent 0%, rgba(255,255,255,${strength * 0.25}) 35%, rgba(255,255,255,${strength}) 50%, rgba(170,220,255,${strength * 0.35}) 62%, transparent 100%)`,
        }}
        initial={{ x: '-120%', rotate: 0 }}
        animate={{ x: '320%' }}
        transition={{ duration: 0.9, delay, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  )
}

/** Slowly turning light rays behind a hero element (victory, big wins). */
export function LightRays({ color = '#f5b70a', className = '' }: { color?: string; className?: string }) {
  const fx = useFx()
  if (!fx) return null
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <motion.div
      className={`pointer-events-none absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{
        background: `conic-gradient(from 0deg, ${rays.map((d) => `${color}22 ${d}deg, transparent ${d + 10}deg, transparent ${d + 30}deg`).join(', ')})`,
        WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 55%)',
        maskImage: 'radial-gradient(circle, #000 0%, transparent 55%)',
      }}
      initial={{ opacity: 0, rotate: 0 }}
      animate={{ opacity: 1, rotate: 360 }}
      transition={{ opacity: { duration: 0.8 }, rotate: { duration: 60, repeat: Infinity, ease: 'linear' } }}
      aria-hidden
    />
  )
}
