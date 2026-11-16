import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { artFor } from '../lib/art'
import { play } from '../lib/audio'

// ---------- Button ----------
type Variant = 'primary' | 'metal' | 'ghost'
export function Button({
  variant = 'metal',
  className = '',
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary:
      'bg-gradient-to-b from-clash-400 to-clash-600 text-white shadow-[0_6px_24px_-6px_rgba(232,35,26,0.7)] hover:brightness-110',
    metal:
      'bg-gradient-to-b from-ink-600 to-ink-800 text-steel-100 ring-1 ring-inset ring-steel-400/30 hover:ring-steel-300/60',
    ghost: 'bg-transparent text-steel-200 hover:bg-white/5',
  }
  return (
    <button
      type="button"
      className={`cut inline-flex min-h-12 items-center justify-center gap-2 px-6 font-display text-base font-semibold tracking-wider uppercase transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      onClick={(e) => {
        play('select')
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------- Dialog (custom — never browser alert/confirm) ----------
export function Dialog({
  open,
  title,
  children,
  onClose,
  actions,
  wide = false,
}: {
  open: boolean
  title: string
  children?: ReactNode
  onClose?: () => void
  actions?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`cut max-h-[90dvh] w-full overflow-y-auto bg-gradient-to-b from-ink-700 to-ink-900 p-6 ring-1 ring-steel-400/25 outline-none ${wide ? 'max-w-2xl' : 'max-w-sm'}`}
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 font-display text-xl font-bold tracking-wide text-white uppercase">{title}</h2>
            {children && <div className="text-steel-200">{children}</div>}
            {actions && <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------- Player marker (shape + name, never color alone) ----------
export const SEAT_STYLE = [
  { shape: '◆', color: '#ff4a3d', label: 'Diamond' },
  { shape: '▲', color: '#d4d9df', label: 'Triangle' },
  { shape: '●', color: '#f5b70a', label: 'Circle' },
  { shape: '■', color: '#38bdf8', label: 'Square' },
]

export function Marker({ seat, className = '' }: { seat: number; className?: string }) {
  const s = SEAT_STYLE[seat]
  return (
    <span className={`inline-block leading-none ${className}`} style={{ color: s.color }} aria-hidden>
      {s.shape}
    </span>
  )
}

// ---------- Logo ----------
const logoArt = artFor('flip-clash-logo') ?? artFor('logo-from-back')
export function Logo({ className = '' }: { className?: string }) {
  if (logoArt) {
    return (
      <img
        src={logoArt}
        alt="Flip Clash"
        draggable={false}
        className={`select-none ${artFor('flip-clash-logo') ? '' : 'mix-blend-screen'} ${className}`}
        style={
          artFor('flip-clash-logo')
            ? undefined
            : {
                WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)',
                maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)',
              }
        }
      />
    )
  }
  return (
    <div className={`font-display leading-none font-bold italic ${className}`} aria-label="Flip Clash">
      <div className="metal-text text-6xl">FLIP</div>
      <div className="text-6xl text-clash-500">CLASH</div>
    </div>
  )
}

// ---------- Screen chrome ----------
const bgArt = artFor('background')
export function Backdrop({ dim = 0.55 }: { dim?: number }) {
  return (
    <div className="playmat pointer-events-none fixed inset-0 -z-10" aria-hidden>
      {bgArt && (
        <>
          <img src={bgArt} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `rgba(7,8,10,${dim})` }} />
        </>
      )}
    </div>
  )
}

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
      <button
        type="button"
        onClick={onBack}
        className="cut-sm grid h-11 w-11 place-items-center bg-ink-700/80 text-steel-100 ring-1 ring-steel-400/30 hover:ring-steel-300/60"
        aria-label="Back"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="font-display text-2xl font-bold tracking-wide text-white uppercase">{title}</h1>
    </header>
  )
}

export function Pips({ filled, total = 4, label }: { filled: number; total?: number; label?: string }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={label ?? `${filled} of ${total} prizes`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rotate-45 ${i < filled ? 'bg-clash-400 shadow-[0_0_6px_#ff4a3d]' : 'border border-steel-500/70'}`}
        />
      ))}
    </span>
  )
}
