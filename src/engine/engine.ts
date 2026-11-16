// FLIP CLASH game engine — a pure reducer: applyAction(state, action) -> new state.
// No React, no randomness outside the seed. Illegal actions are rejected, never applied.
import { buildDeck, RULES } from './rules'
import { shuffle } from './rng'
import {
  POSITIONS,
  type Action,
  type ActionResult,
  type ClashResult,
  type GameResult,
  type GameState,
  type Player,
  type PlayerSetup,
  type Position,
  type Slot,
  type Standing,
} from './types'

// ---------- setup ----------

export function createGame(setups: PlayerSetup[], seed: number): GameState {
  if (setups.length < RULES.minPlayers || setups.length > RULES.maxPlayers) {
    throw new Error(`Flip Clash needs ${RULES.minPlayers}–${RULES.maxPlayers} players`)
  }
  const deck = buildDeck()
  const cards = Object.fromEntries(deck.map((c) => [c.id, c]))
  const shuffled = shuffle(deck.map((c) => c.id), seed)

  let cursor = 0
  const players: Player[] = setups.map((s, seat) => {
    const board = {} as Record<Position, Slot>
    for (const pos of POSITIONS) {
      board[pos] = { cardId: shuffled[cursor++], faceUp: false, used: false }
    }
    return {
      id: `p${seat + 1}`,
      name: s.name.trim() || `Player ${seat + 1}`,
      seat,
      board,
      prizes: [],
      peeked: [],
      peekDone: false,
    }
  })

  return {
    version: 1,
    seed,
    cards,
    players,
    leftover: shuffled.slice(cursor),
    phase: 'peek',
    turn: 0,
    activeIndex: 0,
    peekIndex: 0,
    defenderId: null,
    activePick: null,
    defenderPick: null,
    lastClash: null,
    history: [],
    result: null,
  }
}

// ---------- queries ----------

export function getPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id)
}

export function activePlayer(state: GameState): Player {
  return state.players[state.activeIndex]
}

/** Positions that still hold a face-down card that has not clashed. */
export function playablePositions(player: Player): Position[] {
  return POSITIONS.filter((pos) => {
    const s = player.board[pos]
    return s.cardId !== null && !s.faceUp && !s.used
  })
}

export function canClash(player: Player) {
  return playablePositions(player).length > 0
}

/** Opponents the given player may legally pick. */
export function eligibleOpponents(state: GameState, playerId: string): Player[] {
  return state.players.filter((p) => p.id !== playerId && canClash(p))
}

export function cardNumber(state: GameState, id: string) {
  return state.cards[id].number
}

export function standings(state: GameState): Standing[] {
  return state.players
    .map((p) => ({
      playerId: p.id,
      prizes: p.prizes.length,
      total: p.prizes.reduce((sum, id) => sum + cardNumber(state, id), 0),
    }))
    .sort((a, b) => b.prizes - a.prizes || b.total - a.total)
}

/** Who is the device "for" right now (whose secret decision is pending)? */
export function currentDecider(state: GameState): Player | null {
  switch (state.phase) {
    case 'peek':
      return state.players[state.peekIndex]
    case 'choose-opponent':
    case 'select-active':
      return activePlayer(state)
    case 'select-defender':
      return state.defenderId ? getPlayer(state, state.defenderId) ?? null : null
    default:
      return null
  }
}

// ---------- reducer ----------

const fail = (state: GameState, error: string): ActionResult => ({ ok: false, error, state })
const ok = (state: GameState): ActionResult => ({ ok: true, state })

function clone(state: GameState): GameState {
  return structuredClone(state)
}

