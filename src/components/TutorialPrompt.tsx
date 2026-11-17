import { Button, Dialog } from './ui'
import { load, save } from '../lib/storage'

const KEY = 'flipclash.tutorialAsked.v1'

/** Has this device already been asked whether it wants the tutorial? */
export function tutorialAsked() {
  return load(KEY, false)
}

export function markTutorialAsked() {
  save(KEY, true)
}

/** First-time pop-up: offer the How to Play walkthrough before the first game. */
export function TutorialPrompt({
  open,
  onTutorial,
  onSkip,
}: {
  open: boolean
  onTutorial: () => void
  onSkip: () => void
}) {
  return (
    <Dialog
      open={open}
      title="New to Flip Clash?"
      onClose={onSkip}
      actions={
        <>
          <Button variant="ghost" onClick={onSkip}>
            I know how to play
          </Button>
          <Button variant="primary" onClick={onTutorial} autoFocus>
            Show me how
          </Button>
        </>
      }
    >
      <p>Take the 1-minute tutorial to learn how to peek, battle and win.</p>
      <p className="mt-2 text-sm text-steel-400">You can always find it later under How to Play on the main menu.</p>
    </Dialog>
  )
}
