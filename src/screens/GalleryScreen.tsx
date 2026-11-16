import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { buildDeck, COLORS, type Card, type CardColor } from '../engine'
import { Backdrop, Button, Dialog, ScreenHeader } from '../components/ui'
import { CardBack, CardBox, CardFront, cardLabel, COLOR_HEX, COLOR_LABEL } from '../components/CardFace'
import { hasAnyCardArt } from '../lib/art'

export function GalleryScreen({ onBack }: { onBack: () => void }) {
  const deck = useMemo(buildDeck, [])
  const [color, setColor] = useState<CardColor | 'all'>('all')
  const [num, setNum] = useState<number | 'all'>('all')
  const [open, setOpen] = useState<Card | 'back' | null>(null)

  const shown = deck.filter((c) => (color === 'all' || c.color === color) && (num === 'all' || c.number === num))

  return (
    <main className="min-h-dvh pb-10">
      <Backdrop />
      <ScreenHeader title="Card gallery" onBack={onBack} />

      <div className="sticky top-0 z-10 bg-ink-950/80 px-4 py-3 backdrop-blur">
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="radiogroup" aria-label="Filter by color">
          <Chip on={color === 'all'} onClick={() => setColor('all')}>
            All colors
          </Chip>
          {COLORS.map((c) => (
            <Chip key={c} on={color === c} onClick={() => setColor(c)}>
              <span className="h-3 w-3 rotate-45" style={{ background: COLOR_HEX[c] }} aria-hidden />
              {COLOR_LABEL[c]}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Filter by number">
          <Chip on={num === 'all'} onClick={() => setNum('all')}>
            All #
          </Chip>
          {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
            <Chip key={n} on={num === n} onClick={() => setNum(n)} square>
              {n}
            </Chip>
          ))}
        </div>
      </div>

      {!hasAnyCardArt && (
        <p className="px-4 pt-3 text-sm text-steel-400">Showing placeholder fronts until the official artwork is added.</p>
      )}

      <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-5 lg:grid-cols-8">
        {color === 'all' && num === 'all' && (
          <GalleryItem label="Card back" onClick={() => setOpen('back')}>
            <CardBack />
          </GalleryItem>
        )}
        {shown.map((c) => (
          <GalleryItem key={c.id} label={cardLabel(c)} onClick={() => setOpen(c)}>
            <CardFront card={c} />
          </GalleryItem>
        ))}
      </div>
      <p className="px-4 text-center text-sm text-steel-500">{shown.length} cards</p>

      <Dialog
        open={!!open}
        title={open === 'back' ? 'Card back' : open ? cardLabel(open) : ''}
        onClose={() => setOpen(null)}
        actions={
          <Button variant="primary" onClick={() => setOpen(null)}>
            Close
          </Button>
        }
      >
        {open && (
          <motion.div className="mx-auto w-full max-w-[300px]" initial={{ rotateY: 90 }} animate={{ rotateY: 0 }}>
            <CardBox>{open === 'back' ? <CardBack /> : <CardFront card={open} />}</CardBox>
          </motion.div>
        )}
      </Dialog>
    </main>
  )
}

function Chip({
  on,
  onClick,
  children,
  square,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  square?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`cut-sm flex min-h-10 shrink-0 items-center justify-center gap-2 font-display text-sm font-semibold tracking-wide transition ${
        square ? 'w-10' : 'px-3'
      } ${on ? 'bg-clash-500 text-white' : 'bg-ink-700/80 text-steel-200 ring-1 ring-inset ring-steel-400/25'}`}
    >
      {children}
    </button>
  )
}

function GalleryItem({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${label}`}
      className="rounded-[7%] transition hover:-translate-y-1 active:scale-95"
    >
      <CardBox>{children}</CardBox>
    </button>
  )
}
