// Pieces of the game screen shared by local and online play.
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { RULES, type Position } from '../../engine'
import type { PlayerView } from '../../engine/view'
import { Board } from '../../components/Board'
import { Marker, Pips } from '../../components/ui'
import { FRAMED_RATIO, useFitWidth } from '../../components/useFit'

export function PlayerChip({
  p,
  active,
  defending,
  onClick,
  isYou = false,
}: {
  p: PlayerView
  active: boolean
  defending: boolean
  onClick: () => void
  isYou?: boolean
}) {
  return (
    <button
      type="button"
      role="listitem"
      onClick={onClick}
      aria-label={`${p.name}${p.bot ? ` (computer, ${p.bot})` : ''}${active ? ', current turn' : ''}${defending ? ', defending' : ''}. ${p.prizes.length} of 4 wins, ${p.playableCount} cards left. Show board.`}
      className={`cut-sm flex shrink-0 items-center gap-2 px-3 py-1.5 text-left transition ${
        active ? 'bg-clash-600/30 ring-1 ring-clash-400/80' : 'bg-ink-800/85 ring-1 ring-steel-400/20'
      }`}
    >
      <Marker seat={p.seat} className="text-base" />
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5 font-display text-sm leading-tight font-semibold text-white">
          {p.name}
          {active && <span className="text-[10px] tracking-widest text-clash-400 uppercase">Turn</span>}
          {defending && <span className="text-[10px] tracking-widest text-steel-300 uppercase">Def</span>}
          {p.bot && <span className="cut-sm bg-ink-600 px-1 text-[9px] tracking-widest text-steel-300 uppercase">CPU</span>}
          {isYou && <span className="cut-sm bg-clash-500 px-1 text-[9px] tracking-widest text-white uppercase">You</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <Pips filled={p.prizes.length} />
          <span className="text-[11px] text-steel-400">{p.playableCount} left</span>
        </span>
      </span>
    </button>
  )
}

export function Instructions({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-4 pt-1 pb-2 text-center">
      <h1 className="font-display text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">{title}</h1>
      <p className="mt-0.5 text-sm text-steel-300">{hint}</p>
    </div>
  )
}

export function PlayArea({
  title,
  hint,
  me,
  opponent,
  phase,
  pick,
  onSlot,
  action,
}: {
  title: string
  hint: string
  me: PlayerView
  opponent?: PlayerView
  phase: string
  pick: Position | null
  onSlot: (pos: Position) => void
  action: ReactNode
}) {
  const { ref, width } = useFitWidth<HTMLDivElement>(FRAMED_RATIO)
  return (
    <>
      <Instructions title={title} hint={hint} />
      <div className="flex min-h-0 flex-1 gap-6 px-3 lg:px-8">
        <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center">
          {width > 0 && (
            <div style={{ width }}>
              <Board
                owner="you"
                key={me.id}
                player={me}
                selected={pick}
                canSelect={(s) =>
                  phase === 'peek'
                    ? !s.peekVisible && me.peekCount < RULES.peekCount
                    : !s.empty && !s.faceUp && !s.used
                }
                onSelect={onSlot}
              />
            </div>
          )}
        </div>
        {opponent && (
          <aside className="hidden w-64 shrink-0 flex-col lg:flex" aria-label={`${opponent.name}'s board`}>
            <Board player={opponent} owner="name" />
          </aside>
        )}
      </div>
      <div className="flex justify-center px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">{action}</div>
    </>
  )
}

export function ChooseOpponent({
  title,
  hint,
  options,
  onChoose,
}: {
  title: string
  hint: string
  options: PlayerView[]
  onChoose: (id: string) => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto pb-6">
      <Instructions title={title} hint={hint} />
      <div className="mt-4 grid w-full max-w-3xl gap-4 px-4 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChoose(o.id)}
            className="cut group flex flex-col items-center gap-3 bg-gradient-to-b from-ink-700/90 to-ink-900/90 p-4 ring-1 ring-steel-400/25 transition hover:ring-clash-400/70"
            aria-label={`Clash with ${o.name}: ${o.prizes.length} wins, ${o.playableCount} cards left`}
          >
            <span className="flex items-center gap-2 font-display text-xl font-bold text-white">
              <Marker seat={o.seat} /> {o.name}
            </span>
            <div className="w-40">
              <Board player={o} />
            </div>
            <span className="flex items-center gap-3 text-sm text-steel-300">
              <Pips filled={o.prizes.length} /> {o.playableCount} cards left
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-11 w-full items-center justify-between gap-4 px-1 text-left"
    >
      <span className="font-display font-semibold tracking-wide text-steel-100">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-clash-500' : 'bg-ink-600'}`}>
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  )
}

export function BotThinking({
  name,
  seat,
  phase,
  board,
  against,
}: {
  name: string
  seat: number
  phase: string
  board: PlayerView
  against?: string
}) {
  const { ref, width } = useFitWidth<HTMLDivElement>(FRAMED_RATIO, 420)
  const what =
    phase === 'peek'
      ? `is peeking at ${RULES.peekCount} cards…`
      : phase === 'choose-opponent'
        ? 'is choosing who to clash with…'
        : phase === 'select-defender'
          ? `is picking a card to defend against ${against}…`
          : `is picking a card to clash with ${against}…`
  return (
    <>
      <div className="px-4 pt-1 pb-2 text-center" aria-live="polite">
        <h1 className="flex items-center justify-center gap-2 font-display text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">
          <Marker seat={seat} /> {name}
        </h1>
        <p className="mt-0.5 flex items-center justify-center gap-2 text-sm text-steel-300">
          {what}
          <span className="inline-flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-clash-400"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </span>
        </p>
      </div>
      <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center px-3 pb-6">
        {width > 0 && (
          <div style={{ width }} className="opacity-90">
            <Board player={board} owner="name" />
          </div>
        )}
      </div>
    </>
  )
}

/** Status line in place of a button when the next step is a tap on the board. */
export function ActionHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-center px-4 font-display text-sm font-semibold tracking-[0.2em] text-steel-300 uppercase" aria-live="polite">
      {children}
    </div>
  )
}
