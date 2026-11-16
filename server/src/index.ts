// FLIP CLASH room server — a Cloudflare Worker with one Durable Object per room.
//   POST /rooms               → { code }  create a room
//   GET  /rooms/:code/ws      → WebSocket into that room
//   GET  /health              → "ok"
import { normalizeCode, ROOM_CODE_LENGTH, ROOM_CODE_LETTERS } from '../../src/online/protocol'
import { Room } from './room'

export { Room }

export interface Env {
  ROOMS: DurableObjectNamespace<Room>
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH))
  return Array.from(bytes, (b) => ROOM_CODE_LETTERS[b % ROOM_CODE_LETTERS.length]).join('')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (url.pathname === '/health') return new Response('ok', { headers: CORS })

    if (url.pathname === '/rooms' && request.method === 'POST') {
      // Find an unused code (a few tries is plenty with 330k codes).
      for (let i = 0; i < 8; i++) {
        const code = randomCode()
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code))
        const created = await stub.init(code)
        if (created) return json({ code })
      }
      return json({ error: 'Could not create a room, try again.' }, 503)
    }

    const m = url.pathname.match(/^\/rooms\/([A-Za-z]+)\/ws$/)
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket' }, 426)
      const code = normalizeCode(m[1])
      if (code.length !== ROOM_CODE_LENGTH) return json({ error: 'Bad room code' }, 400)
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code))
      return stub.fetch(request)
    }

    return json({ error: 'Not found' }, 404)
  },
} satisfies ExportedHandler<Env>
