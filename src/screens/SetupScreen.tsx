import { useState } from 'react'
import { createGame, randomSeed, RULES, type Difficulty, type GameState } from '../engine'
import { Backdrop, Button, Marker, ScreenHeader, SEAT_STYLE } from '../components/ui'
import { load, save } from '../lib/storage'

const NAMES_KEY = 'flipclash.names.v1'
const SEATS_KEY = 'flipclash.seats.v2'

type SeatKind = 'human' | Difficulty
const KINDS: { id: SeatKind; label: string }[] = [
  { id: 'human', label: 'Human' },
  { id: 'easy', label: 'CPU Easy' },
  { id: 'medium', label: 'CPU Med' },
  { id: 'hard', label: 'CPU Hard' },
]
const BOT_NAMES = ['Blaze', 'Nova', 'Bolt', 'Rio']

export function SetupScreen({
  mode,
  onBack,
  onStart,
}: {
  mode: 'local' | 'ai'
  onBack: () => void
  onStart: (g: GameState) => void
}) {
  const [count, setCount] = useState(2)
  const [names, setNames] = useState<string[]>(() => load(NAMES_KEY, ['', '', '', '']))
  const [kinds, setKinds] = useState<SeatKind[]>(() =>
    mode === 'ai'
      ? load<SeatKind[]>(SEATS_KEY, ['human', 'medium', 'medium', 'medium'])
      : ['human', 'human', 'human', 'human'],
  )
  const seats = kinds.slice(0, count)
  const humans = seats.filter((k) => k === 'human').length

  const setKind = (i: number, k: SeatKind) => setKinds((ks) => ks.map((x, j) => (j === i ? k : x)))

  const start = () => {
    save(NAMES_KEY, names)
    if (mode === 'ai') save(SEATS_KEY, kinds)
    onStart(
      createGame(
        seats.map((k, i) => ({
          name: k === 'human' ? names[i] : names[i].trim() || BOT_NAMES[i],
          bot: k === 'human' ? null : k,
        })),
        randomSeed(),
      ),
    )
  }

  return (
    <main className="min-h-dvh">
      <Backdrop />
      <ScreenHeader title={mode === 'ai' ? 'Vs computer' : 'Local game'} onBack={onBack} />
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
          {seats.map((kind, i) => (
            <div key={i} className="cut-sm bg-ink-800/90 px-4 py-3 ring-1 ring-steel-400/20">
              <label className="flex items-center gap-3">
                <Marker seat={i} className="text-xl" />
                <span className="sr-only">
                  Player {i + 1} name ({SEAT_STYLE[i].label})
                </span>
                <input
                  value={names[i]}
                  maxLength={14}
                  onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
                  placeholder={kind === 'human' ? `Player ${i + 1}` : BOT_NAMES[i]}
                  className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold text-white placeholder:text-steel-500 focus:outline-none"
                />
                {i === 0 && <span className="text-xs tracking-wider text-steel-400 uppercase">Goes first</span>}
              </label>
              {mode === 'ai' && (
                <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`Player ${i + 1} type`}>
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      role="radio"
                      aria-checked={kind === k.id}
                      onClick={() => setKind(i, k.id)}
                      className={`cut-sm min-h-10 px-1 font-display text-xs font-semibold tracking-wide uppercase transition ${
                        kind === k.id ? 'bg-clash-500 text-white' : 'bg-ink-700 text-steel-300'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-steel-300">
          {mode === 'ai'
            ? 'Easy plays at random. Medium uses its peeks — most of the time. Hard counts cards and plays to win, with the occasional slip. Computer players only know what their seat could know.'
            : 'Sit in turn order around the device. The deck is shuffled, 9 cards are dealt face down to each player, and everyone gets one secret look at 3 of their own cards.'}
        </p>

        {humans === 0 && <p className="mt-3 text-sm text-clash-400">At least one player needs to be human.</p>}

        <Button variant="primary" className="mt-6 w-full" disabled={humans === 0} onClick={start}>
          Deal the cards
        </Button>
      </div>
    </main>
  )
}
