import { useState } from 'react'
import type { GameState } from './engine'
import { load, remove } from './lib/storage'
import { HomeScreen } from './screens/HomeScreen'
import { ModeScreen } from './screens/ModeScreen'
import { SetupScreen } from './screens/SetupScreen'
import { GameScreen, SAVE_KEY } from './screens/GameScreen'
import { GalleryScreen } from './screens/GalleryScreen'
import { HowToPlayScreen } from './screens/HowToPlayScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export type Screen = 'home' | 'modes' | 'setup' | 'game' | 'how' | 'gallery' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [game, setGame] = useState<GameState | null>(() => {
    const saved = load<GameState | null>(SAVE_KEY, null)
    return saved && saved.version === 1 && saved.phase !== 'finished' ? saved : null
  })

  const go = (s: Screen) => {
    setScreen(s)
    window.scrollTo(0, 0)
  }

  switch (screen) {
    case 'modes':
      return <ModeScreen onBack={() => go('home')} onLocal={() => go('setup')} />
    case 'setup':
      return (
        <SetupScreen
          onBack={() => go('modes')}
          onStart={(g) => {
            setGame(g)
            go('game')
          }}
        />
      )
    case 'game':
      return game ? (
        <GameScreen
          key={game.seed}
          initial={game}
          onExit={(keep) => {
            if (!keep) {
              remove(SAVE_KEY)
              setGame(null)
            }
            go('home')
          }}
          onRestart={(g) => setGame(g)}
          onHowToPlay={() => go('how')}
          onSaved={setGame}
        />
      ) : (
        <HomeScreen hasSave={false} onNav={go} onResume={() => {}} />
      )
    case 'how':
      return <HowToPlayScreen onBack={() => go(game ? 'game' : 'home')} backLabel={game ? 'game' : 'home'} />
    case 'gallery':
      return <GalleryScreen onBack={() => go('home')} />
    case 'settings':
      return <SettingsScreen onBack={() => go('home')} />
    default:
      return <HomeScreen hasSave={!!game} onNav={go} onResume={() => go('game')} />
  }
}
