// Messages between the app and the FLIP CLASH room server. Shared by both sides.
import type { Action, Difficulty } from '../engine'
import type { GameView } from '../engine/view'

export type SeatKind = 'human' | Difficulty

export interface SeatInfo {
  kind: SeatKind
  /** Display name: the human who took the seat, or the bot's name. Empty for an open human seat. */
  name: string
  /** For human seats: is that player's device connected right now? */
  connected: boolean
  /** Human seat that nobody has taken yet. */
  open: boolean
}

export interface RoomSnapshot {
  code: string
  you: { seat: number | null; isHost: boolean; playerId: string | null }
  seats: SeatInfo[]
  started: boolean
  /** Your personal view of the game — only what your seat may see. */
  view: GameView | null
  /** Players who have tapped "Next turn" on the current clash. */
  readyNext: string[]
  /** Server time (ms) when the current clash will move on by itself. */
  revealEndsAt: number | null
}

export type ClientMessage =
  | { t: 'hello'; token: string; name: string }
  | { t: 'setup'; seats: SeatKind[] }
  | { t: 'start' }
  | { t: 'act'; action: Action }
  | { t: 'next' }
  | { t: 'rematch' }
  | { t: 'botTakeover'; seat: number }
  | { t: 'leave' }

export type ServerMessage =
  | { t: 'room'; room: RoomSnapshot }
  | { t: 'error'; message: string; fatal?: boolean }

export const ROOM_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I or O
export const ROOM_CODE_LENGTH = 4
export const BOT_NAMES = ['Blaze', 'Nova', 'Bolt', 'Rio']

export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH)
}