export function applyAction(state: GameState, action: Action): ActionResult {
  switch (action.type) {
    case 'PEEK_CARD': {
      if (state.phase !== 'peek') return fail(state, 'Not the peek phase')
      const peeker = state.players[state.peekIndex]
      if (peeker.id !== action.playerId) return fail(state, 'Not your turn to peek')
      if (peeker.peeked.includes(action.position)) return fail(state, 'Already peeked at that card')
      if (peeker.peeked.length >= RULES.peekCount) return fail(state, `Only ${RULES.peekCount} peeks allowed`)
      if (!POSITIONS.includes(action.position)) return fail(state, 'No such position')
      const next = clone(state)
      next.players[next.peekIndex].peeked.push(action.position)
      return ok(next)
    }

    case 'FINISH_PEEK': {
      if (state.phase !== 'peek') return fail(state, 'Not the peek phase')
      const peeker = state.players[state.peekIndex]
      if (peeker.id !== action.playerId) return fail(state, 'Not your turn to peek')
      if (peeker.peeked.length < RULES.peekCount) return fail(state, `Look at ${RULES.peekCount} cards first`)
      const next = clone(state)
      next.players[next.peekIndex].peekDone = true
      if (next.peekIndex < next.players.length - 1) {
        next.peekIndex++
      } else {
        next.turn = 1
        next.activeIndex = 0
        beginTurn(next)
      }
      return ok(next)
    }

    case 'CHOOSE_OPPONENT': {
      if (state.phase !== 'choose-opponent') return fail(state, 'Not time to choose an opponent')
      if (activePlayer(state).id !== action.playerId) return fail(state, 'Not your turn')
      const legal = eligibleOpponents(state, action.playerId).some((p) => p.id === action.opponentId)
      if (!legal) return fail(state, 'That player cannot be chosen')
      const next = clone(state)
      next.defenderId = action.opponentId
      next.phase = 'select-active'
      return ok(next)
    }

    case 'SELECT_CARD': {
      const isActive = state.phase === 'select-active'
      const isDefender = state.phase === 'select-defender'
      if (!isActive && !isDefender) return fail(state, 'Not time to pick a card')
      const chooser = isActive ? activePlayer(state) : getPlayer(state, state.defenderId!)!
      if (chooser.id !== action.playerId) return fail(state, 'Not your pick')
      if (!playablePositions(chooser).includes(action.position)) {
        return fail(state, 'That card cannot clash')
      }
      const next = clone(state)
      if (isActive) {
        next.activePick = action.position
        next.phase = 'select-defender'
      } else {
        next.defenderPick = action.position
        resolveClash(next)
      }
      return ok(next)
    }

    case 'NEXT_TURN': {
      if (state.phase !== 'reveal') return fail(state, 'Nothing to continue from')
      const next = clone(state)
      next.activePick = null
      next.defenderPick = null
      next.defenderId = null
      if (endIfNoClashesLeft(next)) return ok(next)
      next.turn++
      next.activeIndex = nextActiveIndex(next, next.activeIndex)
      beginTurn(next)
      return ok(next)
    }
  }
}

// ---------- internals (mutate the cloned state) ----------

function beginTurn(state: GameState) {
  if (endIfNoClashesLeft(state)) return
  const active = activePlayer(state)
  if (!canClash(active) || eligibleOpponents(state, active.id).length === 0) {
    state.activeIndex = nextActiveIndex(state, state.activeIndex)
  }
  const opponents = eligibleOpponents(state, activePlayer(state).id)
  if (opponents.length === 1) {
    // Only one possible opponent — skip the choice.
    state.defenderId = opponents[0].id
    state.phase = 'select-active'
  } else {
    state.defenderId = null
    state.phase = 'choose-opponent'
  }
}

/** Next player clockwise who can still clash (skips players who are out of cards). */
function nextActiveIndex(state: GameState, from: number): number {
  const n = state.players.length
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n
    const p = state.players[idx]
    if (canClash(p) && eligibleOpponents(state, p.id).length > 0) return idx
  }
  return from
}

function resolveClash(state: GameState) {
  const attacker = activePlayer(state)
  const defender = getPlayer(state, state.defenderId!)!
  const aPos = state.activePick!
  const dPos = state.defenderPick!
  const aSlot = attacker.board[aPos]
  const dSlot = defender.board[dPos]
  const aCard = aSlot.cardId!
  const dCard = dSlot.cardId!
  const aNum = cardNumber(state, aCard)
  const dNum = cardNumber(state, dCard)

  // Both flip at once.
  aSlot.faceUp = true
  dSlot.faceUp = true
  aSlot.used = true
  dSlot.used = true

  let winnerId: string | null = null
  let captured: string | null = null
  let prizeIndex: number | null = null

  if (aNum !== dNum) {
    const winner = aNum > dNum ? attacker : defender
    const loserSlot = aNum > dNum ? dSlot : aSlot
    captured = loserSlot.cardId
    loserSlot.cardId = null // loser's spot stays empty
    loserSlot.faceUp = false
    prizeIndex = winner.prizes.length
    winner.prizes.push(captured!)
    winnerId = winner.id
  }
  // Tie: nobody wins; both cards stay face up, used.

  const clash: ClashResult = {
    turn: state.turn,
    attackerId: attacker.id,
    defenderId: defender.id,
    attackerPos: aPos,
    defenderPos: dPos,
    attackerCardId: aCard,
    defenderCardId: dCard,
    winnerId,
    capturedCardId: captured,
    prizeIndex,
  }
  state.lastClash = clash
  state.history.push(clash)
  state.phase = 'reveal'

  const w = winnerId ? getPlayer(state, winnerId)! : null
  if (w && w.prizes.length >= RULES.prizeSpots) {
    state.result = buildResult(state, 'four-prizes', [w.id])
  }
}

function endIfNoClashesLeft(state: GameState): boolean {
  if (state.result) {
    state.phase = 'finished'
    return true
  }
  const stillIn = state.players.filter(canClash)
  if (stillIn.length >= 2) return false
  const ranked = standings(state)
  const top = ranked[0]
  const winners = ranked.filter((s) => s.prizes === top.prizes && s.total === top.total).map((s) => s.playerId)
  state.result = buildResult(state, 'cards-ran-out', winners)
  state.phase = 'finished'
  return true
}

function buildResult(state: GameState, reason: GameResult['reason'], winnerIds: string[]): GameResult {
  return { winnerIds, reason, standings: standings(state) }
}
