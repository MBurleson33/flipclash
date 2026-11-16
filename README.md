# FLIP CLASH

The card game by Beckett & Archer — browser edition (React + TypeScript + Vite + Tailwind + Motion).

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # game-engine tests (Vitest)
npm run playtest # thousands of bot-vs-bot games → docs/playtest-stats.md
npm run build    # production build in dist/ — deploy to Vercel, Cloudflare Pages or GitHub Pages
```

## Official rules (v1)

- **Deck:** 65 cards — red, blue, green, yellow, purple, each numbered 1–13. Color is art only.
- **Players:** 2–4. Each player has their own diamond board: 9 card spots + 4 prize spots around the middle card.
- **Setup:** shuffle; deal 9 cards face down to each player. Prize spots start empty. Leftover cards are not used.
- **Peek:** before play, each player secretly looks at 3 of their own cards and puts them back face down. No looking again.
- **Turn:** the active player picks an opponent (auto with 2 players). Each secretly picks one of their own face-down cards; both flip at once.
- **Clash:** higher number wins and puts the loser's card in one of the winner's prize spots. The winner's card stays face up and can't clash again; the loser's spot stays empty. **Tie:** nobody wins, both cards stay face up, used.
- **Turn order:** clockwise. Players with no face-down cards left are skipped and can't be picked.
- **Winning:** first to fill all 4 prize spots wins immediately. If clashes run out (fewer than two players with face-down cards): most prizes wins, then highest total of captured numbers, otherwise a draw.

Rule constants live in `src/engine/rules.ts`; all logic in `src/engine/engine.ts`.

## Computer players

`src/ai/bot.ts`. A bot only gets `viewFor(state, botId)` plus its memory of the 3 cards it peeked at — never the raw state.

- **Easy** — random legal moves.
- **Medium** — plays known high cards first and saves known low cards, but 40% of the time it forgets its peeks.
- **Hard** — uses its peeks (slipping up about 10% of the time, so it's beatable), counts every revealed card to work out the odds, plays harder when a win or loss would end the game, and avoids feeding a player who is one prize from winning.

Mix humans and bots in **Play → Vs computer**. With only one human there are no pass-the-device screens.

## Adding artwork

Drop files into `src/assets/cards/` and rebuild — they're picked up automatically:

```
red-01.png … red-13.png   blue-…   green-…   yellow-…   purple-…   card-back.jpg
```

Logo: `src/assets/brand/flip-clash-logo.png`.
Background: `src/assets/brand/background.jpg`. Any card without a file uses the placeholder design.

## Structure

```
src/ai/        computer players + bot-vs-bot simulator
scripts/       playtest.ts (statistics)
src/engine/    pure game engine (no React): types, rules, seeded RNG, reducer, player views, tests
src/components Board (exact diamond on a 5×5 grid), FlipCard (3D flip), CardFace, dialogs & UI
src/screens/   Home, Mode, Setup, Game (pass-and-play), Gallery, How to Play, Settings
src/lib/       art manifest, settings, synthesized sound effects, safe storage
```

The engine is `applyAction(state, action) → state` with a seeded shuffle, and the UI only renders `viewFor(state, player)`, which strips hidden information. Computer players use that same interface, and online play can too.
