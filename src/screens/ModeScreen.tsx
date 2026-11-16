import { Backdrop, ScreenHeader } from '../components/ui'
import { play } from '../lib/audio'
import { onlineAvailable } from '../online/useRoom'

const MODES = [
  { id: 'local', title: 'Local multiplayer', desc: '2–4 players pass one device around.', ready: true },
  { id: 'ai', title: 'Vs computer', desc: 'Play Easy, Medium or Hard computer opponents.', ready: true },
  { id: 'online', title: 'Online', desc: 'Everyone on their own phone. Share a room code.', ready: onlineAvailable },
]

export function ModeScreen({ onBack, onPick }: { onBack: () => void; onPick: (m: 'local' | 'ai' | 'online') => void }) {
  return (
    <main className="min-h-dvh">
      <Backdrop />
      <ScreenHeader title="Choose a mode" onBack={onBack} />
      <div className="mx-auto grid max-w-3xl gap-4 p-4 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!m.ready}
            onClick={() => {
              play('select')
              onPick(m.id as 'local' | 'ai' | 'online')
            }}
            className="cut group relative flex min-h-40 flex-col justify-end bg-gradient-to-b from-ink-700/90 to-ink-900/90 p-5 text-left ring-1 ring-steel-400/25 transition enabled:hover:ring-clash-400/70 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {!m.ready && (
              <span className="cut-sm absolute top-4 right-4 bg-ink-600 px-2 py-1 font-display text-[11px] font-semibold tracking-widest text-steel-300 uppercase">
                Coming soon
              </span>
            )}
            {m.ready && (
              <span className="cut-sm absolute top-4 right-4 bg-clash-500 px-2 py-1 font-display text-[11px] font-semibold tracking-widest text-white uppercase">
                Play
              </span>
            )}
            <span className="font-display text-xl font-bold tracking-wide text-white uppercase">{m.title}</span>
            <span className="mt-1 text-sm text-steel-300">{m.desc}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
