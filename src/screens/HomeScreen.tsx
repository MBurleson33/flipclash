import { motion } from 'motion/react'
import type { Screen } from '../App'
import { Backdrop, Button, Logo } from '../components/ui'
import { CardBox, CardFront } from '../components/CardFace'

export function HomeScreen({
  hasSave,
  onNav,
  onResume,
}: {
  hasSave: boolean
  onNav: (s: Screen) => void
  onResume: () => void
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-10">
      <Backdrop dim={0.35} />

      {/* fanned cards behind the logo */}
      <div className="pointer-events-none relative mb-2 h-40 w-72 sm:h-48" aria-hidden>
        {[
          { r: -16, x: -70, c: { id: 'green-13', color: 'green', number: 13 } as const },
          { r: 0, x: 0, c: { id: 'red-13', color: 'red', number: 13 } as const },
          { r: 16, x: 70, c: { id: 'blue-13', color: 'blue', number: 13 } as const },
        ].map((f, i) => (
          <motion.div
            key={i}
            className="absolute top-0 left-1/2 w-24 sm:w-28"
            style={{ zIndex: i === 1 ? 2 : 1 }}
            initial={{ opacity: 0, y: 30, rotate: 0, x: '-50%' }}
            animate={{ opacity: 1, y: i === 1 ? -8 : 6, rotate: f.r, x: `calc(-50% + ${f.x}px)` }}
            transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 160, damping: 18 }}
          >
            <CardBox>
              <CardFront card={f.c} />
            </CardBox>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}>
        <Logo className="w-[min(78vw,420px)]" />
      </motion.div>

      <nav className="mt-8 flex w-full max-w-xs flex-col gap-3" aria-label="Main menu">
        {hasSave && (
          <Button variant="primary" onClick={onResume}>
            Resume game
          </Button>
        )}
        <Button variant={hasSave ? 'metal' : 'primary'} onClick={() => onNav('modes')}>
          Play game
        </Button>
        <Button onClick={() => onNav('how')}>How to play</Button>
        <Button onClick={() => onNav('gallery')}>Card gallery</Button>
        <Button onClick={() => onNav('settings')}>Settings</Button>
      </nav>
      <p className="mt-8 text-center text-xs tracking-wide text-steel-500">
        Created by Beckett &amp; Archer
      </p>
    </main>
  )
}
