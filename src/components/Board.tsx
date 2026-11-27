import { motion } from 'motion/react'
import type { Position } from '../engine'
import type { PlayerView, SlotView } from '../engine/view'
import { CardBox, CardFront, cardLabel } from './CardFace'
import { FlipCard } from './FlipCard'
import { SEAT_STYLE } from './ui'
import { Sparks } from './Effects'

// Exact diamond layout on a 5×5 grid (row, col). Cards sit on the diamond,
// the 4 prize spots fill the gaps around the center card [5].
export const SLOT_CELL: Record<Position, [number, number]> = {
  1: [0, 2],
  2: [1, 1],
  3: [1, 3],
  4: [2, 0],
  5: [2, 2],
  6: [2, 4],
  7: [3, 1],
  8: [3, 3],
  9: [4, 2],
}
// prize index → cell, clockwise from the top
export const PRIZE_CELL: [number, number][] = [
  [1, 2],
  [2, 3],
  [3, 2],
  [2, 1],
]

interface Props {
  player: PlayerView
  canSelect?: (slot: SlotView) => boolean
  onSelect?: (pos: Position) => void
  selected?: Position | null
  highlight?: Position[]
  highlightColor?: string
  showPeekMarks?: boolean
  newPrizeIndex?: number | null
  className?: string
  /** Frame the board in its owner's color with a name banner. 'you' = YOUR BOARD. */
  owner?: 'you' | 'name' | null
}

