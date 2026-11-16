import { CLAUDE_EFFORT_CHOICES, CLAUDE_MODEL_CHOICES, type ClaudeEffort, type ClaudeModel } from '@/claude/claudeSettings'
import type { ShoppingListItem } from '@/shopping/basket'

/** Where a person checks out a logged-in account's trolley. */
export const MORRISONS_TROLLEY_URL = 'https://groceries.morrisons.com/basket'

/** A model that can shop. The shopper always names one, so there is no "default". */
export type ShopperModel = Exclude<ClaudeModel, 'default'>

/** How hard Claude thinks while it shops. The shopper always names one, so there is no "default". */
export type ShopperEffort = Exclude<ClaudeEffort, 'default'>

/** How Claude should shop. */
export interface ShopperSettings {
  model: ShopperModel
  effort: ShopperEffort
}

/** Every model that can shop, most capable first, with the name to show for it. */
export const SHOPPER_MODEL_CHOICES = CLAUDE_MODEL_CHOICES.filter(
  (choice): choice is { value: ShopperModel; label: string } => choice.value !== 'default',
)

/** Every effort that a shop can be made with, least first, with the name to show for it. */
export const SHOPPER_EFFORT_CHOICES = CLAUDE_EFFORT_CHOICES.filter(
  (choice): choice is { value: ShopperEffort; label: string } => choice.value !== 'default',
)

/**
 * What the shopper is doing, which decides what can be asked of it.
 *
 * - `idle`: nothing. An order can be generated, or a person can log in or out.
 * - `shopping`: Claude is filling the Morrisons trolley. It can be stopped.
 * - `logging_in`: a window is open on the home server's screen for a person to log in to Morrisons.
 */
export type ShopperState = 'idle' | 'shopping' | 'logging_in'

/** The shopper on the home server, which has Claude fill the Morrisons trolley from the shopping list. */
export interface ShopperStatus {
  state: ShopperState
  /**
   * Whether orders fill a Morrisons account's own trolley, which can be checked out from any device. Otherwise they fill
   * a guest's trolley, which only exists on the home server.
   */
  isLoggedIn: boolean
  /** Why the last attempt to log in went wrong, or null if it didn't. */
  loginFailure: string | null
  /** The latest shop, which stays until the next one starts, or null if there has never been one. */
  trip: ShoppingTrip | null
}

/** One go at filling the Morrisons trolley from the shopping list. */
export interface ShoppingTrip {
  /** What was to be bought, as it was when the shop started. Empty until the shopper has read it. */
  shoppingList: ShoppingListItem[]
  model: ShopperModel
  effort: ShopperEffort
  /** Everything that has happened during the shop, oldest first. If it failed, the last says why. */
  events: ShopperEvent[]
  /** The filled trolley, ready to check and order, or null until the shop has finished, or if it failed. */
  draftOrder: DraftOrder | null
}

/** One thing that happened during a shop: a step being taken, something Claude said, or what went wrong. */
export interface ShopperEvent {
  kind: 'activity' | 'reply' | 'failure'
  text: string
}

/** A Morrisons trolley that Claude has filled from the shopping list. Nothing has been ordered. */
export interface DraftOrder {
  /** How Claude says the shop went, and anything to look at before ordering. */
  summary: string
  /** What Claude chose for each item of the shopping list, in the list's order. */
  itemChoices: ItemChoice[]
  /** What the trolley actually holds, as read from Morrisons. This, not what Claude says, is what would be ordered. */
  trolley: Trolley
}

/** What Claude chose for one item of the shopping list, and why. */
export interface ItemChoice {
  /** The item, as it was written, such as "500g lamb mince". */
  item: string
  /** What Claude put in the trolley for it, each with how many. Empty if it found nothing suitable. */
  products: string[]
  /** Why, in a sentence or two. */
  note: string
}

/** What the Morrisons trolley holds. Amounts are in pounds. */
export interface Trolley {
  lines: TrolleyLine[]
  /** What it would cost, with savings from offers taken off. */
  total: number
  /** How much offers take off. */
  savings: number
  /** How much more must be added before Morrisons will deliver. 0 once the minimum is reached. */
  shortfallToMinimumSpend: number
}

/** One product in the trolley. */
export interface TrolleyLine {
  name: string
  quantity: number
  /** What all of them cost together, in pounds, with offers taken off. */
  price: number
  /** The offer on it, as Morrisons words it, such as "Buy 2 for £4", or null if there is none. */
  offer: string | null
}

/**
 * Checks whether the shopper is in the middle of something, during which it can only be stopped.
 *
 * @param state What the shopper is doing.
 * @returns True while it shops, or while the login window is open.
 */
export function isShopperBusy(state: ShopperState): boolean {
  return state !== 'idle'
}
