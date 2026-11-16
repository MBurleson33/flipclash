// Tiny synthesized sound effects (original, no files, no licensing).
// Muted by default; the AudioContext is only created after the player turns sound on.
export type Sfx = 'flip' | 'select' | 'clash' | 'win' | 'capture' | 'victory' | 'tie'

let ctx: AudioContext | null = null
let enabled = false
let volume = 0.6

export function configureAudio(on: boolean, vol: number) {
  enabled = on
  volume = vol
  if (on && !ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      ctx = null
    }
  }
  if (on && ctx?.state === 'suspended') void ctx.resume()
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.2, slideTo?: number) {
  if (!ctx) return
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain * volume, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function play(sfx: Sfx) {
  if (!enabled || !ctx) return
  switch (sfx) {
    case 'flip':
      tone(900, 0, 0.08, 'triangle', 0.15, 300)
      break
    case 'select':
      tone(660, 0, 0.07, 'sine', 0.15)
      break
    case 'clash':
      tone(110, 0, 0.25, 'sawtooth', 0.18, 55)
      tone(220, 0.02, 0.15, 'square', 0.06, 90)
      break
    case 'win':
      tone(523, 0, 0.12, 'triangle', 0.18)
      tone(784, 0.1, 0.18, 'triangle', 0.18)
      break
    case 'capture':
      tone(1046, 0, 0.1, 'sine', 0.12)
      tone(1318, 0.08, 0.14, 'sine', 0.12)
      break
    case 'tie':
      tone(300, 0, 0.18, 'triangle', 0.15, 280)
      break
    case 'victory':
      ;[523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.18))
      break
  }
}
