// One Durable Object per room. It owns the only copy of the full game state, runs the same
// rules engine as the app, and sends each device only that player's view.
import { DurableObject } from 'cloudflare:workers'
import {
  applyAction,
  createGame,
  pendingDeciders,
  randomSeed,
  RULES,
  viewFor,
  type GameState,
} from '../../src/engine'
import { botAct, type BotMemory } from '../../src/ai/bot'
import {
  BOT_NAMES,
  type ClientMessage,
  type RoomSnapshot,
  type SeatKind,
  type ServerMessage,
} from '../../src/online/protocol'

interface Member {
  token: string
  name: string
  seat: number | null
}

interface RoomData {
  code: string
  createdAt: number
  updatedAt: number
  hostToken: string | null
  seats: SeatKind[]
  members: Member[]
  game: GameState | null
  botMemory: Record<string, BotMemory>
  readyNext: string[]
  revealEndsAt: number | null
}

interface Attachment {
  token: string | null
}

const REVEAL_MS = 6500 // a clash moves on by itself after this long
const BOT_DELAY = { peek: 500, choose: 900, select: 1100 }
const EXPIRE_MS = 3 * 24 * 60 * 60 * 1000 // idle rooms are deleted after 3 days
const MAX_MESSAGE = 4096

export class Room extends DurableObject {
  private data: RoomData | null = null
  private loaded = false

  // ---------- storage ----------

  private async load(): Promise<RoomData | null> {
    if (!this.loaded) {
      this.data = (await this.ctx.storage.get<RoomData>('room')) ?? null
      this.loaded = true
    }
    return this.data
  }

  private async save() {
    if (!this.data) return
    this.data.updatedAt = Date.now()
    await this.ctx.storage.put('room', this.data)
  }

  /** Called by the Worker when creating a room. Returns false if the code is taken. */
  async init(code: string): Promise<boolean> {
    if (await this.load()) return false
    this.data = {
      code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hostToken: null,
      seats: ['human', 'human'],
      members: [],
      game: null,
      botMemory: {},
      readyNext: [],
      revealEndsAt: null,
    }
    await this.save()
    await this.schedule()
    return true
  }

