import { useState } from 'react'
import { Backdrop, Button, ScreenHeader } from '../../components/ui'
import { load, save } from '../../lib/storage'
import { lastRoom } from '../../online/lastRoom'
import { normalizeCode, ROOM_CODE_LENGTH } from '../../online/protocol'
import { createRoom, onlineAvailable } from '../../online/useRoom'

const NAME_KEY = 'flipclash.onlineName.v1'

/** Create a room or join one with a code. */
export function OnlineScreen({
  initialCode,
  onBack,
  onEnter,
}: {
  initialCode?: string
  onBack: () => void
  onEnter: (code: string, name: string) => void
}) {
  const [name, setName] = useState(() => load(NAME_KEY, ''))
  const [code, setCode] = useState(initialCode ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cleanName = name.trim()
  const rejoin = lastRoom.get()
  const go = (c: string) => {
    save(NAME_KEY, cleanName)
    onEnter(c, cleanName)
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      go(await createRoom())
    } catch {
      setError('Couldn’t reach the game server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!onlineAvailable) {
    return (
      <main className="min-h-dvh">
        <Backdrop />
        <ScreenHeader title="Online" onBack={onBack} />
        <p className="mx-auto max-w-md p-4 text-steel-300">
          Online play isn’t switched on for this copy of the game yet. It needs the room server address
          (VITE_ROOM_SERVER) set when the app is built.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-dvh">
      <Backdrop />
      <ScreenHeader title="Online" onBack={onBack} />
      <div className="mx-auto flex max-w-md flex-col gap-5 p-4">
        <label className="cut-sm block bg-ink-800/90 px-4 py-3 ring-1 ring-steel-400/20">
          <span className="block font-display text-xs font-semibold tracking-widest text-steel-400 uppercase">Your name</span>
          <input
            value={name}
            maxLength={14}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name"
            className="mt-1 w-full bg-transparent font-display text-xl font-semibold text-white placeholder:text-steel-500 focus:outline-none"
          />
        </label>

        {rejoin && rejoin.code !== initialCode && (
          <Button variant="primary" className="w-full" onClick={() => onEnter(rejoin.code, rejoin.name)}>
            Rejoin room {rejoin.code}
          </Button>
        )}

        <section className="cut bg-ink-800/90 p-4 ring-1 ring-steel-400/20">
          <h2 className="font-display text-lg font-bold tracking-wide text-white uppercase">Join a game</h2>
          <p className="mt-1 text-sm text-steel-300">Enter the 4-letter code from the host’s screen.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === ROOM_CODE_LENGTH && cleanName) go(code)
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="ABCD"
              aria-label="Room code"
              autoCapitalize="characters"
              autoComplete="off"
              className="cut-sm min-h-12 w-36 bg-ink-950/70 px-3 text-center font-display text-2xl font-bold tracking-[0.35em] text-white uppercase ring-1 ring-steel-400/30 placeholder:text-steel-600 focus:ring-clash-400 focus:outline-none"
            />
            <Button
              type="submit"
              variant={code.length === ROOM_CODE_LENGTH ? 'primary' : 'metal'}
              className="flex-1"
              disabled={code.length !== ROOM_CODE_LENGTH || !cleanName}
            >
              Join
            </Button>
          </form>
        </section>

        <section className="cut bg-ink-800/90 p-4 ring-1 ring-steel-400/20">
          <h2 className="font-display text-lg font-bold tracking-wide text-white uppercase">Host a game</h2>
          <p className="mt-1 text-sm text-steel-300">
            Get a code to share. Friends join on their own phones — add computer players for any empty seats.
          </p>
          <Button className="mt-3 w-full" disabled={!cleanName || busy} onClick={create}>
            {busy ? 'Creating…' : 'Create a room'}
          </Button>
        </section>

        {!cleanName && <p className="text-sm text-steel-400">Type your name first.</p>}
        {error && <p className="text-sm text-clash-400">{error}</p>}
      </div>
    </main>
  )
}
