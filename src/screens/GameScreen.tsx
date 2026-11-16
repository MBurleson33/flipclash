import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  applyAction,
  createGame,
  currentDecider,
  eligibleOpponents,
  randomSeed,
  RULES,
  viewFor,
  type Action,
  type GameState,
  type Position,
} from '../engine'
import type { PlayerView } from '../engine/view'
import { Board } from '../components/Board'
import { Backdrop, Button, Dialog, Marker, Pips } from '../components/ui'
import { BOARD_RATIO, useFitWidth } from '../components/useFit'
import { useSettings } from '../lib/settings'
import { load, save } from '../lib/storage'
import { botAct, type BotMemory } from '../ai/bot'
import { preloadCardArt } from '../lib/art'
import { Handoff } from './game/Handoff'
import { RevealStage } from './game/RevealStage'
import { Victory } from './game/Victory'

export const SAVE_KEY = 'flipclash.game.v1'
const PEEK_SECONDS = 5
const BOT_MEM_KEY = 'flipclash.botmem.v1'

interface Props {
  initial: GameState
  onExit: (keepSave: boolean) => void
  onRestart: (g: GameState) => void
  onHowToPlay: () => void
  onSaved: (g: GameState) => void
}

export function GameScreen({ initial, onExit, onRestart, onHowToPlay, onSaved }: Props) {
  const [state, setState] = useState(initial)
  const [gateId, setGateId] = useState<string | null>(null) // who confirmed the handoff
  const [pick, setPick] = useState<Position | null>(null)
  const [hiding, setHiding] = useState(false)
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState<null | 'restart' | 'quit'>(null)
  const [inspect, setInspect] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const { speed, settings, update } = useSettings()

  useEffect(preloadCardArt, [])

  // Each computer player's private memory of the cards it peeked at (kept across resume).
  const botMemory = useRef<Record<string, BotMemory>>(
    (() => {
      const saved = load<{ seed: number; mem: Record<string, BotMemory> } | null>(BOT_MEM_KEY, null)
      return saved && saved.seed === initial.seed ? saved.mem : {}
    })(),
  )

  const dispatch = useCallback(
    (action: Action) => {
      setState((s) => {
        const r = applyAction(s, action)
        if (!r.ok) {
          setAnnounce(r.error)
          return s
        }
        return r.state
      })
    },
    [setState],
  )

  useEffect(() => {
    save(SAVE_KEY, state)
    onSaved(state)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const decider = currentDecider(state)
  const humanCount = state.players.filter((p) => !p.bot).length
  const botTurn = !!decider?.bot
  // Only pass the device around when more than one human is playing.
  const needsHandoff = !!decider && !botTurn && humanCount > 1 && gateId !== decider.id
  const viewerId = decider && !botTurn && !needsHandoff && !hiding ? decider.id : null
  const view = useMemo(() => viewFor(state, viewerId), [state, viewerId])
  const publicView = useMemo(() => viewFor(state, null), [state])
  const me = decider ? view.players.find((p) => p.id === decider.id)! : null
  const active = state.players[state.activeIndex]
  const defender = state.defenderId ? state.players.find((p) => p.id === state.defenderId)! : null

  // Computer turns: think for a moment, then act from the bot's own player view.
  useEffect(() => {
    if (!decider?.bot) return
    const base = state.phase === 'peek' ? 420 : state.phase === 'choose-opponent' ? 750 : 950
    const t = setTimeout(
      () => {
        const turn = botAct(state, decider.id, decider.bot!, botMemory.current[decider.id] ?? {})
        if (!turn) return
        botMemory.current = { ...botMemory.current, [decider.id]: turn.memory }
        save(BOT_MEM_KEY, { seed: state.seed, mem: botMemory.current })
        if (turn.action.type === 'CHOOSE_OPPONENT') {
          const opp = state.players.find((p) => p.id === (turn.action as { opponentId: string }).opponentId)
          setAnnounce(`${decider.name} challenges ${opp?.name}.`)
        }
        dispatch(turn.action)
      },
      Math.max(120, base * speed),
    )
    return () => clearTimeout(t)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the local pick when the decision changes hands.
  useEffect(() => setPick(null), [state.phase, decider?.id])

  const handoffMessage = () => {
    switch (state.phase) {
      case 'peek':
        return `Secretly look at ${RULES.peekCount} of your face-down cards. After that you'll have to remember them!`
      case 'choose-opponent':
      case 'select-active':
        return "It's your turn to start a clash."
      case 'select-defender':
        return `${active.name} has challenged you! Pick a card to clash with.`
      default:
        return ''
    }
  }

  // ---------- instruction text ----------
  let title = ''
  let hint = ''
  if (state.phase === 'peek' && me) {
    title = `${me.name}: peek at ${RULES.peekCount} cards`
    hint =
      me.peekCount < RULES.peekCount
        ? `Tap ${RULES.peekCount - me.peekCount} more card${RULES.peekCount - me.peekCount > 1 ? 's' : ''} to look. Memorize them!`
        : 'Memorize them! They flip back over in a moment.'
  } else if (state.phase === 'choose-opponent') {
    title = `${active.name}: who will you clash with?`
    hint = 'Pick an opponent who still has face-down cards.'
  } else if (state.phase === 'select-active') {
    title = `${active.name}: pick your card`
    hint = `Pick one of your face-down cards to clash against ${defender?.name}, then lock it in.`
  } else if (state.phase === 'select-defender') {
    title = `${defender?.name}: defend!`
    hint = `${active.name} picked a card. Pick one of yours and lock it in — both flip at once.`
  }

  const finishPeek = () => {
    if (hiding || !decider) return
    const id = decider.id
    setHiding(true)
    setTimeout(() => {
      dispatch({ type: 'FINISH_PEEK', playerId: id })
      setHiding(false)
    }, 650 * speed + 50)
  }

  // After the 3rd peek, cards hide themselves after a short countdown (or tap to hide sooner).
  const [peekLeft, setPeekLeft] = useState<number | null>(null)
  const peekReady = state.phase === 'peek' && !!me && viewerId === me.id && me.peekCount >= RULES.peekCount && !hiding
  useEffect(() => {
    if (!peekReady) {
      setPeekLeft(null)
      return
    }
    setPeekLeft(PEEK_SECONDS)
    const iv = setInterval(() => setPeekLeft((n) => (n == null ? n : n - 1)), 1000)
    return () => clearInterval(iv)
  }, [peekReady, decider?.id])
  useEffect(() => {
    if (peekLeft === 0) finishPeek()
  }, [peekLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  const lockIn = () => {
    if (pick == null || !decider) return
    dispatch({ type: 'SELECT_CARD', playerId: decider.id, position: pick })
  }

  const restart = () => {
    const g = createGame(
      state.players.map((p) => ({ name: p.name, bot: p.bot })),
      randomSeed(),
    )
    setConfirm(null)
    setMenu(false)
    onRestart(g)
  }

  const showBoard =
    !needsHandoff && !botTurn && me && (state.phase === 'peek' || state.phase === 'select-active' || state.phase === 'select-defender')

  return (
    <div className="fixed inset-0 flex touch-manipulation flex-col overflow-hidden select-none">
      <Backdrop dim={0.62} />
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {/* ---------- top bar ---------- */}
      <header className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <button
          type="button"
          onClick={() => setMenu(true)}
          className="cut-sm grid h-11 w-11 shrink-0 place-items-center bg-ink-700/85 ring-1 ring-steel-400/30 hover:ring-steel-300/60"
          aria-label="Pause menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 7h14M5 12h14M5 17h14" />
          </svg>
        </button>
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto" role="list" aria-label="Players">
          {publicView.players.map((p) => (
            <PlayerChip
              key={p.id}
              p={p}
              active={state.phase !== 'peek' && state.phase !== 'finished' && p.id === active.id}
              defending={state.phase !== 'peek' && p.id === state.defenderId}
              onClick={() => setInspect(p.id)}
            />
          ))}
        </div>
      </header>

      {/* ---------- main ---------- */}
      {state.phase === 'reveal' && (
        <>
          <div className="px-4 pt-2 pb-1 text-center font-display text-sm font-semibold tracking-[0.25em] text-steel-400 uppercase">
            Turn {state.turn} · Everyone look!
          </div>
          <RevealStage
            key={state.history.length}
            state={state}
            onAnnounce={setAnnounce}
            onNext={() => {
              setGateId(null)
              dispatch({ type: 'NEXT_TURN' })
            }}
          />
        </>
      )}

      {botTurn && decider && (
        <BotThinking
          name={decider.name}
          seat={decider.seat}
          phase={state.phase}
          board={publicView.players.find((p) => p.id === decider.id)!}
          against={
            state.phase === 'select-defender'
              ? active.name
              : state.phase === 'select-active'
                ? defender?.name
                : undefined
          }
        />
      )}

      {!needsHandoff && !botTurn && state.phase === 'choose-opponent' && (
        <ChooseOpponent
          title={title}
          hint={hint}
          options={eligibleOpponents(state, active.id).map((o) => publicView.players.find((p) => p.id === o.id)!)}
          onChoose={(id) => dispatch({ type: 'CHOOSE_OPPONENT', playerId: active.id, opponentId: id })}
        />
      )}

      {showBoard && me && (
        <PlayArea
          title={title}
          hint={hint}
          me={me}
          opponent={
            state.phase === 'select-active'
              ? publicView.players.find((p) => p.id === state.defenderId)
              : state.phase === 'select-defender'
                ? publicView.players.find((p) => p.id === active.id)
                : undefined
          }
          phase={state.phase}
          pick={pick}
          onSlot={(pos) => {
            if (state.phase === 'peek') {
              dispatch({ type: 'PEEK_CARD', playerId: me.id, position: pos })
            } else {
              setPick((cur) => (cur === pos ? null : pos))
            }
          }}
          action={
            state.phase === 'peek' ? (
              me.peekCount >= RULES.peekCount ? (
                <Button variant="primary" className="min-w-60" disabled={hiding} onClick={finishPeek}>
                  {hiding ? 'Hiding…' : `Hide now${peekLeft ? ` · ${peekLeft}` : ''}`}
                </Button>
              ) : (
                <ActionHint>
                  {`Tap a card to peek · ${me.peekCount} of ${RULES.peekCount}`}
                </ActionHint>
              )
            ) : (
              pick == null ? (
                <ActionHint>Tap a card to pick it</ActionHint>
              ) : (
                <motion.div
                  className="relative"
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                >
                  <motion.span
                    className="pointer-events-none absolute -inset-2 rounded-lg bg-clash-500/40 blur-md"
                    animate={{ opacity: [0.25, 0.9, 0.25] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden
                  />
                  <Button variant="primary" className="relative min-w-60" onClick={lockIn}>
                    {state.phase === 'select-active' ? 'Lock in card' : 'Lock in & clash!'}
                  </Button>
                </motion.div>
              )
            )
          }
        />
      )}

      <AnimatePresence>
        {needsHandoff && decider && (
          <Handoff
            key={`${decider.id}-${state.phase}`}
            name={decider.name}
            seat={decider.seat}
            message={handoffMessage()}
            onReady={() => {
              setGateId(decider.id)
              setAnnounce(`${decider.name}'s turn. ${handoffMessage()}`)
            }}
          />
        )}
      </AnimatePresence>

      {state.phase === 'finished' && (
        <Victory state={state} onPlayAgain={restart} onMenu={() => onExit(false)} />
      )}

      {/* ---------- pause menu ---------- */}
      <Dialog open={menu && !confirm} title="Paused" onClose={() => setMenu(false)}>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={() => setMenu(false)}>
            Resume
          </Button>
          <Button onClick={onHowToPlay}>How to play</Button>
          <div className="cut-sm flex flex-col gap-2 bg-ink-900/70 p-3">
            <Toggle label="Sound" on={settings.sound} onChange={(v) => update({ sound: v })} />
            <Toggle label="Reduced motion" on={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
          </div>
          <Button onClick={() => setConfirm('restart')}>Restart game</Button>
          <Button onClick={() => setConfirm('quit')}>Main menu</Button>
        </div>
      </Dialog>

      <Dialog
        open={confirm === 'restart'}
        title="Restart game?"
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={restart}>
              Restart
            </Button>
          </>
        }
      >
        The deck will be reshuffled and dealt again with the same players.
      </Dialog>

      <Dialog
        open={confirm === 'quit'}
        title="Leave the game?"
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => onExit(true)}>
              Leave
            </Button>
          </>
        }
      >
        Your game is saved — choose Resume game on the main menu to pick up where you left off.
      </Dialog>

      {/* ---------- inspect a board (public info only) ---------- */}
      <Dialog
        open={!!inspect}
        wide
        title={`${publicView.players.find((p) => p.id === inspect)?.name ?? ''}'s board`}
        onClose={() => setInspect(null)}
        actions={
          <Button variant="primary" onClick={() => setInspect(null)}>
            Close
          </Button>
        }
      >
        {inspect && (
          <div className="mx-auto max-w-[340px]">
            <Board player={publicView.players.find((p) => p.id === inspect)!} />
            <p className="mt-3 text-center text-sm text-steel-400">
              Face-down cards stay hidden. Eye badges show the spots this player peeked at.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}

// ---------- pieces ----------

function PlayerChip({
  p,
  active,
  defending,
  onClick,
}: {
  p: PlayerView
  active: boolean
  defending: boolean
  onClick: () => void
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
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <Pips filled={p.prizes.length} />
          <span className="text-[11px] text-steel-400">{p.playableCount} left</span>
        </span>
      </span>
    </button>
  )
}

function Instructions({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-4 pt-1 pb-2 text-center">
      <h1 className="font-display text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">{title}</h1>
      <p className="mt-0.5 text-sm text-steel-300">{hint}</p>
    </div>
  )
}

function PlayArea({
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
  action: React.ReactNode
}) {
  const { ref, width } = useFitWidth<HTMLDivElement>()
  return (
    <>
      <Instructions title={title} hint={hint} />
      <div className="flex min-h-0 flex-1 gap-6 px-3 lg:px-8">
        <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center">
          {width > 0 && (
            <div style={{ width }}>
              <Board
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
            <div className="mb-2 flex items-center gap-2 font-display text-sm font-semibold tracking-widest text-steel-300 uppercase">
              <Marker seat={opponent.seat} /> {opponent.name}
              <Pips filled={opponent.prizes.length} />
            </div>
            <Board player={opponent} />
          </aside>
        )}
      </div>
      <div className="flex justify-center px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">{action}</div>
    </>
  )
}

function ChooseOpponent({
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

function BotThinking({
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
  const { ref, width } = useFitWidth<HTMLDivElement>(BOARD_RATIO, 420)
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
            <Board player={board} />
          </div>
        )}
      </div>
    </>
  )
}

/** Status line in place of a button when the next step is a tap on the board. */
function ActionHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-center px-4 font-display text-sm font-semibold tracking-[0.2em] text-steel-300 uppercase" aria-live="polite">
      {children}
    </div>
  )
}
