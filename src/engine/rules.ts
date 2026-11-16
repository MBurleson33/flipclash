// All tunable rule constants live here so the rules are easy to refine.
import { COLORS, type Card } from './types'

export const RULES = {
  minPlayers: 2,
  maxPlayers: 4,
  numbersPerColor: 13,
  boardSize: 9,
  prizeSpots: 4,
  peekCount: 3,
} as const

export function cardId(color: string, n: number) {
  return `${color}-${String(n).padStart(2, '0')}`
}

/** The full 65-card deck: 5 colors × 1..13. */
export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const color of COLORS) {
    for (let n = 1; n <= RULES.numbersPerColor; n++) {
      deck.push({ id: cardId(color, n), color, number: n })
    }
  }
  return deck
}
