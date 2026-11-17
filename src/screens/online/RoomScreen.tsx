import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RULES, type Action, type Position } from '../../engine'
import type { GameView, PlayerView } from '../../engine/view'
import { Board } from '../../components/Board'
import { Backdrop, Button, Dialog, Marker, ScreenHeader, SEAT_STYLE } from '../../components/ui'
import { FRAMED_RATIO, useFitWidth } from '../../components/useFit'
import { preloadCardArt } from '../../lib/art'
import { useSettings } from '../../lib/settings'
import type { RoomSnapshot, SeatKind } from '../../online/protocol'
import { useRoom } from '../../online/useRoom'
import { lastRoom } from '../../online/lastRoom'
import { RevealStage } from '../game/RevealStage'
import { Victory } from '../game/Victory'
import { ActionHint, ChooseOpponent, Instructions, PlayArea, PlayerChip, Toggle } from '../game/parts'

const PEEK_SECONDS = 5

export function RoomScreen({ code, name, onExit }: { code: string; name: string; onExit: (message?: string) => void }) {
  const { room, conn, error, fatal, send, clearError } = useRoom(code, name)

  useEffect(() => {
    lastRoom.set(code, name)
  }, [code, name])

  useEffect(() => {
    if (fatal) {
      lastRoom.clear()
      onExit(fatal)
    }
  }, [fatal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 3500)
    return () => clearTimeout(t)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => {
    send({ t: 'leave' })
    lastRoom.clear()
    onExit()
  }

  return (
    <>
      {!room ? (
        <main className="grid min-h-dvh place-items-center">
          <Backdrop />
          <p className="font-display tracking-widest text-steel-300 uppercase">
            {conn === 'reconnecting' ? 'Can’t reach the server — retrying…' : 'Joining room…'}
          </p>
        </main>
      ) : room.started && room.view ? (
        <OnlineGame room={room} view={room.view} send={send} onLeave={leave} />
      ) : (
        <Lobby room={room} send={send} onLeave={leave} />
      )}

      <AnimatePresence>
        {conn === 'reconnecting' && room && (
          <Toast key="re" tone="warn">
            Connection lost — reconnecting…
          </Toast>
        )}
        {error && conn === 'open' && <Toast key={error}>{error}</Toast>}
      </AnimatePresence>
    </>
  )
}

// ======================= lobby =======================

const KIND_LABEL: Record<SeatKind, string> = { human: 'Player', easy: 'CPU Easy', medium: 'CPU Med', hard: 'CPU Hard' }

function Lobby({ room, send, onLeave }: { room: RoomSnapshot; send: ReturnType<typeof useRoom>['send']; onLeave: () => void }) {
  const isHost = room.you.isHost
  const kinds = room.seats.map((s) => s.kind)
  const openSeats = room.seats.filter((s) => s.open).length
  const [copied, setCopied] = useState(false)
  const link = `${location.origin}${location.pathname}?room=${room.code}`

  const setCount = (n: number) => {
    const next = Array.from({ length: n }, (_, i) => kinds[i] ?? 'human') as SeatKind[]
    send({ t: 'setup', seats: next })
  }
  const setKind = (i: number, k: SeatKind) => send({ t: 'setup', seats: kinds.map((x, j) => (j === i ? k : x)) })

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FLIP CLASH', text: `Join my Flip Clash game! Code: ${room.code}`, url: link })
        return
      }
    } catch {
      return // share sheet dismissed
    }
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the code is on screen */
    }
  }

  return (
    <main className="min-h-dvh pb-10">
      <Backdrop />
      <ScreenHeader title="Game room" onBack={onLeave} />
      <div className="mx-auto max-w-md p-4">
        <div className="cut bg-gradient-to-b from-ink-700/95 to-ink-900/95 p-5 text-center ring-1 ring-steel-400/25">
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-steel-400 uppercase">Room code</p>
          <p className="mt-1 font-display text-6xl font-bold tracking-[0.25em] text-white" aria-label={`Room code ${room.code.split('').join(' ')}`}>
            {room.code}
          </p>
          <p className="mt-2 text-sm text-steel-300">Friends open Flip Clash → Play → Online → Join, and type this code.</p>
          <Button className="mt-4 w-full" onClick={share}>
            {copied ? 'Link copied!' : 'Share invite link'}
          </Button>
        </div>

        <h2 className="mt-6 mb-2 font-display text-sm font-semibold tracking-widest text-steel-300 uppercase">Players</h2>
        {isHost && (
          <div className="mb-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Number of players">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={room.seats.length === n}
                onClick={() => setCount(n)}
                className={`cut-sm min-h-12 font-display text-lg font-bold ${
                  room.seats.length === n ? 'bg-clash-500 text-white' : 'bg-ink-700/80 text-steel-200 ring-1 ring-inset ring-steel-400/25'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {room.seats.map((s, i) => {
            const isYou = room.you.seat === i
            return (
              <li key={i} className="cut-sm bg-ink-800/90 px-4 py-3 ring-1 ring-steel-400/20">
                <div className="flex items-center gap-3">
                  <Marker seat={i} className="text-xl" />
                  <span className={`flex-1 truncate font-display text-lg font-semibold ${s.open ? 'text-steel-500' : 'text-white'}`}>
                    {s.open ? 'Waiting for a player…' : s.name}
                    {isYou && <span className="ml-2 text-xs tracking-widest text-clash-400 uppercase">You</span>}
                  </span>
                  {s.kind === 'human' && !s.open && (
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${s.connected ? 'bg-[#22c55e]' : 'bg-steel-500'}`}
                      role="img"
                      aria-label={s.connected ? 'connected' : 'not connected'}
                    />
                  )}
                  {s.kind !== 'human' && <span className="text-xs tracking-widest text-steel-400 uppercase">{KIND_LABEL[s.kind]}</span>}
                </div>
                {isHost && !isYou && (
                  <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`Seat ${i + 1} (${SEAT_STYLE[i].label}) type`}>
                    {(['human', 'easy', 'medium', 'hard'] as SeatKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={s.kind === k}
                        onClick={() => setKind(i, k)}
                        className={`cut-sm min-h-10 px-1 font-display text-xs font-semibold tracking-wide uppercase ${
                          s.kind === k ? 'bg-clash-500 text-white' : 'bg-ink-700 text-steel-300'
                        }`}
                      >
                        {KIND_LABEL[k]}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {isHost ? (
          <>
            <Button variant="primary" className="mt-6 w-full" disabled={openSeats > 0} onClick={() => send({ t: 'start' })}>
              {openSeats > 0 ? `Waiting for ${openSeats} more player${openSeats > 1 ? 's' : ''}` : 'Deal the cards'}
            </Button>
            {openSeats > 0 && (
              <p className="mt-2 text-center text-sm text-steel-400">Or switch an empty seat to a computer player.</p>
            )}
          </>
        ) : (
          <p className="mt-6 text-center font-display tracking-widest text-steel-300 uppercase">
            {room.you.seat === null ? 'The table is full — you’ll be watching' : 'Waiting for the host to start…'}
          </p>
        )}
      </div>
    </main>
  )
}

// ======================= game =======================

function OnlineGame({
  room,
  view,
  send,
  onLeave,
}: {
  room: RoomSnapshot
  view: GameView
  send: ReturnType<typeof useRoom>['send']
  onLeave: () => void
}) {
  const { settings, update } = useSettings()
  const [menu, setMenu] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [inspect, setInspect] = useState<string | null>(null)
  const [pick, setPick] = useState<Position | null>(null)
  const meId = room.you.playerId
  const me = meId ? view.players.find((p) => p.id === meId) ?? null : null
  const active = view.players.find((p) => p.id === view.activeId)!
  const defender = view.defenderId ? view.players.find((p) => p.id === view.defenderId) ?? null : null

  useEffect(preloadCardArt, [])
  useEffect(() => setPick(null), [view.phase, view.turn])

  const act = (action: Action) => send({ t: 'act', action })

  // ----- peek countdown -----
  const peeking = view.phase === 'peek' && !!me && !me.peekDone
  const peekReady = peeking && me!.peekCount >= RULES.peekCount
  const [peekLeft, setPeekLeft] = useState<number | null>(null)
  const sentFinish = useRef(false)
  useEffect(() => {
    sentFinish.current = false
    if (!peekReady) {
      setPeekLeft(null)
      return
    }
    setPeekLeft(PEEK_SECONDS)
    const iv = setInterval(() => setPeekLeft((n) => (n == null ? n : n - 1)), 1000)
    return () => clearInterval(iv)
  }, [peekReady])
  const finishPeek = () => {
    if (sentFinish.current || !meId) return
    sentFinish.current = true
    act({ type: 'FINISH_PEEK', playerId: meId })
  }
  useEffect(() => {
    if (peekLeft === 0) finishPeek()
  }, [peekLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // ----- whose move is it? -----
  const myPickTurn =
    !!me &&
    view.myPick === null &&
    ((view.phase === 'select-active' && (view.activeId === meId || view.defenderId === meId)) ||
      (view.phase === 'select-defender' && view.defenderId === meId))
  const iAmAttacker = view.activeId === meId
  const opponentForMe = iAmAttacker ? defender : active

  const seatConnected = (p: PlayerView) => (p.bot ? true : room.seats[p.seat]?.connected ?? false)
  const waitingOn = useMemo(() => {
    const ids: string[] = []
    if (view.phase === 'peek') view.players.filter((p) => !p.peekDone).forEach((p) => ids.push(p.id))
    else if (view.phase === 'choose-opponent') ids.push(view.activeId)
    else if (view.phase === 'select-active') {
      ids.push(view.activeId)
      if (view.defenderId && !view.defenderHasPicked) ids.push(view.defenderId)
    } else if (view.phase === 'select-defender' && view.defenderId) ids.push(view.defenderId)
    return ids.map((id) => view.players.find((p) => p.id === id)!).filter((p) => p.id !== meId)
  }, [view, meId])
  const offline = view.players.filter((p) => p.id !== meId && !seatConnected(p))
  const neededOffline = waitingOn.filter((p) => !seatConnected(p))

  // ----- what to show -----
  let content: React.ReactNode = null
  if (view.phase === 'reveal' && view.lastClash) {
    content = (
      <>
        <div className="px-4 pt-2 pb-1 text-center font-display text-sm font-semibold tracking-[0.25em] text-steel-400 uppercase">
          Turn {view.turn}
        </div>
        <RevealStage key={`${view.turn}-${view.lastClash.attackerCardId}`} view={view} viewerId={meId} onAnnounce={() => {}} onNext={() => send({ t: 'next' })} />
      </>
    )
  } else if (peeking && me) {
    content = (
      <PlayArea
        title="Peek at 3 cards"
        hint={me.peekCount < RULES.peekCount ? 'Tap your cards to look. Memorize them!' : 'Memorize them! They flip back over in a moment.'}
        me={me}
        phase="peek"
        pick={null}
        onSlot={(pos) => act({ type: 'PEEK_CARD', playerId: meId!, position: pos })}
        action={
          peekReady ? (
            <Button variant="primary" className="min-w-60" onClick={finishPeek}>
              {`Hide now${peekLeft ? ` · ${peekLeft}` : ''}`}
            </Button>
          ) : (
            <ActionHint>{`Tap a card to peek · ${me.peekCount} of ${RULES.peekCount}`}</ActionHint>
          )
        }
      />
    )
  } else if (view.phase === 'choose-opponent' && iAmAttacker && me) {
    content = (
      <ChooseOpponent
        title="Your turn: who will you clash with?"
        hint="Pick an opponent who still has face-down cards."
        options={view.players.filter((p) => p.id !== meId && p.playableCount > 0)}
        onChoose={(id) => act({ type: 'CHOOSE_OPPONENT', playerId: meId!, opponentId: id })}
      />
    )
  } else if (myPickTurn && me) {
    content = (
      <PlayArea
        title={iAmAttacker ? 'Your turn: pick your card' : `${active.name} challenged you!`}
        hint={
          iAmAttacker
            ? `Pick a face-down card to clash with ${defender?.name}, then lock it in.${view.defenderHasPicked ? ` ${defender?.name} is locked in.` : ''}`
            : `Pick a card to defend with and lock it in — both flip at once.${view.activeHasPicked ? ` ${active.name} is locked in.` : ''}`
        }
        me={me}
        opponent={opponentForMe ?? undefined}
        phase={view.phase}
        pick={pick}
        onSlot={(pos) => setPick((cur) => (cur === pos ? null : pos))}
        action={
          pick == null ? (
            <ActionHint>Tap a card to pick it</ActionHint>
          ) : (
            <motion.div className="relative" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.18 }}>
              <motion.span
                className="pointer-events-none absolute -inset-2 rounded-lg bg-clash-500/40 blur-md"
                animate={{ opacity: [0.25, 0.9, 0.25] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden
              />
              <Button variant="primary" className="relative min-w-60" onClick={() => act({ type: 'SELECT_CARD', playerId: meId!, position: pick })}>
                {iAmAttacker ? 'Lock in card' : 'Lock in & clash!'}
              </Button>
            </motion.div>
          )
        }
      />
    )
  } else if (view.phase !== 'finished') {
    content = <Waiting view={view} me={me} active={active} defender={defender} waitingOn={waitingOn} />
  }

  return (
    <div className="fixed inset-0 flex touch-manipulation flex-col overflow-hidden select-none">
      <Backdrop dim={0.62} />

      <header className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <button
          type="button"
          onClick={() => setMenu(true)}
          className="cut-sm grid h-11 w-11 shrink-0 place-items-center bg-ink-700/85 ring-1 ring-steel-400/30 hover:ring-steel-300/60"
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 7h14M5 12h14M5 17h14" />
          </svg>
        </button>
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto" role="list" aria-label="Players">
          {view.players.map((p) => (
            <div key={p.id} className={`shrink-0 ${seatConnected(p) ? '' : 'opacity-50'}`}>
              <PlayerChip
                p={p}
                isYou={p.id === meId}
                active={view.phase !== 'peek' && view.phase !== 'finished' && p.id === view.activeId}
                defending={view.phase !== 'peek' && p.id === view.defenderId}
                onClick={() => setInspect(p.id)}
              />
            </div>
          ))}
        </div>
      </header>

      {offline.length > 0 && view.phase !== 'finished' && (
        <div className="mx-3 mb-1 flex flex-wrap items-center justify-center gap-2 rounded bg-ink-800/90 px-3 py-2 text-center text-sm text-steel-200 ring-1 ring-steel-400/25">
          <span>
            {neededOffline.length > 0
              ? `Waiting for ${neededOffline.map((p) => p.name).join(' and ')} to reconnect…`
              : `${offline.map((p) => p.name).join(' and ')} ${offline.length > 1 ? 'are' : 'is'} offline — the game will wait for them.`}
          </span>
          {room.you.isHost &&
            offline.map((p) => (
              <button
                key={p.id}
                type="button"
                className="cut-sm bg-clash-500 px-2 py-1 font-display text-xs font-semibold tracking-wide text-white uppercase"
                onClick={() => send({ t: 'botTakeover', seat: p.seat })}
              >
                Let a computer play for {p.name}
              </button>
            ))}
        </div>
      )}

      {content}

      {view.phase === 'finished' && (
        <Victory view={view} onPlayAgain={room.you.isHost ? () => send({ t: 'rematch' }) : undefined} onMenu={onLeave} />
      )}

      <Dialog open={menu && !confirmLeave} title={`Room ${room.code}`} onClose={() => setMenu(false)}>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={() => setMenu(false)}>
            Back to the game
          </Button>
          <div className="cut-sm flex flex-col gap-2 bg-ink-900/70 p-3">
            <Toggle label="Sound" on={settings.sound} onChange={(v) => update({ sound: v })} />
            <Toggle label="Reduced motion" on={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
          </div>
          <Button onClick={() => setConfirmLeave(true)}>Leave game</Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmLeave}
        title="Leave the game?"
        onClose={() => setConfirmLeave(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
              Stay
            </Button>
            <Button variant="primary" onClick={onLeave}>
              Leave
            </Button>
          </>
        }
      >
        {room.you.isHost
          ? 'The others can keep playing. If it’s your move, the next host can let a computer take your seat.'
          : 'The others will wait for you, and the host can let a computer take your seat.'}
      </Dialog>

      <Dialog
        open={!!inspect}
        wide
        title={`${view.players.find((p) => p.id === inspect)?.name ?? ''}'s board`}
        onClose={() => setInspect(null)}
        actions={
          <Button variant="primary" onClick={() => setInspect(null)}>
            Close
          </Button>
        }
      >
        {inspect && (
          <div className="mx-auto max-w-[340px]">
            <Board player={view.players.find((p) => p.id === inspect)!} owner={inspect === meId ? 'you' : 'name'} />
            <p className="mt-3 text-center text-sm text-steel-400">Face-down cards stay hidden. Eye badges show the spots this player peeked at.</p>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function Waiting({
  view,
  me,
  active,
  defender,
  waitingOn,
}: {
  view: GameView
  me: PlayerView | null
  active: PlayerView
  defender: PlayerView | null
  waitingOn: PlayerView[]
}) {
  const { ref, width } = useFitWidth<HTMLDivElement>(FRAMED_RATIO, 460)
  const names = waitingOn.map((p) => p.name).join(' and ')
  let title = ''
  let hint = ''
  if (view.phase === 'peek') {
    title = 'Cards hidden'
    hint = names ? `Waiting for ${names} to finish peeking…` : 'Starting…'
  } else if (view.phase === 'choose-opponent') {
    title = `${active.name}'s turn`
    hint = `${active.name} is choosing who to clash with…`
  } else if (me && (view.activeId === me.id || view.defenderId === me.id)) {
    title = 'Locked in!'
    hint = names ? `Waiting for ${names} to pick a card…` : 'Flipping…'
  } else {
    title = `${active.name} vs ${defender?.name ?? '…'}`
    hint = names ? `Waiting for ${names} to pick a card…` : 'Flipping…'
  }
  const board = me ?? view.players.find((p) => p.id === view.activeId)!
  return (
    <>
      <div aria-live="polite">
        <Instructions title={title} hint={hint} />
      </div>
      <div className="flex justify-center gap-1 pb-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-clash-400"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center px-3 pb-6">
        {width > 0 && (
          <div style={{ width }} className="opacity-90">
            <Board player={board} selected={view.myPick} owner={me ? 'you' : 'name'} />
          </div>
        )}
      </div>
      {!me && <p className="pb-4 text-center text-sm text-steel-400">You’re watching this game.</p>}
    </>
  )
}

function Toast({ children, tone }: { children: React.ReactNode; tone?: 'warn' }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-[60] flex justify-center px-4">
      <motion.div
        role="status"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className={`cut-sm px-4 py-2.5 text-sm font-semibold shadow-lg ${
          tone === 'warn' ? 'bg-[#f5b70a] text-ink-950' : 'bg-ink-700 text-steel-100 ring-1 ring-steel-400/30'
        }`}
      >
        {children}
      </motion.div>
    </div>
  )
}
