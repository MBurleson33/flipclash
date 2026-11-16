import { motion } from 'motion/react'
import { Backdrop, Button, Marker } from '../../components/ui'

/** Full-screen cover so the next player can take the device without seeing anything private. */
export function Handoff({
  name,
  seat,
  message,
  onReady,
}: {
  name: string
  seat: number
  message: string
  onReady: () => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Pass the device to ${name}`}
    >
      <Backdrop dim={0.7} />
      <p className="font-display text-sm font-semibold tracking-[0.3em] text-steel-400 uppercase">Pass the device to</p>
      <motion.div
        className="mt-3 flex items-center gap-3"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      >
        <Marker seat={seat} className="text-4xl" />
        <span className="font-display text-5xl font-bold text-white">{name}</span>
      </motion.div>
      <p className="mt-4 max-w-sm text-steel-300">{message}</p>
      <Button variant="primary" className="mt-10 min-w-60" onClick={onReady} autoFocus>
        I'm {name} — ready
      </Button>
      <p className="mt-4 text-xs text-steel-500">Everyone else, look away.</p>
    </motion.div>
  )
}
