import { Backdrop, ScreenHeader } from '../components/ui'
import { useSettings } from '../lib/settings'
import { play } from '../lib/audio'
import { Toggle } from './game/parts'

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, update } = useSettings()
  return (
    <main className="min-h-dvh">
      <Backdrop />
      <ScreenHeader title="Settings" onBack={onBack} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <section className="cut bg-ink-800/90 p-4 ring-1 ring-steel-400/20">
          <h2 className="mb-2 font-display text-sm font-semibold tracking-widest text-steel-400 uppercase">Audio</h2>
          <Toggle
            label="Sound effects"
            on={settings.sound}
            onChange={(v) => {
              update({ sound: v })
              if (v) setTimeout(() => play('capture'), 60)
            }}
          />
          <label className="mt-3 flex items-center gap-4 px-1">
            <span className="font-display font-semibold text-steel-100">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              disabled={!settings.sound}
              onChange={(e) => update({ volume: Number(e.target.value) })}
              onPointerUp={() => play('select')}
              className="flex-1 accent-[#e8231a] disabled:opacity-40"
              aria-label="Game volume"
            />
          </label>
        </section>

        <section className="cut bg-ink-800/90 p-4 ring-1 ring-steel-400/20">
          <h2 className="mb-2 font-display text-sm font-semibold tracking-widest text-steel-400 uppercase">Motion</h2>
          <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Animation intensity">
            {(['full', 'subtle'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={settings.intensity === v}
                onClick={() => update({ intensity: v })}
                className={`cut-sm min-h-11 font-display font-semibold tracking-wide uppercase ${
                  settings.intensity === v ? 'bg-clash-500 text-white' : 'bg-ink-700 text-steel-200'
                }`}
              >
                {v === 'full' ? 'Full' : 'Subtle & quick'}
              </button>
            ))}
          </div>
          <Toggle label="Reduced motion" on={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
          <p className="mt-2 px-1 text-xs text-steel-400">Reduced motion is also turned on automatically if your device asks for it.</p>
        </section>

        <p className="px-1 text-sm text-steel-400">Restart game and Main menu are in the pause menu (☰) during a game.</p>
      </div>
    </main>
  )
}
