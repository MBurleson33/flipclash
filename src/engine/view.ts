// Player views: strip everything a given player is not allowed to know.
// The UI and the AI only ever render/decide from a view — never the raw state.
import { type Card, type GameState, type Phase, type Position, POSITIONS } from './types'

export interface SlotView {
  position: Position
  card: Card | null // null when face-down (to this viewer) or empty
  empty: boolean
  faceUp: boolean
  used: boolean
  peekedByOwner: boolean // marks the spot only, never the value
  peekVisible: boolean // value shown right now because the viewer is peeking it
}

export interface PlayerView {
  id: string
  name: string
  bot: import('./types').Difficulty | null
  seat: number
  slots: SlotView[]
  prizes: Card[]
  playableCount: number
  peekDone: boolean
  peekCount: number
}

export interface GameView {
  viewerId: string | null // null = public table view (no secrets)
  phase: Phase
  turn: number
  activeId: string
  defenderId: string | null
  /** Only revealed to the viewer if it's their own pick. */
  myPick: Position | null
  activeHasPicked: boolean
  defenderHasPicked: boolean
  simultaneous: boolean
  /** The two cards in the last clash — public once flipped. */
  clashCards: { attacker: Card; defender: Card } | null
  players: PlayerView[]
  leftoverCount: number
  lastClash: GameState['lastClash']
  result: GameState['result']
  peekerId: string | null
}

export function viewFor(state: GameState, viewerId: string | null): GameView {
  const peeker = state.phase === 'peek' ? state.players[state.peekIndex] : null
  const active = state.players[state.activeIndex]

  const players: PlayerView[] = state.players.map((p) => {
    const viewerIsPeekingThis = state.phase === 'peek' && viewerId === p.id && !p.peekDone
    const slots: SlotView[] = POSITIONS.map((pos) => {
      const s = p.board[pos]
      const peekVisible = viewerIsPeekingThis && p.peeked.includes(pos)
      const showCard = s.cardId !== null && (s.faceUp || peekVisible)
      return {
        position: pos,
        card: showCard ? state.cards[s.cardId!] : null,
        empty: s.cardId === null,
        faceUp: s.faceUp,
        used: s.used,
        peekedByOwner: p.peeked.includes(pos),
        peekVisible,
      }
    })
    return {
      id: p.id,
      name: p.name,
      bot: p.bot,
      seat: p.seat,
      slots,
      prizes: p.prizes.map((id) => state.cards[id]),
      playableCount: slots.filter((s) => !s.empty && !s.faceUp && !s.used).length,
      peekDone: p.peekDone,
      peekCount: p.peeked.length,
    }
  })

  let myPick: Position | null = null
  if (viewerId && viewerId === active.id) myPick = state.activePick
  if (viewerId && viewerId === state.defenderId) myPick = state.defenderPick

  return {
    viewerId,
    phase: state.phase,
    turn: state.turn,
    activeId: active.id,
    defenderId: state.defenderId,
    myPick,
    activeHasPicked: state.activePick !== null,
    defenderHasPicked: state.defenderPick !== null,
    simultaneous: !!state.simultaneous,
    clashCards: state.lastClash
      ? { attacker: state.cards[state.lastClash.attackerCardId], defender: state.cards[state.lastClash.defenderCardId] }
      : null,
    players,
    leftoverCount: state.leftover.length,
    lastClash: state.lastClash,
    result: state.result,
    peekerId: peeker?.id ?? null,
  }
}
