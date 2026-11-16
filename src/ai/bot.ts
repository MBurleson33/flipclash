// FLIP CLASH computer players.
// A bot only ever sees viewFor(state, botId) — the same information a human in its seat has —
// plus its own memory of the 3 cards it peeked at. It never reads the raw game state.
import {
  RULES,
  type Action,
  type Difficulty,
  type GameState,
  type Position,
  viewFor,
} from '../engine'
import type { GameView, PlayerView, SlotView } from '../engine/view'

/** What a bot remembers: the numbers it saw during its peek, by board position. */
export type BotMemory = Partial<Record<Position, number>>

export interface BotTurn {
  action: Action
  memory: BotMemory
}

type Rand = () => number

/** How often Hard plays a random card instead of its best one (Medium forgets 40% of the time). */
export const HARD_SLIP = 0.1

const NUMBERS = Array.from({ length: RULES.numbersPerColor }, (_, i) => i + 1)

/**
 * Decide the bot's next action. Returns null if it isn't this bot's decision.
 * `state` is only used to build the bot's own player view.
 */
export function botAct(
  state: GameState,
  botId: string,
  level: Difficulty,
  memory: BotMemory,
  rand: Rand = Math.random,
): BotTurn | null {
  const view = viewFor(state, botId)
  const me = view.players.find((p) => p.id === botId)!
  const mem: BotMemory = { ...memory }

  // Anything currently visible to me during my peek gets memorized.
  for (const s of me.slots) if (s.peekVisible && s.card) mem[s.position] = s.card.number

  switch (view.phase) {
    case 'peek': {
      if (view.peekerId !== botId) return null
      if (me.peekCount < RULES.peekCount) {
        const options = me.slots.filter((s) => !s.peekedByOwner)
        return { action: { type: 'PEEK_CARD', playerId: botId, position: pick(options, rand).position }, memory: mem }
      }
      return { action: { type: 'FINISH_PEEK', playerId: botId }, memory: mem }
    }
    case 'choose-opponent': {
      if (view.activeId !== botId) return null
      const opponentId = chooseOpponent(view, me, level, mem, rand)
      return { action: { type: 'CHOOSE_OPPONENT', playerId: botId, opponentId }, memory: mem }
    }
    case 'select-active':
    case 'select-defender': {
      const mine = view.phase === 'select-active' ? view.activeId === botId : view.defenderId === botId
      if (!mine) return null
      const oppId = view.phase === 'select-active' ? view.defenderId! : view.activeId
      const opp = view.players.find((p) => p.id === oppId)!
      const position = chooseCard(view, me, opp, level, mem, rand)
      return { action: { type: 'SELECT_CARD', playerId: botId, position }, memory: mem }
    }
    default:
      return null
  }
}

// ---------------- card choice ----------------

function playable(me: PlayerView): SlotView[] {
  return me.slots.filter((s) => !s.empty && !s.faceUp && !s.used)
}

