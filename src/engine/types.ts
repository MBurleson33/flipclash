// FLIP CLASH — core types. Pure data, no React.

export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'] as const
export type CardColor = (typeof COLORS)[number]

export interface Card {
  id: string // e.g. "red-07"
  color: CardColor
  number: number // 1..13
}

/** Board positions 1..9 in the diamond:
 *            [1]
 *        [2]     [3]
 *    [4]     [5]     [6]
 *        [7]     [8]
 *            [9]
 * Prize spots 0..3 sit in the gaps around [5]: top, left, right, bottom.
 */
export type Position = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export const POSITIONS: Position[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export interface Slot {
  cardId: string | null // null = empty (card was captured by an opponent)
  faceUp: boolean // revealed to everyone
  used: boolean // already clashed — can never clash again
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Player {
  id: string
  name: string
  bot: Difficulty | null // null = human
  seat: number // 0..3, also drives the color-independent marker
  board: Record<Position, Slot>
  prizes: string[] // captured card ids, max 4
  peeked: Position[] // positions looked at during the opening peek (max 3)
  peekDone: boolean
}

export type Phase =
  | 'peek' // each player in turn looks at 3 of their own cards
  | 'choose-opponent' // active player picks who to clash with
  | 'select-active' // active player secretly picks a face-down card
  | 'select-defender' // chosen opponent secretly picks a face-down card
  | 'reveal' // both cards flipped, result shown
  | 'finished'

export interface ClashResult {
  turn: number
  attackerId: string
  defenderId: string
  attackerPos: Position
  defenderPos: Position
  attackerCardId: string
  defenderCardId: string
  winnerId: string | null // null = tie, nobody wins
  capturedCardId: string | null
  prizeIndex: number | null // which of the winner's prize spots it filled
}

export interface Standing {
  playerId: string
  prizes: number
  total: number
}

export interface GameResult {
  winnerIds: string[] // more than one = draw
  reason: 'four-prizes' | 'cards-ran-out'
  standings: Standing[]
}

export interface GameState {
  version: 1
  seed: number
  cards: Record<string, Card>
  players: Player[]
  leftover: string[] // undealt cards, never used in play
  phase: Phase
  turn: number
  activeIndex: number
  peekIndex: number
  defenderId: string | null
  activePick: Position | null
  defenderPick: Position | null
  lastClash: ClashResult | null
  history: ClashResult[]
  result: GameResult | null
}

export type Action =
  | { type: 'PEEK_CARD'; playerId: string; position: Position }
  | { type: 'FINISH_PEEK'; playerId: string }
  | { type: 'CHOOSE_OPPONENT'; playerId: string; opponentId: string }
  | { type: 'SELECT_CARD'; playerId: string; position: Position }
  | { type: 'NEXT_TURN' }

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string; state: GameState }

export interface PlayerSetup {
  name: string
  bot?: Difficulty | null
}
