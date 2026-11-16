import { CircleStop, CloudOff, LoaderCircle, LogIn, LogOut, ShoppingCart, Sparkles } from 'lucide-react'

import { ChoiceField } from '@/components/ChoiceField'
import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DraftOrderReview } from '@/pages/shoppingList/DraftOrderReview'
import { useSettings } from '@/settings/useSettings'
import {
  isShopperBusy,
  MAXIMUM_SHOPPER_PREFERENCES_LENGTH,
  SHOPPER_EFFORT_CHOICES,
  SHOPPER_MODEL_CHOICES,
  type ShopperEffort,
  type ShopperModel,
  type ShopperStatus,
  type ShoppingTrip,
} from '@/shopper/shopper'
import { useShopper } from '@/shopper/useShopper'

// How many of the latest steps are shown while Claude shops. Older ones scroll away, as only the latest matter then.
const LATEST_EVENT_COUNT = 6

interface MorrisonsOrderPanelProps {
  /** Whether the basket adds up to anything to buy, without which there is nothing to order. */
  hasThingsToBuy: boolean
}

/**
 * Has Claude fill the Morrisons trolley from everything the basket adds up to buying, with the choice of model and
 * effort and the household's preferences, which are remembered, and shows how it is going and then what it chose. Nothing is ordered: a person checks out at Morrisons.
 * Also logs in to Morrisons, so that the trolley is the household's own rather than a guest's on the home server.
 */
export function MorrisonsOrderPanel({ hasThingsToBuy }: MorrisonsOrderPanelProps) {
  const shopper = useShopper()
  const [settings, changeSettings] = useSettings()
  const { status } = shopper

  return (
    <section aria-label="Morrisons order" className="panel grid gap-5 rounded-4xl p-5 shadow-lg shadow-shade sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <ShoppingCart className="size-6" />
          Morrisons order
        </h2>
        {status && <AccountControls status={status} onLogIn={shopper.logIn} onLogOut={shopper.logOut} />}
      </div>

      {shopper.isUnavailable && !status && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          The Morrisons shopper isn't reachable. It runs on the home server, and may not have been started.
        </p>
      )}

      {status?.state === 'logging_in' && (
        <p className="rounded-3xl bg-field p-4 font-semibold">
          A Morrisons window is open on the home server's screen. Log in there, then close the window.
        </p>
      )}
      {status?.loginFailure && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          Couldn't log in to Morrisons. {status.loginFailure}
        </p>
      )}

      {status && (
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm font-bold text-muted-foreground">
            Preferences
            <Textarea
              value={settings.shopperPreferences}
              onChange={(event) => changeSettings({ shopperPreferences: event.target.value })}
              disabled={isShopperBusy(status.state)}
              maxLength={MAXIMUM_SHOPPER_PREFERENCES_LENGTH}
              placeholder="Anything Claude should know when choosing, such as: free-range eggs only, no own-brand cereal, prefer organic fruit."
              className="rounded-2xl bg-field px-4 py-2.5 text-base font-normal text-foreground"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <ChoiceField
              label="Model"
              choices={SHOPPER_MODEL_CHOICES}
              value={settings.shopperModel}
              onChange={(shopperModel: ShopperModel) => changeSettings({ shopperModel })}
              disabled={isShopperBusy(status.state)}
            />
            <ChoiceField
              label="Effort"
              choices={SHOPPER_EFFORT_CHOICES}
              value={settings.shopperEffort}
              onChange={(shopperEffort: ShopperEffort) => changeSettings({ shopperEffort })}
              disabled={isShopperBusy(status.state)}
            />
            {status.state === 'shopping' ? (
              <Button variant="outline" onClick={shopper.stopGeneratingOrder} className="ml-auto h-11 rounded-full px-5 text-base font-bold">
                <CircleStop />
                Stop
              </Button>
            ) : (
              <Button
                onClick={() => shopper.generateOrder({
                    model: settings.shopperModel,
                    effort: settings.shopperEffort,
                    preferences: settings.shopperPreferences,
                  })}
                disabled={isShopperBusy(status.state) || !hasThingsToBuy}
                className="ml-auto h-11 rounded-full px-5 text-base font-bold shadow-md shadow-shade"
              >
                <Sparkles />
                Generate order
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {hasThingsToBuy
              ? 'Claude fills the Morrisons trolley with everything the basket adds up to buying, replacing whatever is in it. Nothing is ordered until you check out yourself.'
              : 'Add something to the basket first, and Claude can fill a Morrisons trolley with it.'}
          </p>
        </div>
      )}

      {shopper.refusal && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {shopper.refusal}
        </p>
      )}

      {status?.trip && <TripOutcome trip={status.trip} isShopping={status.state === 'shopping'} isLoggedIn={status.isLoggedIn} />}
    </section>
  )
}

interface AccountControlsProps {
  status: ShopperStatus
  onLogIn: () => void
  onLogOut: () => void
}

/** Whose trolley orders fill, and the button to change it. */
function AccountControls({ status, onLogIn, onLogOut }: AccountControlsProps) {
  const isBusy = isShopperBusy(status.state)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill className={status.isLoggedIn ? 'bg-primary/20 text-primary-text' : 'bg-secondary text-secondary-foreground'}>
        {status.isLoggedIn ? 'Logged in to Morrisons' : 'Shopping as a guest'}
      </Pill>
      {status.isLoggedIn ? (
        <Button variant="ghost" onClick={onLogOut} disabled={isBusy} className="h-9 rounded-full px-4 font-bold">
          <LogOut />
          Log out
        </Button>
      ) : (
        <Button variant="ghost" onClick={onLogIn} disabled={isBusy} className="h-9 rounded-full px-4 font-bold">
          <LogIn />
          Log in
        </Button>
      )}
    </div>
  )
}

interface TripOutcomeProps {
  trip: ShoppingTrip
  isShopping: boolean
  isLoggedIn: boolean
}

/** How the latest shop is going while Claude shops, then either what it chose or why it couldn't finish. */
function TripOutcome({ trip, isShopping, isLoggedIn }: TripOutcomeProps) {
  if (isShopping) {
    return (
      <div className="grid gap-2 rounded-3xl bg-field p-4">
        <p className="flex items-center gap-2 font-semibold">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Claude is shopping. This usually takes a few minutes.
        </p>
        <ol aria-label="Progress" className="grid gap-1 text-sm text-muted-foreground">
          {trip.events.slice(-LATEST_EVENT_COUNT).map((event, index) => (
            <li key={`${trip.events.length}-${index}`} className={event.kind === 'reply' ? 'text-foreground' : undefined}>
              {event.text}
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (trip.draftOrder) return <DraftOrderReview draftOrder={trip.draftOrder} isLoggedIn={isLoggedIn} />

  const failure = trip.events.findLast((event) => event.kind === 'failure')
  return (
    <p role="alert" className="rounded-3xl bg-destructive/10 p-4 font-semibold whitespace-pre-line text-destructive">
      The last order couldn't be generated. {failure?.text}
    </p>
  )
}