  // ---------- connections ----------

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ token: null } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE) return
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    const data = await this.load()
    if (!data) {
      this.send(ws, { t: 'error', message: 'That room doesn’t exist. Check the code and try again.', fatal: true })
      ws.close(4004, 'Room not found')
      return
    }

    const att = ws.deserializeAttachment() as Attachment
    if (msg.t === 'hello') {
      const token = String(msg.token ?? '').slice(0, 64)
      const name = cleanName(msg.name)
      if (!token) return
      let member = data.members.find((m) => m.token === token)
      if (!member) {
        member = { token, name: name || `Player ${data.members.length + 1}`, seat: null }
        data.members.push(member)
        if (!data.hostToken) data.hostToken = token
      } else if (name && !data.game) {
        member.name = name
      }
      ws.serializeAttachment({ token } satisfies Attachment)
      if (!data.game) this.reseat()
      await this.save()
      this.broadcast()
      return
    }

    const member = att.token ? data.members.find((m) => m.token === att.token) : undefined
    if (!member) return this.send(ws, { t: 'error', message: 'Reconnecting…' })
    const isHost = this.effectiveHost() === member.token
    const fail = (message: string) => this.send(ws, { t: 'error', message })

    switch (msg.t) {
      case 'setup': {
        if (!isHost) return fail('Only the host can change seats.')
        if (data.game) return fail('The game has already started.')
        const kinds = (Array.isArray(msg.seats) ? msg.seats : []).slice(0, RULES.maxPlayers)
        if (kinds.length < RULES.minPlayers) return fail(`Pick ${RULES.minPlayers}–${RULES.maxPlayers} seats.`)
        if (!kinds.every((k) => ['human', 'easy', 'medium', 'hard'].includes(k))) return fail('Bad seat type.')
        data.seats = kinds
        // Anyone sitting in a seat that's gone or turned into a computer player stands up.
        for (const m of data.members) {
          if (m.seat !== null && (m.seat >= kinds.length || kinds[m.seat] !== 'human')) m.seat = null
        }
        this.reseat()
        break
      }

      case 'start': {
        if (!isHost) return fail('Only the host can start.')
        if (data.game) return fail('Already started.')
        const open = data.seats.some((k, i) => k === 'human' && !data.members.some((m) => m.seat === i))
        if (open) return fail('Waiting for every human seat to be filled.')
        this.newGame()
        break
      }

      case 'rematch': {
        if (!isHost) return fail('Only the host can start a new game.')
        if (!data.game || data.game.phase !== 'finished') return fail('The game isn’t over yet.')
        this.newGame(data.game)
        break
      }

      case 'act': {
        if (!data.game) return fail('The game hasn’t started.')
        if (member.seat === null) return fail('You’re watching this game.')
        const playerId = data.game.players[member.seat].id
        if (data.game.players[member.seat].bot) return fail('A computer player has your seat.')
        const action = { ...msg.action, playerId } as typeof msg.action
        if (action.type === 'NEXT_TURN') return fail('Use next.')
        const r = applyAction(data.game, action)
        if (!r.ok) return fail(r.error)
        this.setGame(r.state)
        break
      }

      case 'next': {
        const g = data.game
        if (!g || g.phase !== 'reveal' || member.seat === null) return
        const id = g.players[member.seat].id
        if (!data.readyNext.includes(id)) data.readyNext.push(id)
        // Move on as soon as every connected human has tapped Next.
        const waiting = this.connectedHumanIds().filter((pid) => !data.readyNext.includes(pid))
        if (waiting.length === 0) this.advance()
        break
      }

      case 'botTakeover': {
        if (!isHost) return fail('Only the host can do that.')
        const g = data.game
        const seat = Number(msg.seat)
        if (!g || !g.players[seat] || g.players[seat].bot) return
        g.players[seat].bot = 'medium'
        data.seats[seat] = 'medium'
        for (const m of data.members) if (m.seat === seat) m.seat = null
        break
      }

      case 'leave': {
        data.members = data.members.filter((m) => m.token !== member.token)
        if (data.hostToken === member.token) data.hostToken = data.members[0]?.token ?? null
        if (!data.game) this.reseat()
        ws.close(1000, 'Left')
        break
      }

      default:
        return
    }

    await this.save()
    await this.schedule()
    this.broadcast()
  }

  async webSocketClose(ws: WebSocket) {
    try {
      ws.close()
    } catch {
      /* already closed */
    }
    if (await this.load()) this.broadcast()
  }

  async webSocketError() {
    if (await this.load()) this.broadcast()
  }

  // ---------- game flow ----------

  private newGame(previous?: GameState) {
    const data = this.data!
    const players = data.seats.map((kind, i) => {
      if (kind === 'human') {
        const m = data.members.find((x) => x.seat === i)
        return { name: m?.name ?? `Player ${i + 1}`, bot: null }
      }
      return { name: previous?.players[i]?.name ?? BOT_NAMES[i], bot: kind }
    })
    data.botMemory = {}
    this.setGame(createGame(players, randomSeed(), { simultaneous: true }))
  }

  private setGame(next: GameState) {
    const data = this.data!
    const enteringReveal = next.phase === 'reveal' && data.game?.phase !== 'reveal'
    data.game = next
    if (enteringReveal) {
      data.readyNext = []
      data.revealEndsAt = Date.now() + REVEAL_MS
    } else if (next.phase !== 'reveal') {
      data.revealEndsAt = null
    }
  }

  private advance() {
    const data = this.data!
    if (!data.game || data.game.phase !== 'reveal') return
    const r = applyAction(data.game, { type: 'NEXT_TURN' })
    if (r.ok) this.setGame(r.state)
  }

  private botDeciders(): string[] {
    const g = this.data?.game
    if (!g) return []
    return pendingDeciders(g).filter((id) => g.players.find((p) => p.id === id)?.bot)
  }

  /** One alarm drives everything time-based: bot moves, clash auto-advance, room expiry. */
  private async schedule() {
    const data = this.data
    if (!data) return
    const g = data.game
    let at = data.updatedAt + EXPIRE_MS
    if (g && g.phase === 'reveal' && data.revealEndsAt) at = Math.min(at, data.revealEndsAt)
    else if (g && this.botDeciders().length) {
      const delay = g.phase === 'peek' ? BOT_DELAY.peek : g.phase === 'choose-opponent' ? BOT_DELAY.choose : BOT_DELAY.select
      at = Math.min(at, Date.now() + delay)
    }
    await this.ctx.storage.setAlarm(at)
  }

  async alarm() {
    const data = await this.load()
    if (!data) return
    const now = Date.now()
    if (now - data.updatedAt >= EXPIRE_MS && this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll()
      this.data = null
      return
    }
    const g = data.game
    if (g && g.phase === 'reveal') {
      if (data.revealEndsAt && now >= data.revealEndsAt) this.advance()
    } else if (g) {
      const bots = this.botDeciders()
      if (bots.length) {
        const id = bots[Math.floor(Math.random() * bots.length)]
        const p = g.players.find((x) => x.id === id)!
        const turn = botAct(g, id, p.bot!, data.botMemory[id] ?? {})
        if (turn) {
          data.botMemory[id] = turn.memory
          const r = applyAction(g, turn.action)
          if (r.ok) this.setGame(r.state)
        }
      }
    }
    await this.save()
    await this.schedule()
    this.broadcast()
  }

  // ---------- helpers ----------

  /** The host runs the room — but if the host's phone is offline, the first connected player stands in. */
  private effectiveHost(): string | null {
    const data = this.data!
    const online = this.connectedTokens()
    if (data.hostToken && online.has(data.hostToken)) return data.hostToken
    return data.members.find((m) => online.has(m.token))?.token ?? data.hostToken
  }

  /** Seat lobby members (in join order) into open human seats. */
  private reseat() {
    const data = this.data!
    for (const m of data.members) {
      if (m.seat !== null) continue
      const open = data.seats.findIndex((k, i) => k === 'human' && !data.members.some((x) => x.seat === i))
      if (open < 0) break
      m.seat = open
    }
  }

  private connectedTokens(): Set<string> {
    const set = new Set<string>()
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.READY_STATE_OPEN) continue // closing sockets still show up here
      const att = ws.deserializeAttachment() as Attachment | null
      if (att?.token) set.add(att.token)
    }
    return set
  }

  private connectedHumanIds(): string[] {
    const data = this.data!
    const g = data.game
    if (!g) return []
    const online = this.connectedTokens()
    return data.members
      .filter((m) => m.seat !== null && online.has(m.token) && !g.players[m.seat].bot)
      .map((m) => g.players[m.seat!].id)
  }

  private snapshotFor(token: string | null): RoomSnapshot {
    const data = this.data!
    const online = this.connectedTokens()
    const me = token ? data.members.find((m) => m.token === token) : undefined
    const g = data.game
    const seats = data.seats.map((kind, i) => {
      const m = data.members.find((x) => x.seat === i)
      const botName = g?.players[i]?.name ?? BOT_NAMES[i]
      return {
        kind,
        name: kind === 'human' ? (m?.name ?? '') : botName,
        connected: kind === 'human' ? !!m && online.has(m.token) : true,
        open: kind === 'human' && !m,
      }
    })
    const playerId = g && me?.seat != null ? g.players[me.seat].id : null
    return {
      code: data.code,
      you: { seat: me?.seat ?? null, isHost: !!me && this.effectiveHost() === me.token, playerId },
      seats,
      started: !!g,
      view: g ? viewFor(g, playerId) : null,
      readyNext: data.readyNext,
      revealEndsAt: data.revealEndsAt,
    }
  }

  private broadcast() {
    if (!this.data) return
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.READY_STATE_OPEN) continue
      const att = ws.deserializeAttachment() as Attachment | null
      if (!att?.token) continue
      this.send(ws, { t: 'room', room: this.snapshotFor(att.token) })
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* socket closed */
    }
  }
}

function cleanName(raw: unknown) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 14)
}
