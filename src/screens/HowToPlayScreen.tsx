import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cardId, POSITIONS, type Card, type Position } from '../engine'
import type { PlayerView, SlotView } from '../engine/view'
import { Board } from '../components/Board'
import { FlipCard } from '../components/FlipCard'
import { Backdrop, Button, ScreenHeader } from '../components/ui'

const c = (color: Card['color'], number: number): Card => ({ id: cardId(color, number), color, number })

function demo(opts: {
  up?: Partial<Record<Position, Card>>
  peek?: Position[]
  peekShow?: Partial<Record<Position, Card>>
  empty?: Position[]
  prizes?: Card[]
}): PlayerView {
  const slots: SlotView[] = POSITIONS.map((pos) => {
    const up = opts.up?.[pos]
    const show = opts.peekShow?.[pos]
    return {
      position: pos,
      card: up ?? show ?? null,
      empty: !!opts.empty?.includes(pos),
      faceUp: !!up,
      used: !!up,
      peekedByOwner: !!opts.peek?.includes(pos),
      peekVisible: !!show,
    }
  })
  return { id: 'demo', name: 'Demo', bot: null, seat: 0, slots, prizes: opts.prizes ?? [], playableCount: 0, peekDone: false, peekCount: 0 }
}

const STEPS = [
  {
    title: 'The board',
    body: 'Each player gets their own diamond. The deck (65 cards: red, blue, green, yellow and purple, 1–13) is shuffled and 9 cards are dealt face down to every player. The 4 dashed WIN spots around the middle card start empty — they hold the cards you win.',
    board: demo({}),
  },
  {
    title: 'Peek at 3',
    body: 'Before play starts, each player secretly looks at 3 of their own cards, then turns them back face down in the same spot. No more looking after that — you have to remember them!',
    board: demo({ peek: [2, 5, 9], peekShow: { 2: c('blue', 11), 5: c('green', 3), 9: c('red', 8) } }),
  },
  {
    title: 'Clash!',
    body: 'On your turn, pick an opponent (with 3–4 players). You each secretly choose one of your face-down cards, then both flip at once. Color doesn’t matter — the higher number wins.',
    clash: true,
  },
  {
    title: 'Get a win',
    body: 'The winner takes the loser’s card and puts it in one of their win spots. The winning card stays face up where it is and can never clash again. The loser’s spot stays empty. On a tie, nobody wins and both cards are used up.',
    board: demo({ up: { 1: c('yellow', 12), 5: c('purple', 6) }, empty: [7], prizes: [c('blue', 9), c('red', 4)] }),
  },
  {
    title: 'Winning',
    body: 'The first player to get 4 wins takes the game right away. If the cards run out first, the player with the most wins takes it — and if that’s tied, the highest total of the numbers they won. Turns pass clockwise; players with no face-down cards left are skipped.',
    board: demo({
      up: { 1: c('yellow', 12), 3: c('green', 10), 5: c('purple', 6), 8: c('red', 13) },
      empty: [4, 7],
      prizes: [c('blue', 9), c('red', 4), c('green', 7), c('purple', 2)],
    }),
  },
]

export function HowToPlayScreen({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  return (
    <main className="flex min-h-dvh flex-col">
      <Backdrop />
      <ScreenHeader title="How to play" onBack={onBack} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4" role="tablist">
        {STEPS.map((s, j) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === j}
            onClick={() => setI(j)}
            className={`cut-sm min-h-10 shrink-0 px-3 font-display text-sm font-semibold tracking-wide uppercase ${
              i === j ? 'bg-clash-500 text-white' : 'bg-ink-700/80 text-steel-300'
            }`}
          >
            {j + 1}. {s.title}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={i}
          role="tabpanel"
          className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-6 p-4 md:flex-row md:items-start"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="md:w-1/2">
            <h2 className="font-display text-3xl font-bold tracking-wide text-white uppercase">{step.title}</h2>
            <p className="mt-3 leading-relaxed text-steel-200">{step.body}</p>
          </div>
          <div className="w-full max-w-[320px] md:w-1/2">
            {step.clash ? <ClashDemo /> : <Board player={step.board!} showPeekMarks />}
          </div>
        </motion.section>
      </AnimatePresence>

      <div className="flex justify-between gap-3 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <Button disabled={i === 0} onClick={() => setI(i - 1)}>
          Back
        </Button>
        {i < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => setI(i + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={onBack}>
            {backLabel === 'playing' ? 'Let’s play!' : backLabel === 'joining' ? 'Join the game' : `Back to ${backLabel}`}
          </Button>
        )}
      </div>
    </main>
  )
}

function ClashDemo() {
  const [up, setUp] = useState(false)
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
        <FlipCard card={c('purple', 9)} faceUp={up} glow={up ? '#f5b70a' : null} />
        <span className="font-display text-3xl font-bold italic text-clash-500">VS</span>
        <FlipCard card={c('red', 5)} faceUp={up} dimmed={up} />
      </div>
      <p className="h-6 text-sm text-steel-300">{up ? '9 beats 5 — the 5 is captured!' : 'Both cards flip at the same time…'}</p>
      <Button variant="primary" onClick={() => setUp((u) => !u)}>
        {up ? 'Reset' : 'Flip!'}
      </Button>
    </div>
  )
}
