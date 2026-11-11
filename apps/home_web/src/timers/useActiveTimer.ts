import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import type { ActiveTimer, TimerPlan } from '@/timers/timer'
import * as timersApi from '@/timers/timersApi'

const ACTIVE_TIMER_QUERY_KEY = ['activeTimer']

// Every screen shows the same timer, so each one refreshes by itself to show what the others change. Every second
// is cheap: the timer is small and the API is on the local network.
const REFRESH_INTERVAL_MILLISECONDS = 1000

/** The timer that every screen in the home shares, and the ways to change it. */
export interface SharedTimer {
  /** The timer as this screen should show it, or undefined until it has first been fetched. */
  timer: ActiveTimer | undefined
  /** Whether the timers API can't be reached at the moment, so that other screens' changes aren't arriving. */
  isUnavailable: boolean
  /** Replaces the plan, whether or not the timer is started. */
  changePlan: (plan: TimerPlan) => void
  /** Starts the timer now. */
  start: () => void
  stop: () => void
}

/**
 * Keeps this screen in step with the timer that every screen shares. Changes made on other screens appear here within
 * a second or so, and changes made here are sent to the others.
 *
 * A change shows here straight away. If the API can't take it, this screen goes back to showing the timer that the API
 * holds. None of the changes do anything until the timer has first been fetched.
 *
 * @returns The timer, and the ways to change it.
 */
export function useActiveTimer(): SharedTimer {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ACTIVE_TIMER_QUERY_KEY,
    queryFn: timersApi.getActiveTimer,
    refetchInterval: REFRESH_INTERVAL_MILLISECONDS,
  })

  // The timer as it was last changed here, while any of this screen's changes are still on their way to the API. It
  // is shown in place of the fetched timer, which would otherwise undo typing for a moment each time a refresh
  // arrived. It is state of its own, rather than an early update to the fetched timer, because a text field only
  // behaves if what was typed is rendered in the same instant.
  const [unsavedTimer, setUnsavedTimer] = useState<ActiveTimer | null>(null)
  const unsettledSaveCount = useRef(0)

  const saveMutation = useMutation({
    mutationFn: timersApi.saveActiveTimer,
    // Saves sharing a scope are sent one at a time, in order, so that the last change is the one the API ends up with.
    scope: { id: 'activeTimer' },
    onSuccess: async (_response, savedTimer) => {
      // A refresh that was sent before this save reached the API would bring back the timer as it was.
      await queryClient.cancelQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY })
      queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, savedTimer)
    },
    onSettled: () => {
      unsettledSaveCount.current -= 1
      if (unsettledSaveCount.current === 0) setUnsavedTimer(null)
    },
  })

  const timer = unsavedTimer ?? query.data

  const changeTimer = (changes: Partial<ActiveTimer>) => {
    if (!timer) return
    const changedTimer = { ...timer, ...changes }
    setUnsavedTimer(changedTimer)
    unsettledSaveCount.current += 1
    saveMutation.mutate(changedTimer)
  }

  return {
    timer,
    isUnavailable: query.isError,
    changePlan: (plan) => changeTimer({ plan }),
    start: () => changeTimer({ startedAt: new Date() }),
    stop: () => changeTimer({ startedAt: null }),
  }
}
