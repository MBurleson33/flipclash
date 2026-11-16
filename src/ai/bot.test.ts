import { describe, expect, it } from 'vitest'
import { createGame, applyAction, type Difficulty, type GameState } from '../engine'
import { botAct } from './bot'
import { simulateGame } from './simulate'

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard']

describe('computer players', () => {
  it.each(LEVELS)('%s bots always make legal moves and finish 2–4 player games', (level) => {
    for (let n = 2; n <= 4; n++) {
      for (let seed = 1; seed <= 40; seed++) {
        const end = simulateGame(Array(n).fill(level), seed * 7 + n)
        expect(end.phase).toBe('finished')
        expect(end.result!.winnerIds.length).toBeGreaterThan(0)
      }
    }
  })

  it('mixed difficulties play together', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(simulateGame(['easy', 'medium', 'hard', 'hard'], seed).phase).toBe('finished')
    }
  })

  it('bot decisions depend only on what its seat can see (hidden cards never matter)', () => {
    // Two games identical except for the values of the human's face-down cards.
    const base = createGame([{ name: 'Human' }, { name: 'CPU', bot: 'hard' }], 99)
    let a: GameState = base
    // human peeks 1,2,3 and finishes; bot peeks
    for (const pos of [1, 2, 3] as const) a = (applyAction(a, { type: 'PEEK_CARD', playerId: 'p1', position: pos }) as { state: GameState }).state
    a = (applyAction(a, { type: 'FINISH_PEEK', playerId: 'p1' }) as { state: GameState }).state

    // Swap the human's unpeeked face-down cards with leftover deck cards.
    const b: GameState = structuredClone(a)
    for (const pos of [4, 5, 6, 7, 8, 9] as const) {
      const tmp = b.players[0].board[pos].cardId!
      b.players[0].board[pos].cardId = b.leftover[pos]
      b.leftover[pos] = tmp
    }

    const seq = (s: GameState) => {
      const mem = {}
      const out: string[] = []
      let st = s
      let m = mem
      for (let i = 0; i < 4; i++) {
        const t = botAct(st, 'p2', 'hard', m, () => 0.42)
        if (!t) break
        out.push(JSON.stringify(t.action))
        m = t.memory
        st = (applyAction(st, t.action) as { state: GameState }).state
      }
      return out
    }
    expect(seq(a)).toEqual(seq(b))
  })

  it('hard beats easy more often than not', () => {
    let hardWins = 0
    const games = 400
    for (let seed = 0; seed < games; seed++) {
      const seats: Difficulty[] = seed % 2 ? ['hard', 'easy'] : ['easy', 'hard']
      const end = simulateGame(seats, seed + 1000)
      const hardId = seed % 2 ? 'p1' : 'p2'
      if (end.result!.winnerIds.length === 1 && end.result!.winnerIds[0] === hardId) hardWins++
    }
    expect(hardWins / games).toBeGreaterThan(0.5)
  })
})
