import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { GameView } from '../../engine/view'
import { Board } from '../../components/Board'
import { cardLabel } from '../../components/CardFace'
import { FlipCard } from '../../components/FlipCard'
import { Button, Marker, Pips } from '../../components/ui'
import { ImpactFlash, Shine, Sparks, useFx } from '../../components/Effects'
import { COLOR_HEX } from '../../components/CardFace'
import { BoardArea, BottomBar, Instructions } from './parts'
import { useSettings } from '../../lib/settings'
import { play } from '../../lib/audio'

type Step = 'ready' | 'flip' | 'result' | 'capture'

/** The public clash: both chosen cards flip at once, the higher number wins and captures. */
export function RevealStage({
  view,
  onNext,
  onAnnounce,
  viewerId = null,
  turnLabel,
}: {
  view: GameView
  onNext: () => void
  onAnnounce: (msg: string) => void
  /** Online: whose phone this is, so their own board reads YOUR BOARD. */
  viewerId?: string | null
  turnLabel: string
}) {
  const clash = view.lastClash!
  const { speed } = useSettings()
  const [step, setStep] = useState<Step>('ready')

  const attacker = view.players.find((p) => p.id === clash.attackerId)!
  const defender = view.players.find((p) => p.id === clash.defenderId)!
  const aCard = view.clashCards!.attacker
  const dCard = view.clashCards!.defender
  const winner = clash.winnerId ? view.players.find((p) => p.id === clash.winnerId)! : null
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

  const fx = useFx()
  const impact = step === 'flip' ? 1 : 0
  const celebrate = step === 'result' && winner ? 1 : 0
  const flipped = step !== 'ready'
  const decided = step === 'result' || step === 'capture'
  const publicView = view
  const winnerView = winner ? publicView.players.find((p) => p.id === winner.id)! : null
  const finalClash = !!view.result

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {step !== 'capture' ? (
        <Instructions title={turnLabel} hint={decided ? 'Higher number wins the other card.' : 'Both cards flip at the same time…'} />
      ) : (
        <Instructions
          title={
            <>
              <Marker seat={winner!.seat} /> {winner!.name} gets a win
            </>
          }
          hint={
            <span className="inline-flex items-center gap-2">
              <Pips filled={winner!.prizes.length} /> {winner!.prizes.length} of 4 wins
            </span>
          }
        />
      )}
      <AnimatePresence mode="wait">
        {step !== 'capture' ? (
          <motion.div
            key="vs"
            className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4"
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25 * speed }}
          >
            <motion.div
              className="relative grid w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6"
              animate={fx && impact ? { x: [0, -9, 8, -6, 4, -2, 0], y: [0, 4, -3, 2, -1, 0] } : { x: 0, y: 0 }}
              transition={{ duration: 0.42, delay: 0.12 * speed, ease: 'easeOut' }}
            >
              <Sparks fire={impact} colors={[COLOR_HEX[aCard.color], COLOR_HEX[dCard.color], '#ffffff', '#ffd75e']} count={56} power={1.1} />
              <Sparks
                fire={celebrate}
                colors={['#ffd75e', '#f5b70a', '#fff4c2']}
                count={34}
                rise
                origin={{ x: aWins ? 0.2 : 0.8, y: 0.85 }}
              />
              <ImpactFlash fire={impact} />
              <Fighter
                name={attacker.name}
                seat={attacker.seat}
                card={aCard}
                flipped={flipped}
                win={decided && aWins}
                lose={decided && dWins}
                tie={decided && !winner}
                from={-1}
                impact={!!impact}
              />
              <motion.div
                className="relative z-10 font-display text-3xl font-bold italic sm:text-5xl"
                style={{
                  color: '#fff',
                  WebkitTextStroke: '1.5px #e8231a',
                  textShadow: '0 0 18px #e8231a, 0 3px 0 #8a0d08',
                }}
                animate={step === 'flip' ? { scale: [1, 1.7, 1], rotate: [0, -8, 0] } : {}}
                transition={{ duration: 0.45 * speed }}
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
                impact={!!impact}
              />
            </motion.div>
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
            className="flex min-h-0 w-full flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <BoardArea
              board={() => (
                <Board
                  owner={viewerId && winner && winner.id === viewerId ? 'you' : 'name'}
                  player={winnerView!}
                  newPrizeIndex={clash.prizeIndex}
                  highlight={[aWins ? clash.attackerPos : clash.defenderPos]}
                  highlightColor="#eef1f4"
                  showPeekMarks={false}
                />
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomBar>
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
      </BottomBar>
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
  impact = false,
}: {
  name: string
  seat: number
  card: import('../../engine').Card
  flipped: boolean
  win: boolean
  lose: boolean
  tie: boolean
  from: number
  impact?: boolean
}) {
  const { speed } = useSettings()
  const fx = useFx()
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative z-10 flex max-w-full items-center gap-1.5 truncate font-display text-base font-semibold text-steel-100 sm:text-lg">
        <Marker seat={seat} /> <span className="truncate">{name}</span>
      </div>
      <motion.div
        className="w-full max-w-[200px]"
        initial={{ x: `${from * 60}%`, opacity: 0, rotate: from * 8 }}
        animate={
          fx && impact && !win && !lose && !tie
            ? { x: ['0%', `${-from * 16}%`, '0%'], scale: [1, 1.08, 1], opacity: 1, rotate: [0, -from * 4, 0] }
            : {
                x: lose ? `${from * 4}%` : '0%',
                opacity: lose ? 0.55 : 1,
                rotate: 0,
                scale: win ? 1.06 : lose ? 0.9 : 1,
                y: win ? -6 : lose ? 6 : 0,
              }
        }
        transition={
          fx && impact && !win && !lose && !tie
            ? { duration: 0.32, ease: [0.5, 0, 0.3, 1] }
            : { type: 'spring', stiffness: 240, damping: 20, duration: 0.4 * speed }
        }
        style={{ filter: lose ? 'grayscale(0.7) brightness(0.8)' : undefined, transition: 'filter 400ms' }}
      >
        <div className="relative">
          <FlipCard card={card} faceUp={flipped} glow={win ? '#f5b70a' : tie ? '#aeb5be' : null} />
          {win && (
            <div className="pointer-events-none absolute inset-0">
              <Shine play={1} strength={0.8} />
            </div>
          )}
        </div>
      </motion.div>
      <div className="h-6 font-display text-sm font-bold tracking-widest uppercase">
        {win && <span className="text-[#f5b70a]">Winner</span>}
        {lose && <span className="text-steel-500">Captured</span>}
        {tie && <span className="text-steel-300">Tie</span>}
      </div>
    </div>
  )
}
