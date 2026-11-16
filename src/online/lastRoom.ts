// Remember the room you're in, so reopening the app offers a one-tap rejoin.
import { load, remove, save } from '../lib/storage'

const KEY = 'flipclash.lastRoom.v1'
const MAX_AGE = 6 * 60 * 60 * 1000 // 6 hours

interface LastRoom {
  code: string
  name: string
  at: number
}

export const lastRoom = {
  get(): LastRoom | null {
    const r = load<LastRoom | null>(KEY, null)
    return r && Date.now() - r.at < MAX_AGE ? r : null
  },
  set(code: string, name: string) {
    save(KEY, { code, name, at: Date.now() })
  },
  clear() {
    remove(KEY)
  },
}
