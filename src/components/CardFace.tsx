import type { Card, CardColor } from '../engine'
import { artFor } from '../lib/art'

export const COLOR_HEX: Record<CardColor, string> = {
  red: '#e8231a',
  blue: '#1f7bff',
  green: '#22c55e',
  yellow: '#f5b70a',
  purple: '#8b4dff',
}

export const COLOR_LABEL: Record<CardColor, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
  purple: 'Purple',
}

export function cardLabel(card: Card) {
  return `${COLOR_LABEL[card.color]} ${card.number}`
}

const backArt = artFor('card-back')

/** Official card back (falls back to a drawn back if the file is missing). */
export function CardBack({ className = '' }: { className?: string }) {
  if (backArt) {
    return (
      <div className={`card-shape relative h-full w-full overflow-hidden bg-ink-900 ${className}`}>
        <img src={backArt} alt="" draggable={false} className="h-full w-full object-cover select-none" />
      </div>
    )
  }
  return (
    <div
      className={`card-shape grid h-full w-full place-items-center bg-gradient-to-b from-steel-300 to-steel-500 p-[5%] ${className}`}
    >
      <div className="card-shape grid h-full w-full place-items-center bg-ink-900">
        <span className="font-display text-[22cqw] font-bold italic text-clash-500">FC</span>
      </div>
    </div>
  )
}

/** Card front: official art when present, otherwise the placeholder design. */
export function CardFront({ card, className = '' }: { card: Card; className?: string }) {
  const art = artFor(card.id)
  if (art) {
    return (
      <div className={`card-shape relative h-full w-full overflow-hidden bg-ink-900 ${className}`}>
        <img src={art} alt={cardLabel(card)} draggable={false} className="h-full w-full object-cover select-none" />
      </div>
    )
  }
  const hex = COLOR_HEX[card.color]
  return (
    <div
      className={`card-shape relative h-full w-full p-[4.5%] ${className}`}
      style={{ background: 'linear-gradient(160deg,#f4f6f8 0%,#9aa2ab 30%,#e8ecef 50%,#6d747d 75%,#d9dee3 100%)' }}
      role="img"
      aria-label={cardLabel(card)}
    >
      <div
        className="card-shape relative h-full w-full overflow-hidden"
        style={{
          background: `radial-gradient(90% 60% at 50% 45%, ${hex}55, transparent 70%),
            linear-gradient(125deg, transparent 30%, ${hex}33 45%, transparent 55%),
            linear-gradient(200deg, transparent 55%, ${hex}26 65%, transparent 75%),
            linear-gradient(180deg, #16181d, #0a0b0e)`,
        }}
      >
        {/* corner index */}
        <div
          className="cut-sm absolute top-[4%] left-[5%] grid aspect-square w-[24%] place-items-center font-display font-bold text-white"
          style={{ background: hex, fontSize: '13cqw', lineHeight: 1 }}
        >
          {card.number}
        </div>
        <div
          className="absolute right-[5%] bottom-[4%] grid aspect-square w-[24%] rotate-180 place-items-center font-display font-bold text-white cut-sm"
          style={{ background: hex, fontSize: '13cqw', lineHeight: 1 }}
          aria-hidden
        >
          {card.number}
        </div>
        {/* big number */}
        <div className="absolute inset-0 grid place-items-center" aria-hidden>
          <span
            className="font-display font-bold italic"
            style={{
              fontSize: card.number >= 10 ? '44cqw' : '56cqw',
              lineHeight: 1,
              color: '#fff',
              textShadow: `0 0 6cqw ${hex}, 0 0.8cqw 0 ${hex}`,
              WebkitTextStroke: `0.6cqw ${hex}`,
            }}
          >
            {card.number}
          </span>
        </div>
        <div
          className="absolute bottom-[6%] left-[8%] font-display font-semibold tracking-wider text-steel-200 uppercase"
          style={{ fontSize: '7cqw' }}
          aria-hidden
        >
          {COLOR_LABEL[card.color]}
        </div>
      </div>
    </div>
  )
}

/** Wrapper that establishes the 5:7 ratio and a container for cqw sizing. */
export function CardBox({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative aspect-[5/7] w-full ${className}`} style={{ containerType: 'inline-size' }}>
      {children}
    </div>
  )
}
