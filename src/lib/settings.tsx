import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { configureAudio } from './audio'
import { load, save } from './storage'

export interface Settings {
  sound: boolean
  volume: number // 0..1
  intensity: 'full' | 'subtle'
  reducedMotion: boolean
}

const DEFAULTS: Settings = { sound: false, volume: 0.6, intensity: 'full', reducedMotion: false }
const KEY = 'flipclash.settings.v1'

interface Ctx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  /** multiplier applied to animation durations */
  speed: number
  reduced: boolean
}

const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...load(KEY, {}) }))
  const [systemReduced, setSystemReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    setSystemReduced(mq.matches)
    const on = () => setSystemReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    save(KEY, settings)
  }, [settings])

  useEffect(() => {
    configureAudio(settings.sound, settings.volume)
  }, [settings.sound, settings.volume])

  const reduced = settings.reducedMotion || systemReduced
  const value = useMemo<Ctx>(
    () => ({
      settings,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      speed: reduced ? 0.01 : settings.intensity === 'subtle' ? 0.6 : 1,
      reduced,
    }),
    [settings, reduced],
  )

  return (
    <SettingsContext.Provider value={value}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings outside provider')
  return ctx
}
