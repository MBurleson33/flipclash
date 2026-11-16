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
import { OnlineScreen } from './screens/online/OnlineScreen'
import { RoomScreen } from './screens/online/RoomScreen'
import { normalizeCode } from './online/protocol'

export type Screen = 'home' | 'modes' | 'setup' | 'game' | 'how' | 'gallery' | 'settings' | 'online' | 'room'

export default function App() {
  // An invite link (?room=ABCD) opens straight to the join screen.
  const [inviteCode] = useState(() => normalizeCode(new URLSearchParams(location.search).get('room') ?? ''))
  const [screen, setScreen] = useState<Screen>(inviteCode ? 'online' : 'home')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [roomName, setRoomName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [setupMode, setSetupMode] = useState<'local' | 'ai'>('local')
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
      return (
        <ModeScreen
          onBack={() => go('home')}
          onPick={(m) => {
            if (m === 'online') return go('online')
            setSetupMode(m)
            go('setup')
          }}
        />
      )
    case 'setup':
      return (
        <SetupScreen
          key={setupMode}
          mode={setupMode}
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
    case 'online':
      return (
        <>
          <OnlineScreen
            initialCode={inviteCode || undefined}
            onBack={() => {
              if (inviteCode) history.replaceState(null, '', location.pathname)
              go('modes')
            }}
            onEnter={(code, name) => {
              setRoomCode(code)
              setRoomName(name)
              setNotice(null)
              if (location.search) history.replaceState(null, '', location.pathname)
              go('room')
            }}
          />
          {notice && (
            <div className="fixed inset-x-0 bottom-6 flex justify-center px-4" role="status">
              <p className="cut-sm bg-ink-700 px-4 py-2.5 text-sm text-steel-100 ring-1 ring-steel-400/30">{notice}</p>
            </div>
          )}
        </>
      )
    case 'room':
      return roomCode ? (
        <RoomScreen
          code={roomCode}
          name={roomName}
          onExit={(message) => {
            setNotice(message ?? null)
            go('online')
          }}
        />
      ) : null
    case 'gallery':
      return <GalleryScreen onBack={() => go('home')} />
    case 'settings':
      return <SettingsScreen onBack={() => go('home')} />
    default:
      return <HomeScreen hasSave={!!game} onNav={go} onResume={() => go('game')} />
  }
}