function chooseCard(
  view: GameView,
  me: PlayerView,
  opp: PlayerView,
  level: Difficulty,
  mem: BotMemory,
  rand: Rand,
): Position {
  const options = playable(me)
  if (level === 'easy') return pick(options, rand).position

  if (level === 'medium') {
    // Plays sensibly most of the time, but sometimes forgets what it peeked at.
    if (rand() < 0.4) return pick(options, rand).position
    // Known high cards first, then unknown cards, then known low cards last.
    const score = (s: SlotView) => {
      const known = mem[s.position]
      if (known === undefined) return 7 // an unknown card is about average
      return known
    }
    return best(options, (s) => score(s) + rand() * 0.01).position
  }

  // HARD: tuned slightly below its best — now and then it plays a card without thinking.
  if (rand() < HARD_SLIP) return pick(options, rand).position

  // Count cards. Every card I can see is out of the pool, so the odds of an unknown card shift.
  const dist = unknownDistribution(view, me, mem)
  const pWinWith = (v: number) => sumWhere(dist, (n) => n < v)
  const pLoseWith = (v: number) => sumWhere(dist, (n) => n > v)

  // How much do winning and losing matter right now?
  const winValue = me.prizes.length === RULES.prizeSpots - 1 ? 3 : 1 // a win would end the game for me
  const loseCost = opp.prizes.length === RULES.prizeSpots - 1 ? 3 : 1 // a loss would hand them the game
  const urgent = winValue > 1 || loseCost > 1

  const evOf = (v: number) => winValue * pWinWith(v) - loseCost * pLoseWith(v)
  const unknownEv = NUMBERS.reduce((acc, v) => acc + dist[v] * evOf(v), 0)

  // Saving good cards for later matters less the closer the game is to ending.
  const remainingMine = options.length
  const scored = options.map((s) => {
    const known = mem[s.position]
    let ev = known === undefined ? unknownEv : evOf(known)
    if (!urgent && known !== undefined && remainingMine > 2) {
      // Hold a very high card back slightly when the stakes are normal; dump low cards late.
      if (known <= 4) ev -= 0.15
    }
    return { s, ev: ev + rand() * 0.001 }
  })
  return scored.sort((a, b) => b.ev - a.ev)[0].s.position
}

/** Probability of each number 1..13 for a card I can't see. */
export function unknownDistribution(view: GameView, me: PlayerView, mem: BotMemory): number[] {
  const left = Array(RULES.numbersPerColor + 1).fill(5) // 5 colors of each number
  left[0] = 0
  const seen = (n: number) => {
    if (left[n] > 0) left[n]--
  }
  for (const p of view.players) {
    for (const s of p.slots) if (s.card && s.faceUp) seen(s.card.number)
    for (const c of p.prizes) seen(c.number)
  }
  for (const s of me.slots) {
    const known = mem[s.position]
    if (known !== undefined && !s.faceUp && !s.empty) seen(known)
  }
  const total = left.reduce((a, b) => a + b, 0) || 1
  return left.map((c) => c / total)
}

// ---------------- opponent choice ----------------

function chooseOpponent(
  view: GameView,
  me: PlayerView,
  level: Difficulty,
  mem: BotMemory,
  rand: Rand,
): string {
  const options = view.players.filter((p) => p.id !== me.id && p.playableCount > 0)
  if (level === 'easy') return pick(options, rand).id

  if (level === 'medium') {
    // Pick on whoever has the fewest prizes — if they win, it hurts least.
    return best(options, (p) => -p.prizes.length + rand() * 0.1).id
  }

  // HARD: if I'm one away from winning, attack anyone; otherwise avoid feeding a player who is
  // about to win, and prefer opponents with few cards left (their remaining cards skew known).
  const dist = unknownDistribution(view, me, mem)
  const myBest = Math.max(
    ...playable(me).map((s) => mem[s.position] ?? NUMBERS.reduce((a, v) => a + v * dist[v], 0)),
  )
  const pWin = sumWhere(dist, (n) => n < myBest)
  return best(options, (p) => {
    const danger = p.prizes.length >= RULES.prizeSpots - 1 ? 4 : p.prizes.length
    return pWin * 2 - (1 - pWin) * danger - p.prizes.length * 0.2 + rand() * 0.05
  }).id
}

// ---------------- helpers ----------------

function pick<T>(items: T[], rand: Rand): T {
  return items[Math.floor(rand() * items.length)]
}

function best<T>(items: T[], score: (t: T) => number): T {
  let top = items[0]
  let topScore = -Infinity
  for (const it of items) {
    const sc = score(it)
    if (sc > topScore) {
      topScore = sc
      top = it
    }
  }
  return top
}

function sumWhere(dist: number[], pred: (n: number) => boolean) {
  let s = 0
  for (let n = 1; n < dist.length; n++) if (pred(n)) s += dist[n]
  return s
}
