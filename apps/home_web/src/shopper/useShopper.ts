import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiUnavailableError, RequestRefusedError } from '@/homeApi/homeApi'
import { isShopperBusy, type ShopperSettings, type ShopperStatus } from '@/shopper/shopper'
import * as shopperApi from '@/shopper/shopperApi'

const STATUS_QUERY_KEY = ['shopper', 'status']

// Claude's progress is shown by refreshing the status, so each step appears within a second of it happening. That is
// cheap: the API is on the same machine as the site, and answers from memory.
const BUSY_REFRESH_INTERVAL_MILLISECONDS = 1000

// While nothing is happening, the status only changes when someone acts on another screen.
const IDLE_REFRESH_INTERVAL_MILLISECONDS = 5000

/** The shopper on the home server, and the ways to ask it for things. */
export interface Shopper {
  /** What the shopper is doing, or undefined until it has first been fetched. */
  status: ShopperStatus | undefined
  /** Whether the shopper can't be reached at the moment, which includes it not having been started on the home server. */
  isUnavailable: boolean
  /** Why the last action didn't go ahead, in words for the person, or null if it did. */
  refusal: string | null
  /** Has Claude fill the Morrisons trolley from the shopping list, replacing what it holds. */
  generateOrder: (settings: ShopperSettings) => void
  /** Interrupts the order being generated. */
  stopGeneratingOrder: () => void
  /** Opens a window on the home server's screen to log in to Morrisons. */
  logIn: () => void
  /** Forgets the Morrisons login. */
  logOut: () => void
}

/**
 * Keeps this screen in step with the shopper, which every screen shares. Claude's progress, and anything done on
 * another screen, appears here within a few seconds.
 *
 * None of the actions throw. One that the API refuses, or that can't reach it, is explained by `refusal`.
 *
 * @returns The shopper.
 */
export function useShopper(): Shopper {
  const queryClient = useQueryClient()
  const statusQuery = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: shopperApi.getShopperStatus,
    refetchInterval: (query) =>
      query.state.data && isShopperBusy(query.state.data.state) ? BUSY_REFRESH_INTERVAL_MILLISECONDS : IDLE_REFRESH_INTERVAL_MILLISECONDS,
  })
  const [refusal, setRefusal] = useState<string | null>(null)

  const act = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action()
      setRefusal(null)
    } catch (error) {
      // Both documented errors leave the shopper as it was, so all there is to do is tell the person. Anything else is a
      // bug, which must not be hidden.
      if (error instanceof RequestRefusedError) setRefusal(error.message)
      else if (error instanceof ApiUnavailableError) setRefusal("The Morrisons shopper can't be reached. Try again in a moment.")
      else throw error
    } finally {
      // Shows the effect of the action straight away, rather than at the next refresh.
      void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY })
    }
  }

  return {
    status: statusQuery.data,
    isUnavailable: statusQuery.isError,
    refusal,
    generateOrder: (settings) => void act(() => shopperApi.generateOrder(settings)),
    stopGeneratingOrder: () => void act(shopperApi.stopGeneratingOrder),
    logIn: () => void act(shopperApi.logInToMorrisons),
    logOut: () => void act(shopperApi.logOutOfMorrisons),
  }
}
