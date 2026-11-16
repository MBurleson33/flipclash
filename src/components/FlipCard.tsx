import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Card } from '../engine'
import { CardBack, CardBox, CardFront, COLOR_HEX } from './CardFace'
import { useSettings } from '../lib/settings'
import { play } from '../lib/audio'

interface Props {
  card: Card | null
  faceUp: boolean
  /** extra glow color around the card (selection, winner …) */
  glow?: string | null
  dimmed?: boolean
  sound?: boolean
  onFlipped?: () => void
  className?: string
}

/** A card that animates a 3D flip between its official back and front. */
export function FlipCard({ card, faceUp, glow, dimmed, sound = true, onFlipped, className = '' }: Props) {
  const { speed, reduced } = useSettings()
  // Remember the last known face so it can still be shown while flipping back down.
  const lastCard = useRef<Card | null>(card)
  if (card) lastCard.current = card
  const shown = card ?? lastCard.current

  const [revealGlow, setRevealGlow] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (sound) play('flip')
    if (faceUp) {
      setRevealGlow(true)
      const t = setTimeout(() => setRevealGlow(false), 700 * speed + 50)
      return () => clearTimeout(t)
    }
  }, [faceUp]) // eslint-disable-line react-hooks/exhaustive-deps

  const glowColor = glow ?? (revealGlow && shown ? COLOR_HEX[shown.color] : null)

  return (
    <CardBox className={className}>
      <div className="absolute inset-0" style={{ perspective: '900px' }}>
        <motion.div
          className="preserve-3d relative h-full w-full"
          initial={false}
          animate={{ rotateY: faceUp ? 180 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.55 * speed, ease: [0.3, 0.7, 0.2, 1] }}
          onAnimationComplete={onFlipped}
        >
          <div className="backface-hidden absolute inset-0">
            <CardBack />
          </div>
          <div className="backface-hidden absolute inset-0" style={{ transform: 'rotateY(180deg)' }}>
            {shown && <CardFront card={shown} />}
          </div>
        </motion.div>
      </div>
      {glowColor && (
        <div
          className="pointer-events-none absolute -inset-[3%] rounded-[8%] transition-opacity"
          style={{ boxShadow: `0 0 0 2px ${glowColor}, 0 0 18px 2px ${glowColor}aa` }}
          aria-hidden
        />
      )}
      {dimmed && <div className="card-shape pointer-events-none absolute inset-0 bg-ink-950/45" aria-hidden />}
    </CardBox>
  )
}
