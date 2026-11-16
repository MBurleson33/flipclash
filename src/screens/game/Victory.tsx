import { useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import type { GameView } from '../../engine/view'
import { Backdrop, Button, Logo, Marker, Pips } from '../../components/ui'
import { useSettings } from '../../lib/settings'
import { play } from '../../lib/audio'

const BURST = ['#e8231a', '#1f7bff', '#22c55e', '#f5b70a', '#8b4dff', '#eef1f4']

export function Victory({
  view,
  onPlayAgain,
  onMenu,
}: {
  view: GameView
  /** Leave out to show a waiting note instead (online, when you're not the host). */
  onPlayAgain?: () => void
  onMenu: () => void
}) {
  const { reduced, settings } = useSettings()
  const result = view.result!
  const winners = result.winnerIds.map((id) => view.players.find((p) => p.id === id)!)
  const isDraw = winners.length > 1

  useEffect(() => {
    play('victory')
  }, [])

  const pieces = useMemo(
    () =>
      Array.from({ length: reduced || settings.intensity === 'subtle' ? 0 : 44 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 900,
        y: -200 - Math.random() * 400,
        r: Math.random() * 720 - 360,
        c: BURST[i % BURST.length],
        d: 0.1 + Math.random() * 0.4,
        w: 6 + Math.random() * 8,
      })),
    [reduced, settings.intensity],
  )

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={isDraw ? 'Draw' : `${winners[0].name} wins`}
    >
      <Backdrop dim={0.45} />
      <div className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden>
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            className="absolute block"
            style={{ width: p.w, height: p.w * 0.45, background: p.c, borderRadius: 2 }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: p.x, y: [0, p.y, p.y + 900], rotate: p.r, opacity: [1, 1, 0] }}
            transition={{ duration: 2.6, delay: p.d, ease: 'easeOut' }}
          />
        ))}
      </div>

      <Logo className="w-48 opacity-90" />
      <motion.div
        className="mt-4"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.2 }}
      >
        <p className="font-display text-sm font-semibold tracking-[0.3em] text-steel-400 uppercase">
          {isDraw ? "It's a draw" : 'Winner'}
        </p>
        <h2 className="mt-1 font-display text-5xl font-bold text-white sm:text-6xl">
          {winners.map((w) => (
            <span key={w.id} className="mx-2 inline-flex items-center gap-2">
              <Marker seat={w.seat} /> {w.name}
            </span>
          ))}
        </h2>
        <p className="mt-2 text-steel-300">
          {result.reason === 'four-prizes'
            ? 'Got all 4 wins!'
            : 'The cards ran out — most wins (then highest total) takes it.'}
        </p>
      </motion.div>

      <ol className="mt-6 w-full max-w-sm space-y-2 text-left" aria-label="Final standings">
        {result.standings.map((s, i) => {
          const p = view.players.find((x) => x.id === s.playerId)!
          return (
            <li key={s.playerId} className="cut-sm flex items-center gap-3 bg-ink-800/85 px-4 py-2.5 ring-1 ring-steel-400/20">
              <span className="w-5 font-display font-bold text-steel-400">{i + 1}</span>
              <Marker seat={p.seat} />
              <span className="flex-1 truncate font-display font-semibold text-white">{p.name}</span>
              <Pips filled={s.prizes} />
              <span className="w-14 text-right text-sm text-steel-300" aria-label={`total of won cards ${s.total}`}>
                Σ {s.total}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {onPlayAgain ? (
          <Button variant="primary" onClick={onPlayAgain} autoFocus>
            Play again
          </Button>
        ) : (
          <p className="flex min-h-12 items-center px-2 text-sm text-steel-300">Waiting for the host to start a rematch…</p>
        )}
        <Button onClick={onMenu}>Main menu</Button>
      </div>
    </motion.div>
  )
}
