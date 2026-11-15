import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'

import { reportOutcome, type SaveOutcome } from '@/homeApi/homeApi'
import { PICTURES_QUERY_KEY } from '@/pixelArt/usePictures'
import * as scenesApi from '@/scenes/scenesApi'
import { LAYERS_QUERY_KEY, SCENES_QUERY_KEY } from '@/scenes/useSceneDesigns'

const PRESETS_QUERY_KEY = ['pixel-art-presets']

/** Changes to the presets. None of them throw: each reports its outcome instead. */
export interface PresetActions {
  /** Saves every picture, layer and scene as they are now, under a name. */
  savePreset: (name: string) => Promise<SaveOutcome>
  /** Puts back every picture, layer and scene as a preset holds them. */
  applyPreset: (presetId: string) => Promise<SaveOutcome>
  /** Saves every picture, layer and scene as they are now into a preset, in place of what it held. */
  overwritePreset: (presetId: string) => Promise<SaveOutcome>
  renamePreset: (presetId: string, name: string) => Promise<SaveOutcome>
  deletePreset: (presetId: string) => Promise<SaveOutcome>
}

/**
 * Keeps this screen in step with the presets that every screen shares.
 *
 * @returns The query, whose data is the presets, oldest first.
 */
export function usePresets(): UseQueryResult<scenesApi.Preset[]> {
  return useQuery({ queryKey: PRESETS_QUERY_KEY, queryFn: scenesApi.listPresets })
}

/**
 * Provides the changes that can be made to the presets. Applying one changes every picture, layer and scene, so this
 * screen fetches them all again straight away, rather than waiting for its next refresh.
 *
 * @returns The actions.
 */
export function usePresetActions(): PresetActions {
  const queryClient = useQueryClient()
  const changeMutation = useMutation({
    mutationFn: (change: { send: () => Promise<void>; changesDesign: boolean }) => change.send(),
    onSettled: async (_result, _error, change) => {
      await queryClient.invalidateQueries({ queryKey: PRESETS_QUERY_KEY })
      if (change.changesDesign) {
        await Promise.all([PICTURES_QUERY_KEY, LAYERS_QUERY_KEY, SCENES_QUERY_KEY].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      }
    },
  })

  return {
    savePreset: (name) => reportOutcome(changeMutation.mutateAsync({ send: () => scenesApi.savePreset(name.trim()), changesDesign: false })),
    applyPreset: (presetId) => reportOutcome(changeMutation.mutateAsync({ send: () => scenesApi.applyPreset(presetId), changesDesign: true })),
    overwritePreset: (presetId) => reportOutcome(changeMutation.mutateAsync({ send: () => scenesApi.overwritePreset(presetId), changesDesign: false })),
    renamePreset: (presetId, name) => reportOutcome(changeMutation.mutateAsync({ send: () => scenesApi.renamePreset(presetId, name.trim()), changesDesign: false })),
    deletePreset: (presetId) => reportOutcome(changeMutation.mutateAsync({ send: () => scenesApi.deletePreset(presetId), changesDesign: false })),
  }
}
