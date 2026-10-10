import type { Ledger } from '../types'
import { carryText } from './ledger'

/** Visible, editable context; the draft is sent only when the person submits it. */
export function continuationDraft(ledger: Ledger): string | null {
  return carryText(
    ledger,
    'Continue from the previous session in this folder using this saved summary. Check what is still current before continuing; do not repeat completed work or assume that a pending decision has been answered.',
  )
}
