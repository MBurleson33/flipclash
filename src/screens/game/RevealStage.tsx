import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { GameState } from '../../engine'
import { viewFor } from '../../engine'
import { Board } from '../../components/Board'
import { cardLabel } from '../../components/CardFace'
import { FlipCard } from '../../components/FlipCard'
import { Button, Marker, Pips } from '../../components/ui'
import { useFitWidth } from '../../components/useFit'
import { useSettings } from '../../lib/settings'
import { play } from '../../lib/audio'

type Step = 'ready' | 'flip' | 'result' | 'capture'

/** The public clash: both chosen cards flip at once, the higher number wins and captures. */
export function RevealStage({
  state,
  onNext,
  onAnnounce,
}: {
  state: GameState
  onNext: () => void
  onAnnounce: (msg: string) => void
}) {
  const clash = state.lastClash!
  const { speed } = useSettings()
  const [step, setStep] = useState<Step>('ready')

  const attacker = state.players.find((p) => p.id === clash.attackerId)!
  const defender = state.players.find((p) => p.id === clash.defenderId)!
  const aCard = state.cards[clash.attackerCardId]
  const dCard = state.cards[clash.defenderCardId]
  const winner = clash.winnerId ? state.players.find((p) => p.id === clash.winnerId)! : null
  const aWins = clash.winnerId === attacker.id
  const dWins = clash.winnerId === defender.id

  useEffect(() => {
    const ms = (n: number) => Math.max(20, n * speed)
    const timers = [
      setTimeout(() => {
        play('clash')
        setStep('flip')
      }, ms(650)),
      setTimeout(() => {
        setStep('result')
        play(winner ? 'win' : 'tie')
        onAnnounce(
          winner
            ? `${aCard.number} versus ${dCard.number}. ${winner.name} wins the clash and captures ${cardLabel(aWins ? dCard : aCard)}.`
            : `${aCard.number} versus ${dCard.number}. A tie — nobody wins.`,
        )
      }, ms(1450)),
    ]
    if (winner) {
      timers.push(
        setTimeout(() => {
          setStep('capture')
          play('capture')
        }, ms(2600)),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Move on by itself once the result has been shown; the button just skips the wait.
  const settled = winner ? step === 'capture' : step === 'result'
  const autoMs = Math.max(1800, 2200 * speed)
  useEffect(() => {
    if (!settled) return
    const t = setTimeout(onNext, autoMs)
    return () => clearTimeout(t)
  }, [settled]) // eslint-disable-line react-hooks/exhaustive-deps

  const flipped = step !== 'ready'
  const decided = step === 'result' || step === 'capture'
  const publicView = viewFor(state, null)
  const winnerView = winner ? publicView.players.find((p) => p.id === winner.id)! : null
  const { ref, width } = useFitWidth<HTMLDivElement>(1.365, 420)
  const finalClash = !!state.result

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-4 pb-4">
      <AnimatePresence mode="wait">
        {step !== 'capture' ? (
          <motion.div
            key="vs"
            className="flex min-h-0 w-full flex-1 flex-col items-center justify-center"
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25 * speed }}
          >
            <div className="grid w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <Fighter
                name={attacker.name}
                seat={attacker.seat}
                card={aCard}
                flipped={flipped}
                win={decided && aWins}
                lose={decided && dWins}
                tie={decided && !winner}
                from={-1}
              />
              <motion.div
                className="font-display text-3xl font-bold italic text-clash-500 sm:text-5xl"
                animate={step === 'flip' ? { scale: [1, 1.5, 1] } : {}}
                transition={{ duration: 0.4 * speed }}
                aria-hidden
              >
                VS
              </motion.div>
              <Fighter
                name={defender.name}
                seat={defender.seat}
                card={dCard}
                flipped={flipped}
                win={decided && dWins}
                lose={decided && aWins}
                tie={decided && !winner}
                from={1}
              />
            </div>
            <div className="mt-6 min-h-16 text-center" aria-hidden>
              {decided && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="font-display text-3xl font-bold tracking-wide text-white uppercase">
                    {winner ? `${winner.name} wins!` : 'Tie!'}
                  </div>
                  <div className="mt-1 text-steel-300">
                    {winner
                      ? `${aCard.number} vs ${dCard.number} — captures ${cardLabel(aWins ? dCard : aCard)}`
                      : `${aCard.number} vs ${dCard.number} — nobody wins, both cards are used up`}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="capture"
            className="flex min-h-0 w-full flex-1 flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-white uppercase">
              <Marker seat={winner!.seat} /> {winner!.name} captures a prize
              <Pips filled={winner!.prizes.length} />
            </div>
            <div ref={ref} className="flex min-h-0 w-full flex-1 items-start justify-center">
              {width > 0 && (
                <div style={{ width }}>
                  <Board
                    player={winnerView!}
                    newPrizeIndex={clash.prizeIndex}
                    highlight={[aWins ? clash.attackerPos : clash.defenderPos]}
                    highlightColor="#f5b70a"
                    showPeekMarks={false}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 h-12">
        {decided && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 * speed }}>
            <Button variant="primary" className="relative min-w-56 overflow-hidden" onClick={onNext} autoFocus>
              {settled && (
                <motion.span
                  key="bar"
                  className="absolute inset-y-0 left-0 bg-white/20"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: autoMs / 1000, ease: 'linear' }}
                  aria-hidden
                />
              )}
              <span className="relative">{finalClash ? 'See who won!' : 'Next turn'}</span>
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function Fighter({
  name,
  seat,
  card,
  flipped,
  win,
  lose,
  tie,
  from,
}: {
  name: string
  seat: number
  card: import('../../engine').Card
  flipped: boolean
  win: boolean
  lose: boolean
  tie: boolean
  from: number
}) {
  const { speed } = useSettings()
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative z-10 flex max-w-full items-center gap-1.5 truncate font-display text-base font-semibold text-steel-100 sm:text-lg">
        <Marker seat={seat} /> <span className="truncate">{name}</span>
      </div>
      <motion.div
        className="w-full max-w-[200px]"
        initial={{ x: `${from * 60}%`, opacity: 0, rotate: from * 8 }}
        animate={{
          x: lose ? `${from * 4}%` : '0%',
          opacity: lose ? 0.55 : 1,
          rotate: 0,
          scale: win ? 1.05 : lose ? 0.9 : 1,
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 20, duration: 0.4 * speed }}
      >
        <FlipCard card={card} faceUp={flipped} glow={win ? '#f5b70a' : tie ? '#aeb5be' : null} />
      </motion.div>
      <div className="h-6 font-display text-sm font-bold tracking-widest uppercase">
        {win && <span className="text-[#f5b70a]">Winner</span>}
        {lose && <span className="text-steel-500">Captured</span>}
        {tie && <span className="text-steel-300">Tie</span>}
      </div>
    </div>
  )
}
