import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
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
import { useFitWidth } from '../components/useFit'
import { useSettings } from '../lib/settings'
import { save } from '../lib/storage'
import { preloadCardArt } from '../lib/art'
import { Handoff } from './game/Handoff'
import { RevealStage } from './game/RevealStage'
import { Victory } from './game/Victory'

export const SAVE_KEY = 'flipclash.game.v1'

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
  const needsHandoff = !!decider && gateId !== decider.id
  const viewerId = decider && !needsHandoff && !hiding ? decider.id : null
  const view = useMemo(() => viewFor(state, viewerId), [state, viewerId])
  const publicView = useMemo(() => viewFor(state, null), [state])
  const me = decider ? view.players.find((p) => p.id === decider.id)! : null
  const active = state.players[state.activeIndex]
  const defender = state.defenderId ? state.players.find((p) => p.id === state.defenderId)! : null

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
        : 'Got them memorized? Hide your cards to continue.'
  } else if (state.phase === 'choose-opponent') {
    title = `${active.name}: who will you clash with?`
    hint = 'Pick an opponent who still has face-down cards.'
  } else if (state.phase === 'select-active') {
    title = `${active.name}: pick your card`
    hint = `Choose one face-down card to clash against ${defender?.name}.`
  } else if (state.phase === 'select-defender') {
    title = `${defender?.name}: defend!`
    hint = `${active.name} picked a card. Choose one of yours — both flip at once.`
  }

  const finishPeek = () => {
    setHiding(true)
    setTimeout(() => {
      dispatch({ type: 'FINISH_PEEK', playerId: decider!.id })
      setHiding(false)
    }, 650 * speed + 50)
  }

  const lockIn = () => {
    if (pick == null || !decider) return
    dispatch({ type: 'SELECT_CARD', playerId: decider.id, position: pick })
  }

  const restart = () => {
    const g = createGame(
      state.players.map((p) => ({ name: p.name })),
      randomSeed(),
    )
    setConfirm(null)
    setMenu(false)
    onRestart(g)
  }

  const showBoard =
    !needsHandoff && me && (state.phase === 'peek' || state.phase === 'select-active' || state.phase === 'select-defender')

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

      {!needsHandoff && state.phase === 'choose-opponent' && (
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
              <Button
                variant="primary"
                className="min-w-60"
                disabled={me.peekCount < RULES.peekCount || hiding}
                onClick={finishPeek}
              >
                Hide my cards
              </Button>
            ) : (
              <Button variant="primary" className="min-w-60" disabled={pick == null} onClick={lockIn}>
                {pick == null ? 'Tap a card' : state.phase === 'select-active' ? 'Lock in card' : 'Lock in & clash!'}
              </Button>
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
      aria-label={`${p.name}${active ? ', current turn' : ''}${defending ? ', defending' : ''}. ${p.prizes.length} of 4 prizes, ${p.playableCount} cards left. Show board.`}
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
            aria-label={`Clash with ${o.name}: ${o.prizes.length} prizes, ${o.playableCount} cards left`}
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
