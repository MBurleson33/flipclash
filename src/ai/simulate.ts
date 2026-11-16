// Bot-vs-bot games for tests and playtest statistics.
import { applyAction, createGame, currentDecider, mulberry32, pendingDeciders, type Difficulty, type GameState } from '../engine'
import { botAct, type BotMemory } from './bot'

export interface SimOptions {
  /** Online rules: simultaneous peeks and picks, deciders act in random order. */
  simultaneous?: boolean
  /** Bots that forget their peeked cards — used to measure what the peek is worth. */
  forgetPeeks?: string[]
}

export function simulateGame(levels: Difficulty[], seed: number, opts: SimOptions = {}): GameState {
  let state = createGame(
    levels.map((bot, i) => ({ name: `Bot ${i + 1}`, bot })),
    seed,
    { simultaneous: opts.simultaneous },
  )
  const rand = mulberry32(seed ^ 0x9e3779b9)
  const memory: Record<string, BotMemory> = {}
  for (let guard = 0; guard < 2000; guard++) {
    if (state.phase === 'finished') return state
    if (state.phase === 'reveal') {
      state = must(applyAction(state, { type: 'NEXT_TURN' }))
      continue
    }
    const ids = opts.simultaneous ? pendingDeciders(state) : [currentDecider(state)!.id]
    const pickId = ids[Math.floor(rand() * ids.length)]
    const decider = state.players.find((p) => p.id === pickId)!
    const turn = botAct(state, decider.id, decider.bot!, memory[decider.id] ?? {}, rand)
    if (!turn) throw new Error(`Bot ${decider.id} had no move in phase ${state.phase}`)
    memory[decider.id] = opts.forgetPeeks?.includes(decider.id) ? {} : turn.memory
    state = must(applyAction(state, turn.action))
  }
  throw new Error('Game did not finish')
}

function must(r: ReturnType<typeof applyAction>): GameState {
  if (!r.ok) throw new Error(`Illegal bot move: ${r.error}`)
  return r.state
}
