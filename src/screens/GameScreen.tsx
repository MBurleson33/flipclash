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
import { Board } from '../components/Board'
import { Backdrop, Button, Dialog } from '../components/ui'
import { useSettings } from '../lib/settings'
import { load, save } from '../lib/storage'
import { botAct, type BotMemory } from '../ai/bot'
import { preloadCardArt } from '../lib/art'
import { Handoff } from './game/Handoff'
import { ActionHint, BotThinking, ChooseOpponent, PlayArea, PlayerChip, Toggle } from './game/parts'
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
        ? `Secretly look at ${RULES.peekCount - me.peekCount} more of your cards. Remember where your high numbers are!`
        : 'Remember them! They flip back over in a moment.'
  } else if (state.phase === 'choose-opponent') {
    title = `${active.name}: who will you clash with?`
    hint = 'Pick who to battle this turn.'
  } else if (state.phase === 'select-active') {
    title = `${active.name}: pick a card to battle with`
    hint = `Tap one of your face-down cards, then Lock in. ${defender?.name} picks one too, both flip, and the higher number wins the other card.`
  } else if (state.phase === 'select-defender') {
    title = `${defender?.name}: pick a card to battle with`
    hint = `${active.name} chose a card to battle you. Tap one of yours, then Lock in. Both flip, and the higher number wins the other card.`
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
            view={publicView}
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
        <Victory view={publicView} onPlayAgain={restart} onMenu={() => onExit(false)} />
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
            <Board player={publicView.players.find((p) => p.id === inspect)!} owner="name" />
            <p className="mt-3 text-center text-sm text-steel-400">
              Face-down cards stay hidden. Eye badges show the spots this player peeked at.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
