import { CircleAlert, ExternalLink } from 'lucide-react'

import { MORRISONS_TROLLEY_URL, type DraftOrder } from '@/shopper/shopper'

const POUNDS = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

interface DraftOrderReviewProps {
  draftOrder: DraftOrder
  /** Whether the trolley is a Morrisons account's own, which the person can check out from any device. */
  isLoggedIn: boolean
}

/**
 * The trolley that Claude filled, for a person to check before ordering it themselves: what it comes to, what Claude
 * chose for each item of the shopping list and why, and how to check it out.
 */
export function DraftOrderReview({ draftOrder, isLoggedIn }: DraftOrderReviewProps) {
  const { trolley } = draftOrder
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 rounded-3xl bg-field p-4">
        <p className="text-2xl font-semibold tabular-nums">{POUNDS.format(trolley.total)}</p>
        <p className="text-sm text-muted-foreground">
          {trolley.lines.length === 1 ? '1 product' : `${trolley.lines.length} products`}
          {trolley.savings > 0 && `, saving ${POUNDS.format(trolley.savings)} with offers`}
        </p>
        {trolley.shortfallToMinimumSpend > 0 && (
          <p className="text-sm font-semibold">
            Add {POUNDS.format(trolley.shortfallToMinimumSpend)} more to reach Morrisons' minimum spend for delivery.
          </p>
        )}
        <CheckoutGuidance isLoggedIn={isLoggedIn} />
      </div>

      <p className="whitespace-pre-line">{draftOrder.summary}</p>

      <ul aria-label="What Claude chose" className="grid gap-2">
        {draftOrder.itemChoices.map((choice, index) => (
          <li key={`${index}-${choice.item}`} className="grid gap-1 rounded-3xl bg-field/70 px-4 py-3">
            <p className="font-bold break-words">{choice.item}</p>
            {choice.products.length > 0 ? (
              <ul className="grid gap-0.5">
                {choice.products.map((product) => (
                  <li key={product} className="break-words">
                    {product}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-1.5 font-semibold text-destructive">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                Nothing bought
              </p>
            )}
            <p className="text-sm text-muted-foreground">{choice.note}</p>
          </li>
        ))}
      </ul>

      <details className="text-sm">
        <summary className="cursor-pointer font-bold">Everything in the trolley</summary>
        <ul className="mt-2 grid gap-1">
          {trolley.lines.map((line) => (
            <li key={line.name} className="flex gap-2">
              <span className="min-w-8 font-bold tabular-nums">{line.quantity} ×</span>
              <span className="min-w-0 flex-1 break-words">
                {line.name}
                {line.offer && <span className="block text-muted-foreground">{line.offer}</span>}
              </span>
              <span className="tabular-nums">{POUNDS.format(line.price)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

/** How to order the trolley, which depends on whose it is. */
function CheckoutGuidance({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) {
    return (
      <a
        href={MORRISONS_TROLLEY_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 justify-self-start font-bold text-primary-text underline"
      >
        Open Morrisons to check out
        <ExternalLink className="size-4" aria-hidden />
      </a>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      This is a guest's trolley, so it only exists on the home server. Log in to Morrisons above, then generate the order
      again, to fill your own trolley and check it out from any device.
    </p>
  )
}