export function Board({
  player,
  canSelect,
  onSelect,
  selected = null,
  highlight = [],
  highlightColor = '#ff4a3d',
  showPeekMarks = true,
  newPrizeIndex = null,
  className = '',
  owner = null,
}: Props) {
  const seat = SEAT_STYLE[player.seat] ?? SEAT_STYLE[0]
  const grid = (
      <div
        className="grid w-full"
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '2.2cqw' }}
        role="group"
        aria-label={`${player.name}'s board`}
      >
        {player.slots.map((slot) => {
          const [r, c] = SLOT_CELL[slot.position]
          const selectable = !!canSelect?.(slot)
          const isSelected = selected === slot.position
          const isHighlighted = highlight.includes(slot.position)
          return (
            <div key={`s${slot.position}`} style={{ gridRow: r + 1, gridColumn: c + 1 }}>
              <SlotCell
                slot={slot}
                selectable={selectable}
                selected={isSelected}
                glow={isSelected ? '#ff4a3d' : isHighlighted ? highlightColor : null}
                showPeekMark={showPeekMarks}
                onClick={() => onSelect?.(slot.position)}
              />
            </div>
          )
        })}
        {PRIZE_CELL.map(([r, c], i) => (
          <div key={`p${i}`} style={{ gridRow: r + 1, gridColumn: c + 1 }}>
            <PrizeCell index={i} card={player.prizes[i] ?? null} fresh={newPrizeIndex === i} />
          </div>
        ))}
      </div>
  )
  if (!owner) {
    return (
      <div className={`w-full ${className}`} style={{ containerType: 'inline-size' }}>
        {grid}
      </div>
    )
  }
  const isYou = owner === 'you'
  return (
    <div className={`w-full ${className}`} style={{ containerType: 'inline-size' }}>
      <div
        className="relative rounded-[3cqw] p-[2.5cqw] pt-[9cqw]"
        style={{
          background: `linear-gradient(180deg, ${seat.color}${isYou ? '26' : '14'}, ${seat.color}05 40%)`,
          boxShadow: `inset 0 0 0 ${isYou ? 2 : 1}px ${seat.color}${isYou ? 'cc' : '66'}`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 flex h-[7.5cqw] items-center justify-center gap-[1.5cqw] rounded-t-[3cqw] font-display font-bold tracking-[0.15em] uppercase"
          style={{
            fontSize: '4.2cqw',
            background: isYou ? seat.color : `${seat.color}33`,
            color: isYou ? (player.seat === 1 ? '#0d0f12' : '#fff') : seat.color,
          }}
        >
          <span aria-hidden>{seat.shape}</span>
          <span className="max-w-[80%] truncate">{isYou ? 'Your board' : `${player.name}’s board`}</span>
        </div>
        {grid}
      </div>
    </div>
  )
}

function SlotCell({
  slot,
  selectable,
  selected,
  glow,
  showPeekMark,
  onClick,
}: {
  slot: SlotView
  selectable: boolean
  selected: boolean
  glow: string | null
  showPeekMark: boolean
  onClick: () => void
}) {
  if (slot.empty) {
    return (
      <CardBox>
        <div
          className="absolute inset-0 rounded-[7%] border border-steel-500/35 bg-ink-950/30"
          aria-label={`Position ${slot.position}, empty`}
          role="img"
        />
      </CardBox>
    )
  }
  const face = slot.faceUp || slot.peekVisible
  const label = slot.card && face ? cardLabel(slot.card) : 'face-down card'
  const inner = (
    <motion.div
      animate={{ y: selected ? '-7%' : '0%', scale: selected ? 1.04 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="relative"
    >
      <div className={`transition-[filter] duration-500 ${slot.used && slot.faceUp ? 'grayscale-[85%]' : ''}`}>
        <FlipCard card={slot.card} faceUp={face} glow={glow} dimmed={slot.used && slot.faceUp} />
      </div>
      {slot.used && slot.faceUp && (
        <span
          className="absolute -top-[6%] -left-[6%] grid h-[24%] w-[34%] place-items-center rounded-full border border-steel-400/50 bg-ink-800 text-steel-300"
          title="Already clashed"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
      )}
      {showPeekMark && slot.peekedByOwner && !slot.faceUp && (
        <span
          className="absolute -top-[6%] -right-[6%] grid h-[24%] w-[34%] place-items-center rounded-full border border-steel-400/50 bg-ink-800 text-steel-200"
          title="Peeked at during setup"
          aria-hidden
        >
          <EyeIcon />
        </span>
      )}
    </motion.div>
  )
  if (!selectable) {
    return (
      <div role="img" aria-label={`Position ${slot.position}, ${label}${slot.used ? ', already clashed' : ''}`}>
        {inner}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Position ${slot.position}, ${label}${slot.peekedByOwner ? ', peeked' : ''}`}
      className="group block w-full cursor-pointer rounded-[7%] transition-transform hover:-translate-y-[3%] active:scale-[0.97]"
    >
      {inner}
    </button>
  )
}

function PrizeCell({ index, card, fresh }: { index: number; card: import('../engine').Card | null; fresh: boolean }) {
  return (
    <CardBox>
      <div
        className="absolute inset-[4%] grid place-items-center rounded-[7%] border-2 border-dashed border-clash-400/45 bg-clash-600/5"
        role="img"
        aria-label={card ? `Win ${index + 1}: ${cardLabel(card)}` : `Win ${index + 1}: empty`}
      >
        {!card && (
          <span className="font-display text-[13cqw] font-semibold tracking-widest text-clash-400/55 uppercase">
            Win
          </span>
        )}
      </div>
      {card && (
        <motion.div
          className="absolute inset-[4%]"
          initial={fresh ? { scale: 1.6, opacity: 0, rotate: -12 } : false}
          animate={{ scale: 1, opacity: 1, rotate: index % 2 ? 2 : -2 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: fresh ? 0.15 : 0 }}
        >
          <CardBox>
            <CardFront card={card} />
          </CardBox>
          {/* gold frame + WIN tag: never confused with face-up cards on the board */}
          <div
            className="card-shape pointer-events-none absolute -inset-[5%]"
            style={{ boxShadow: '0 0 0 2px #f5b70a, 0 0 14px 2px #f5b70a88', borderRadius: '8%' }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-[9%] left-1/2 -translate-x-1/2 rounded-sm px-[8%] font-display leading-none font-bold tracking-widest text-ink-950 uppercase shadow"
            style={{ background: 'linear-gradient(180deg,#ffd75e,#f5b70a)', fontSize: '15cqw', paddingBlock: '3cqw' }}
            aria-hidden
          >
            ★ Win
          </span>
          {fresh && (
            <div className="pointer-events-none absolute -inset-[120%] z-20">
              <Sparks fire={1} colors={['#ffd75e', '#f5b70a', '#ffffff']} count={30} power={0.7} gravity={0.08} />
            </div>
          )}
          {fresh && (
            <motion.div
              className="pointer-events-none absolute -inset-[10%] rounded-[10%]"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.4, delay: 0.3 }}
              style={{ boxShadow: '0 0 0 2px #ff4a3d, 0 0 28px 6px #ff4a3daa' }}
            />
          )}
        </motion.div>
      )}
    </CardBox>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
