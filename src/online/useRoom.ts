// Connection to a room on the FLIP CLASH server, with automatic reconnecting.
import { useCallback, useEffect, useRef, useState } from 'react'
import { load, save } from '../lib/storage'
import type { ClientMessage, RoomSnapshot, ServerMessage } from './protocol'

/** Where the room server lives. Set VITE_ROOM_SERVER at build time (e.g. in Vercel). */
export const ROOM_SERVER: string | null = (import.meta.env.VITE_ROOM_SERVER as string | undefined)?.replace(/\/$/, '') || null

export const onlineAvailable = !!ROOM_SERVER

/** A random id for this device, so the server can give you your seat back after a reconnect. */
export function deviceToken(): string {
  let t = load<string | null>('flipclash.device.v1', null)
  if (!t) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    t = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    save('flipclash.device.v1', t)
  }
  return t
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${ROOM_SERVER}/rooms`, { method: 'POST' })
  if (!res.ok) throw new Error('Could not create a room')
  const body = (await res.json()) as { code: string }
  return body.code
}

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed'

export function useRoom(code: string, name: string) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [conn, setConn] = useState<ConnectionState>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const stopped = useRef(false)

  useEffect(() => {
    stopped.current = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const token = deviceToken()

    const connect = () => {
      const url = `${ROOM_SERVER!.replace(/^http/, 'ws')}/rooms/${code}/ws`
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => {
        attempt = 0
        setConn('open')
        ws.send(JSON.stringify({ t: 'hello', token, name } satisfies ClientMessage))
      }
      ws.onmessage = (e) => {
        let msg: ServerMessage
        try {
          msg = JSON.parse(e.data)
        } catch {
          return
        }
        if (msg.t === 'room') {
          setRoom(msg.room)
          setError(null)
        } else if (msg.t === 'error') {
          if (msg.fatal) {
            setFatal(msg.message)
            stopped.current = true
          } else setError(msg.message)
        }
      }
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null
        if (stopped.current) {
          setConn('closed')
          return
        }
        setConn('reconnecting')
        attempt++
        timer = setTimeout(connect, Math.min(8000, 500 * 2 ** Math.min(attempt, 4)))
      }
    }
    connect()

    // Reconnect right away when the phone wakes up or comes back online.
    const wake = () => {
      if (document.visibilityState === 'visible' && !wsRef.current && !stopped.current) {
        if (timer) clearTimeout(timer)
        connect()
      }
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)

    return () => {
      stopped.current = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      wsRef.current?.close()
    }
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  return { room, conn, error, fatal, send, clearError: () => setError(null) }
}
