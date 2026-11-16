# FLIP CLASH playtest stats

Simulated with the app's computer players, 4,000 games per test.

## Game shape (all Hard bots)

| Players | Clashes per game | Range | Ended by cards running out | Draws | Clashes that tie |
|---|---|---|---|---|---|
| 2 | 6.2 | 4–9 | 1.3% | 0.0% | 7.9% |
| 3 | 9.4 | 6–13 | 0.5% | 0.0% | 7.0% |
| 4 | 12.1 | 8–17 | 0.0% | 0.0% | 7.0% |

## Turn order (all Hard bots) — win share by seat

| Players | Seat 1 (goes first) | Seat 2 | Seat 3 | Seat 4 | Fair share |
|---|---|---|---|---|---|
| 2 | 50.0% | 50.0% | — | — | 50.0% |
| 3 | 30.4% | 33.1% | 36.5% | — | 33.3% |
| 4 | 23.0% | 23.6% | 26.6% | 26.8% | 25.0% |

## Difficulty levels (2 players, seats swapped half the time)

| Matchup | Stronger bot wins |
|---|---|
| Medium vs Easy | 56.7% |
| Hard vs Easy | 58.8% |
| Hard vs Medium | 52.2% |

## Difficulty levels (4 players: one stronger bot vs three Easy bots)

| Bot | Its win share | Fair share |
|---|---|---|
| Easy | 25.0% | 25.0% |
| Medium | 32.5% | 25.0% |
| Hard | 33.3% | 25.0% |

## What the 3-card peek is worth (2 players, Hard vs Hard)

A player who uses their peeks beats an identical player who ignores them **57.5%** of the time.

## Notes

- **Turn order:** 2-player games are dead even. In 3–4 player games the small seat differences depend on *how* players pick opponents, not on the rules: with random targeting (Easy bots) going first is a slight edge (26.6% in 4-player); when everyone picks on the player with the fewest prizes (Medium/Hard bots), the last seat gets the edge (28.6%). Worth watching in real games, but there's no built-in turn-order bias.
- **Skill vs luck:** because both cards are chosen blind, the main skill is remembering your peeks — play known high cards, hold known low cards. That alone is about a 60/40 edge. Card counting and opponent choice add a little more on top (Hard vs Medium). Hard is deliberately tuned to slip up 10% of the time so it stays beatable.
- **Game length:** a 2-player game is about 6 clashes (each player uses only ~6 of their 9 cards), so games are quick and the cards almost never run out.

Regenerate with `npm run playtest` (set `GAMES=10000` for more precision).
