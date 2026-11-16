import { describe, expect, it } from 'vitest'
import {
  applyAction,
  buildDeck,
  cardId,
  createGame,
  eligibleOpponents,
  pendingDeciders,
  playablePositions,
  viewFor,
  POSITIONS,
  type Action,
  type GameState,
  type Position,
} from './index'

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}` }))

function act(state: GameState, action: Action): GameState {
  const r = applyAction(state, action)
  if (!r.ok) throw new Error(`${action.type} rejected: ${r.error}`)
  return r.state
}

/** Put a specific card number on a board spot (swaps colors freely, test-only). */
function rig(state: GameState, seat: number, pos: Position, number: number, color = 'red') {
  const id = cardId(color, number)
  // find where that card currently is and swap
  for (const p of state.players) {
    for (const q of POSITIONS) {
      if (p.board[q].cardId === id) p.board[q].cardId = state.players[seat].board[pos].cardId
    }
  }
  const li = state.leftover.indexOf(id)
  if (li >= 0) state.leftover[li] = state.players[seat].board[pos].cardId!
  state.players[seat].board[pos].cardId = id
}

function peekAll(state: GameState): GameState {
  let s = state
  for (const p of s.players) {
    for (const pos of [1, 2, 3] as Position[]) s = act(s, { type: 'PEEK_CARD', playerId: p.id, position: pos })
    s = act(s, { type: 'FINISH_PEEK', playerId: p.id })
  }
  return s
}

function clash(s: GameState, aPos: Position, dPos: Position, opponentId?: string): GameState {
  const active = s.players[s.activeIndex]
  if (s.phase === 'choose-opponent') s = act(s, { type: 'CHOOSE_OPPONENT', playerId: active.id, opponentId: opponentId! })
  s = act(s, { type: 'SELECT_CARD', playerId: active.id, position: aPos })
  s = act(s, { type: 'SELECT_CARD', playerId: s.defenderId!, position: dPos })
  return s
}

describe('deck & setup', () => {
  it('has 65 cards: 5 colors × 1–13, all unique', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(65)
    expect(new Set(deck.map((c) => c.id)).size).toBe(65)
    for (const color of ['red', 'blue', 'green', 'yellow', 'purple']) {
      const nums = deck.filter((c) => c.color === color).map((c) => c.number).sort((a, b) => a - b)
      expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    }
  })

  it.each([2, 3, 4])('deals 9 face-down cards to each of %i players, prizes empty', (n) => {
    const s = createGame(names(n), 42)
    expect(s.players).toHaveLength(n)
    const dealt = s.players.flatMap((p) => POSITIONS.map((pos) => p.board[pos].cardId))
    expect(dealt).toHaveLength(9 * n)
    expect(new Set([...dealt, ...s.leftover]).size).toBe(65)
    expect(s.leftover).toHaveLength(65 - 9 * n)
    for (const p of s.players) {
      expect(p.prizes).toEqual([])
      for (const pos of POSITIONS) expect(p.board[pos]).toMatchObject({ faceUp: false, used: false })
    }
    expect(s.phase).toBe('peek')
  })

  it('rejects fewer than 2 or more than 4 players', () => {
    expect(() => createGame(names(1), 1)).toThrow()
    expect(() => createGame(names(5), 1)).toThrow()
  })

  it('is deterministic for a seed', () => {
    expect(createGame(names(3), 7)).toEqual(createGame(names(3), 7))
    expect(createGame(names(3), 7)).not.toEqual(createGame(names(3), 8))
  })
})

describe('opening peek', () => {
  it('each player peeks exactly 3 of their own cards, in seat order', () => {
    let s = createGame(names(2), 1)
    expect(applyAction(s, { type: 'PEEK_CARD', playerId: 'p2', position: 1 }).ok).toBe(false)
    expect(applyAction(s, { type: 'FINISH_PEEK', playerId: 'p1' }).ok).toBe(false) // needs 3
    s = act(s, { type: 'PEEK_CARD', playerId: 'p1', position: 4 })
    expect(applyAction(s, { type: 'PEEK_CARD', playerId: 'p1', position: 4 }).ok).toBe(false) // same card twice
    s = act(s, { type: 'PEEK_CARD', playerId: 'p1', position: 5 })
    s = act(s, { type: 'PEEK_CARD', playerId: 'p1', position: 6 })
    expect(applyAction(s, { type: 'PEEK_CARD', playerId: 'p1', position: 7 }).ok).toBe(false) // a 4th
    s = act(s, { type: 'FINISH_PEEK', playerId: 'p1' })
    expect(s.peekIndex).toBe(1)
    expect(s.phase).toBe('peek')
  })

  it('peeked values are visible only to the peeker, and only until they finish', () => {
    let s = createGame(names(2), 1)
    s = act(s, { type: 'PEEK_CARD', playerId: 'p1', position: 1 })
    expect(viewFor(s, 'p1').players[0].slots[0].card).not.toBeNull()
    expect(viewFor(s, 'p2').players[0].slots[0].card).toBeNull()
    expect(viewFor(s, null).players[0].slots[0].card).toBeNull()
    s = act(s, { type: 'PEEK_CARD', playerId: 'p1', position: 2 })
    s = act(s, { type: 'PEEK_CARD', playerId: 'p1', position: 3 })
    s = act(s, { type: 'FINISH_PEEK', playerId: 'p1' })
    // Not allowed to look again
    expect(viewFor(s, 'p1').players[0].slots[0].card).toBeNull()
    expect(viewFor(s, 'p1').players[0].slots[0].peekedByOwner).toBe(true)
  })

  it('play starts with player 1 after everyone peeks; 2-player skips choosing', () => {
    const s = peekAll(createGame(names(2), 1))
    expect(s.phase).toBe('select-active')
    expect(s.activeIndex).toBe(0)
    expect(s.defenderId).toBe('p2')
    const s3 = peekAll(createGame(names(3), 1))
    expect(s3.phase).toBe('choose-opponent')
  })
})

describe('clashes', () => {
  it('higher number wins and captures the loser card into a prize spot', () => {
    let s = peekAll(createGame(names(2), 3))
    rig(s, 0, 1, 10)
    rig(s, 1, 9, 4, 'blue')
    s = clash(s, 1, 9)
    expect(s.phase).toBe('reveal')
    expect(s.lastClash).toMatchObject({ winnerId: 'p1', capturedCardId: 'blue-04', prizeIndex: 0 })
    expect(s.players[0].prizes).toEqual(['blue-04'])
    expect(s.players[0].board[1]).toMatchObject({ cardId: 'red-10', faceUp: true, used: true })
    expect(s.players[1].board[9]).toMatchObject({ cardId: null })
  })

  it('defender can win too; color never matters', () => {
    let s = peekAll(createGame(names(2), 3))
    rig(s, 0, 2, 5, 'purple')
    rig(s, 1, 2, 6, 'yellow')
    s = clash(s, 2, 2)
    expect(s.lastClash?.winnerId).toBe('p2')
    expect(s.players[1].prizes).toEqual(['purple-05'])
  })

  it('a tie: nobody wins, both cards stay face up and used', () => {
    let s = peekAll(createGame(names(2), 3))
    rig(s, 0, 3, 8, 'red')
    rig(s, 1, 3, 8, 'green')
    s = clash(s, 3, 3)
    expect(s.lastClash).toMatchObject({ winnerId: null, capturedCardId: null })
    expect(s.players[0].prizes).toEqual([])
    expect(s.players[1].prizes).toEqual([])
    expect(s.players[0].board[3]).toMatchObject({ faceUp: true, used: true, cardId: 'red-08' })
    expect(s.players[1].board[3]).toMatchObject({ faceUp: true, used: true, cardId: 'green-08' })
  })

  it('a card can only clash once, and empty spots cannot clash', () => {
    let s = peekAll(createGame(names(2), 3))
    rig(s, 0, 1, 12)
    rig(s, 1, 1, 2, 'blue')
    s = clash(s, 1, 1)
    s = act(s, { type: 'NEXT_TURN' }) // p2 active now
    expect(s.activeIndex).toBe(1)
    expect(applyAction(s, { type: 'SELECT_CARD', playerId: 'p2', position: 1 }).ok).toBe(false) // empty
    s = act(s, { type: 'SELECT_CARD', playerId: 'p2', position: 2 })
    expect(applyAction(s, { type: 'SELECT_CARD', playerId: 'p1', position: 1 }).ok).toBe(false) // used
    expect(playablePositions(s.players[0])).not.toContain(1)
  })

  it('blocks out-of-turn and wrong-phase actions', () => {
    let s = peekAll(createGame(names(2), 3))
    expect(applyAction(s, { type: 'SELECT_CARD', playerId: 'p2', position: 1 }).ok).toBe(false)
    expect(applyAction(s, { type: 'NEXT_TURN' }).ok).toBe(false)
    expect(applyAction(s, { type: 'PEEK_CARD', playerId: 'p1', position: 4 }).ok).toBe(false)
    s = act(s, { type: 'SELECT_CARD', playerId: 'p1', position: 1 })
    expect(applyAction(s, { type: 'SELECT_CARD', playerId: 'p1', position: 2 }).ok).toBe(false)
  })

  it('3+ players: active player picks the opponent; turn passes clockwise', () => {
    let s = peekAll(createGame(names(3), 9))
    expect(applyAction(s, { type: 'CHOOSE_OPPONENT', playerId: 'p1', opponentId: 'p1' }).ok).toBe(false)
    s = clash(s, 1, 1, 'p3')
    expect(s.lastClash?.defenderId).toBe('p3')
    s = act(s, { type: 'NEXT_TURN' })
    expect(s.players[s.activeIndex].id).toBe('p2')
  })
})

describe('hidden information', () => {
  it('opponent never sees the active pick; face-down values never leak', () => {
    let s = peekAll(createGame(names(2), 5))
    s = act(s, { type: 'SELECT_CARD', playerId: 'p1', position: 4 })
    expect(viewFor(s, 'p1').myPick).toBe(4)
    expect(viewFor(s, 'p2').myPick).toBeNull()
    expect(viewFor(s, 'p2').activeHasPicked).toBe(true)
    for (const viewer of ['p1', 'p2', null]) {
      const v = viewFor(s, viewer)
      for (const p of v.players) for (const slot of p.slots) if (!slot.faceUp) expect(slot.card).toBeNull()
      expect(JSON.stringify(v)).not.toContain('leftover":[')
    }
  })
})

describe('victory', () => {
  it('first to fill all 4 prize spots wins immediately', () => {
    let s = peekAll(createGame(names(2), 11))
    // p1 wins 4 clashes in a row; p2 attacks with low cards on their turns.
    for (let i = 0; i < 4; i++) {
      const pos = (i + 1) as Position
      rig(s, 0, pos, 13 - i, 'red')
      rig(s, 1, pos, 1 + i, 'blue')
    }
    s = clash(s, 1, 1)
    s = act(s, { type: 'NEXT_TURN' })
    s = clash(s, 2, 2) // p2 attacks with blue-02 into red-12
    s = act(s, { type: 'NEXT_TURN' })
    s = clash(s, 3, 3)
    s = act(s, { type: 'NEXT_TURN' })
    expect(s.result).toBeNull()
    s = clash(s, 4, 4)
    expect(s.players[0].prizes).toHaveLength(4)
    expect(s.result).toMatchObject({ winnerIds: ['p1'], reason: 'four-prizes' })
    s = act(s, { type: 'NEXT_TURN' })
    expect(s.phase).toBe('finished')
  })

  it('when cards run out, most prizes wins, then higher prize total, else a draw', () => {
    // Construct: all ties except crafted results, 2 players → 9 clashes each side uses one card.
    let s = peekAll(createGame(names(2), 21))
    const colorsA = ['red', 'blue', 'green', 'yellow', 'purple']
    // positions 1..9: p1 numbers vs p2 numbers
    const plan: [number, number][] = [
      [5, 3], // p1 wins, captures 3
      [2, 9], // p2 wins, captures 2
      [7, 7], [8, 8], [10, 10], [11, 11], [12, 12], [13, 13], [1, 1],
    ]
    plan.forEach(([a, b], i) => {
      rig(s, 0, (i + 1) as Position, a, colorsA[0])
      rig(s, 1, (i + 1) as Position, b, i % 2 ? colorsA[3] : colorsA[2])
    })
    for (let i = 0; i < 9; i++) {
      const pos = (i + 1) as Position
      s = clash(s, pos, pos)
      s = act(s, { type: 'NEXT_TURN' })
    }
    expect(s.phase).toBe('finished')
    expect(s.result?.reason).toBe('cards-ran-out')
    // both have 1 prize; p1 captured a 3, p2 captured a 2 → p1 wins on total
    expect(s.result?.winnerIds).toEqual(['p1'])
    expect(eligibleOpponents(s, 'p1')).toHaveLength(0)
  })

  it('a player out of cards is skipped in 3-player games but prizes still count', () => {
    let s = peekAll(createGame(names(3), 4))
    // Use up all 9 of p3's cards through ties with p1 and p2.
    let n = 1
    for (let pos = 1 as Position; pos <= 9; pos = (pos + 1) as Position) {
      // alternate attacker: whoever is active picks p3
      const active = s.players[s.activeIndex]
      const seat = active.seat
      const actPos = playablePositions(active)[0]
      if (seat === 2) {
        // p3 active: attack p1
        rig(s, 2, pos, n, 'red'); rig(s, 0, playablePositions(s.players[0])[0], n, 'blue')
        s = clash(s, pos, playablePositions(s.players[0])[0], 'p1')
      } else {
        rig(s, seat, actPos, n, 'red'); rig(s, 2, pos, n, 'blue')
        s = clash(s, actPos, pos, 'p3')
      }
      n = (n % 13) + 1
      s = act(s, { type: 'NEXT_TURN' })
    }
    expect(playablePositions(s.players[2])).toHaveLength(0)
    expect(s.phase).not.toBe('finished')
    expect(s.players[s.activeIndex].id).not.toBe('p3')
    if (s.phase === 'choose-opponent') {
      expect(eligibleOpponents(s, s.players[s.activeIndex].id).map((p) => p.id)).not.toContain('p3')
    } else {
      expect(s.defenderId).not.toBe('p3')
    }
  })
})

describe('simultaneous (online) mode', () => {
  const sim = (n: number, seed = 5) => createGame(names(n), seed, { simultaneous: true })

  it('everyone can peek at the same time, in any order', () => {
    let s = sim(3)
    expect(pendingDeciders(s)).toEqual(['p1', 'p2', 'p3'])
    s = act(s, { type: 'PEEK_CARD', playerId: 'p3', position: 1 })
    s = act(s, { type: 'PEEK_CARD', playerId: 'p1', position: 1 })
    // each sees only their own peeked card
    expect(viewFor(s, 'p3').players[2].slots[0].card).not.toBeNull()
    expect(viewFor(s, 'p3').players[0].slots[0].card).toBeNull()
    for (const pos of [2, 3] as Position[]) s = act(s, { type: 'PEEK_CARD', playerId: 'p3', position: pos })
    s = act(s, { type: 'FINISH_PEEK', playerId: 'p3' })
    expect(applyAction(s, { type: 'PEEK_CARD', playerId: 'p3', position: 4 }).ok).toBe(false)
    expect(pendingDeciders(s)).toEqual(['p1', 'p2'])
    for (const id of ['p1', 'p2']) {
      for (const pos of [2, 3, 4] as Position[]) {
        const r = applyAction(s, { type: 'PEEK_CARD', playerId: id, position: pos })
        if (r.ok) s = r.state
      }
      s = act(s, { type: 'FINISH_PEEK', playerId: id })
    }
    expect(s.phase).toBe('choose-opponent')
  })

  it('the defender may lock in first; the clash resolves when both have picked', () => {
    let s = sim(2)
    for (const id of ['p1', 'p2']) {
      for (const pos of [1, 2, 3] as Position[]) s = act(s, { type: 'PEEK_CARD', playerId: id, position: pos })
      s = act(s, { type: 'FINISH_PEEK', playerId: id })
    }
    expect(s.phase).toBe('select-active')
    expect(pendingDeciders(s)).toEqual(['p1', 'p2'])
    s = act(s, { type: 'SELECT_CARD', playerId: 'p2', position: 4 })
    expect(s.phase).toBe('select-active')
    expect(viewFor(s, 'p1').defenderHasPicked).toBe(true)
    expect(viewFor(s, 'p1').myPick).toBeNull() // p1 can't see where p2 picked
    expect(applyAction(s, { type: 'SELECT_CARD', playerId: 'p2', position: 5 }).ok).toBe(false)
    s = act(s, { type: 'SELECT_CARD', playerId: 'p1', position: 6 })
    expect(s.phase).toBe('reveal')
    expect(s.lastClash).toMatchObject({ attackerPos: 6, defenderPos: 4 })
    expect(viewFor(s, null).clashCards).not.toBeNull()
  })

  it('local (pass-and-play) mode still requires seat order', () => {
    const s = createGame(names(2), 5)
    expect(applyAction(s, { type: 'PEEK_CARD', playerId: 'p2', position: 1 }).ok).toBe(false)
  })
})
