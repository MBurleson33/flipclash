import { useState } from 'react'
import { createGame, randomSeed, RULES, type GameState } from '../engine'
import { Backdrop, Button, Marker, ScreenHeader, SEAT_STYLE } from '../components/ui'
import { load, save } from '../lib/storage'

const NAMES_KEY = 'flipclash.names.v1'

export function SetupScreen({ onBack, onStart }: { onBack: () => void; onStart: (g: GameState) => void }) {
  const [count, setCount] = useState(2)
  const [names, setNames] = useState<string[]>(() => load(NAMES_KEY, ['', '', '', '']))

  const start = () => {
    save(NAMES_KEY, names)
    onStart(createGame(names.slice(0, count).map((name) => ({ name })), randomSeed()))
  }

  return (
    <main className="min-h-dvh">
      <Backdrop />
      <ScreenHeader title="Local game" onBack={onBack} />
      <div className="mx-auto max-w-md p-4">
        <h2 className="mb-2 font-display text-sm font-semibold tracking-widest text-steel-300 uppercase" id="pc">
          Players
        </h2>
        <div className="mb-6 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="pc">
          {Array.from({ length: RULES.maxPlayers - RULES.minPlayers + 1 }, (_, i) => i + RULES.minPlayers).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={count === n}
              onClick={() => setCount(n)}
              className={`cut-sm min-h-12 font-display text-lg font-bold transition ${
                count === n
                  ? 'bg-clash-500 text-white'
                  : 'bg-ink-700/80 text-steel-200 ring-1 ring-inset ring-steel-400/25 hover:ring-steel-300/60'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {Array.from({ length: count }, (_, i) => (
            <label key={i} className="cut-sm flex items-center gap-3 bg-ink-800/90 px-4 py-3 ring-1 ring-steel-400/20">
              <Marker seat={i} className="text-xl" />
              <span className="sr-only">
                Player {i + 1} name ({SEAT_STYLE[i].label})
              </span>
              <input
                value={names[i]}
                maxLength={14}
                onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
                placeholder={`Player ${i + 1}`}
                className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold text-white placeholder:text-steel-500 focus:outline-none"
              />
              {i === 0 && <span className="text-xs tracking-wider text-steel-400 uppercase">Goes first</span>}
            </label>
          ))}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-steel-300">
          Sit in turn order around the device. The deck is shuffled, 9 cards are dealt face down to each
          player, and everyone gets one secret look at 3 of their own cards.
        </p>

        <Button variant="primary" className="mt-6 w-full" onClick={start}>
          Deal the cards
        </Button>
      </div>
    </main>
  )
}
