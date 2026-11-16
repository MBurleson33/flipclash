// Playtest statistics from thousands of bot-vs-bot games.
// Run:  npm run playtest           (writes docs/playtest-stats.md)
import { writeFileSync, mkdirSync } from 'node:fs'
import { simulateGame } from '../src/ai/simulate'
import type { Difficulty, GameState } from '../src/engine'

const N = Number(process.env.GAMES ?? 4000)
const out: string[] = []
const log = (s = '') => {
  console.log(s)
  out.push(s)
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

function run(levels: Difficulty[], games = N, opts = {}) {
  const res: GameState[] = []
  for (let i = 0; i < games; i++) res.push(simulateGame(levels, 100_000 + i * 7919, opts))
  return res
}
function winShare(games: GameState[], playerId: string) {
  let w = 0
  for (const g of games) {
    const ids = g.result!.winnerIds
    if (ids.includes(playerId)) w += 1 / ids.length
  }
  return w / games.length
}
function stats(games: GameState[]) {
  const clashes = games.map((g) => g.history.length)
  const rounds = games.map((g) => g.history.length / g.players.length)
  const ranOut = games.filter((g) => g.result!.reason === 'cards-ran-out').length
  const draws = games.filter((g) => g.result!.winnerIds.length > 1).length
  const ties = games.reduce((a, g) => a + g.history.filter((h) => !h.winnerId).length, 0)
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return {
    clashes: avg(clashes),
    rounds: avg(rounds),
    min: Math.min(...clashes),
    max: Math.max(...clashes),
    ranOut: ranOut / games.length,
    draws: draws / games.length,
    tieRate: ties / clashes.reduce((a, b) => a + b, 0),
  }
}

log('# FLIP CLASH playtest stats')
log()
log(`Simulated with the app's computer players, ${N.toLocaleString()} games per test.`)
log()

log('## Game shape (all Hard bots)')
log()
log('| Players | Clashes per game | Range | Ended by cards running out | Draws | Clashes that tie |')
log('|---|---|---|---|---|---|')
for (const n of [2, 3, 4]) {
  const s = stats(run(Array(n).fill('hard')))
  log(`| ${n} | ${s.clashes.toFixed(1)} | ${s.min}–${s.max} | ${pct(s.ranOut)} | ${pct(s.draws)} | ${pct(s.tieRate)} |`)
}
log()

log('## Turn order (all Hard bots) — win share by seat')
log()
log('| Players | Seat 1 (goes first) | Seat 2 | Seat 3 | Seat 4 | Fair share |')
log('|---|---|---|---|---|---|')
for (const n of [2, 3, 4]) {
  const g = run(Array(n).fill('hard'))
  const cells = [1, 2, 3, 4].map((s) => (s <= n ? pct(winShare(g, `p${s}`)) : '—'))
  log(`| ${n} | ${cells.join(' | ')} | ${pct(1 / n)} |`)
}
log()

log('## Difficulty levels (2 players, seats swapped half the time)')
log()
log('| Matchup | Stronger bot wins |')
log('|---|---|')
for (const [a, b] of [
  ['medium', 'easy'],
  ['hard', 'easy'],
  ['hard', 'medium'],
] as [Difficulty, Difficulty][]) {
  const g1 = run([a, b], N / 2)
  const g2 = run([b, a], N / 2)
  const share = (winShare(g1, 'p1') + winShare(g2, 'p2')) / 2
  log(`| ${cap(a)} vs ${cap(b)} | ${pct(share)} |`)
}
log()

log('## Difficulty levels (4 players: one stronger bot vs three Easy bots)')
log()
log('| Bot | Its win share | Fair share |')
log('|---|---|---|')
for (const lvl of ['easy', 'medium', 'hard'] as Difficulty[]) {
  let share = 0
  for (let seat = 1; seat <= 4; seat++) {
    const levels = Array(4).fill('easy') as Difficulty[]
    levels[seat - 1] = lvl
    share += winShare(run(levels, N / 4), `p${seat}`) / 4
  }
  log(`| ${cap(lvl)} | ${pct(share)} | 25.0% |`)
}
log()

log('## What the 3-card peek is worth (2 players, Hard vs Hard)')
log()
const withPeek = run(['hard', 'hard'], N / 2, { forgetPeeks: ['p2'] })
const withPeek2 = run(['hard', 'hard'], N / 2, { forgetPeeks: ['p1'] })
const peekShare = (winShare(withPeek, 'p1') + winShare(withPeek2, 'p2')) / 2
log(`A player who uses their peeks beats an identical player who ignores them **${pct(peekShare)}** of the time.`)
log()

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1)
}

mkdirSync('docs', { recursive: true })
writeFileSync('docs/playtest-stats.md', out.join('\n') + '\n')
