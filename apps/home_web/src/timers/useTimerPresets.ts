import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'

import { reportOutcome, type SaveOutcome } from '@/homeApi/homeApi'
import type { TimerPlan, TimerPreset } from '@/timers/timer'
import * as timersApi from '@/timers/timersApi'

const PRESETS_QUERY_KEY = ['timerPresets']

/** Changes to presets. None of them throw: each reports its outcome instead. */
export interface TimerPresetActions {
  /**
   * Keeps a plan as a preset, under the plan's name. A preset that already has that name, however it is capitalised,
   * is replaced; otherwise a new preset is created.
   */
  savePlanAsPreset: (plan: TimerPlan) => Promise<SaveOutcome>
  /** Deletes a preset. */
  deletePreset: (presetId: string) => Promise<SaveOutcome>
}

/**
 * Fetches every preset. Presets rarely change, so they are fetched when a page first uses them and after each change
 * made here, rather than on a timer.
 *
 * @returns The query, whose data is every preset, oldest first.
 */
export function useTimerPresets(): UseQueryResult<TimerPreset[]> {
  return useQuery({ queryKey: PRESETS_QUERY_KEY, queryFn: timersApi.listPresets })
}

/**
 * Provides the changes that can be made to presets, keeping `useTimerPresets` in step with them.
 *
 * @returns The actions.
 */
export function useTimerPresetActions(): TimerPresetActions {
  const queryClient = useQueryClient()

  // Every change refetches afterwards, whatever its outcome, so that the screen always settles on what the API holds.
  const refetchPresets = () => queryClient.invalidateQueries({ queryKey: PRESETS_QUERY_KEY })

  const saveMutation = useMutation({
    mutationFn: async (plan: TimerPlan) => {
      const namedPlan = { ...plan, name: plan.name.trim() }
      const presets = queryClient.getQueryData<TimerPreset[]>(PRESETS_QUERY_KEY) ?? []
      const presetWithSameName = presets.find((preset) => preset.plan.name.toLowerCase() === namedPlan.name.toLowerCase())
      if (presetWithSameName) {
        await timersApi.savePreset({ id: presetWithSameName.id, plan: namedPlan })
      } else {
        await timersApi.createPreset(namedPlan)
      }
    },
    onSettled: refetchPresets,
  })

  const deleteMutation = useMutation({
    mutationFn: timersApi.deletePreset,
    onSettled: refetchPresets,
  })

  return {
    savePlanAsPreset: (plan) => reportOutcome(saveMutation.mutateAsync(plan)),
    deletePreset: (presetId) => reportOutcome(deleteMutation.mutateAsync(presetId)),
  }
}
