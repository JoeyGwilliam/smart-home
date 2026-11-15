import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'

import { reportOutcome, type SaveOutcome } from '@/homeApi/homeApi'
import { BUILT_IN_LAYERS, type BuiltInLayer } from '@/scenes/builtInLayers'
import { BUILT_IN_SCENES } from '@/scenes/builtInScenes'
import type { LayerDesign, SceneDesign } from '@/scenes/sceneDesign'
import * as scenesApi from '@/scenes/scenesApi'

export const SCENES_QUERY_KEY = ['pixel-art-scenes']
export const LAYERS_QUERY_KEY = ['pixel-art-layers']

// Like the pictures, scenes and layers change rarely, so a few seconds' wait on the other screens is fine; the screen
// that saved one shows it at once.
const REFRESH_INTERVAL_MILLISECONDS = 10_000

/** The group that the pixel art page lists layers of one's own under. */
const CUSTOM_LAYER_GROUP = 'Your layers' as const

const BUILT_IN_SCENE_DESIGNS = new Map(BUILT_IN_SCENES.map((scene) => [scene.id, scene.design]))
const BUILT_IN_LAYER_IDS = new Set(BUILT_IN_LAYERS.map((layer) => layer.id))

/** A scene of one's own, rather than one of the site's. */
export interface CustomScene {
  id: string
  design: SceneDesign
}

/** A layer, as every screen should show it, and the group that the pixel art page lists it under. */
export interface ListedLayer {
  id: string
  group: BuiltInLayer['group'] | typeof CUSTOM_LAYER_GROUP
  design: LayerDesign
}

/** The scenes and layers, as this screen last heard of them. */
export interface SceneDesigns {
  /**
   * Gives a scene as every screen should show it: one of the site's own as it was last saved, or as the site designs
   * it if it hasn't been changed; or a scene of one's own. Undefined if there is no such scene.
   */
  designOf: (sceneId: string) => SceneDesign | undefined
  /** Whether one of the site's own scenes has been changed from how the site designs it. */
  isChanged: (sceneId: string) => boolean
  /** Every scene of one's own, in alphabetical order of name. */
  customScenes: CustomScene[]
  /** Every layer: the site's own, each as it was last saved, then one's own in alphabetical order of name. */
  layers: ListedLayer[]
  /** Gives a layer as every screen should show it, or undefined if there is no such layer. */
  layerOf: (layerId: string) => LayerDesign | undefined
  /** Whether one of the site's own layers has been changed from how the site designs it. */
  isLayerChanged: (layerId: string) => boolean
  /** Whether the latest attempt to fetch the scenes or layers failed, in which case they show as last fetched. */
  hasFetchFailed: boolean
}

/**
 * Keeps this screen in step with the scenes and layers that every screen shares. Until they have been fetched, and if
 * the pixel art API can't be reached, they show as last fetched, or as the site designs them.
 *
 * @returns The scenes and layers.
 */
export function useSceneDesigns(): SceneDesigns {
  const scenesQuery = useQuery({ queryKey: SCENES_QUERY_KEY, queryFn: scenesApi.listScenes, refetchInterval: REFRESH_INTERVAL_MILLISECONDS })
  const layersQuery = useQuery({ queryKey: LAYERS_QUERY_KEY, queryFn: scenesApi.listLayers, refetchInterval: REFRESH_INTERVAL_MILLISECONDS })
  const savedScenes = scenesQuery.data ?? {}
  const savedLayers = layersQuery.data ?? {}

  const layers: ListedLayer[] = [
    ...BUILT_IN_LAYERS.map(({ id, group, design }) => ({ id, group, design: savedLayers[id] ?? design })),
    ...Object.entries(savedLayers)
      .filter(([layerId]) => !BUILT_IN_LAYER_IDS.has(layerId))
      .map(([id, design]) => ({ id, group: CUSTOM_LAYER_GROUP, design }))
      .sort((first, second) => first.design.name.localeCompare(second.design.name, undefined, { sensitivity: 'base' })),
  ]

  return {
    designOf: (sceneId) => savedScenes[sceneId] ?? BUILT_IN_SCENE_DESIGNS.get(sceneId),
    isChanged: (sceneId) => BUILT_IN_SCENE_DESIGNS.has(sceneId) && sceneId in savedScenes,
    customScenes: Object.entries(savedScenes)
      .filter(([sceneId]) => !BUILT_IN_SCENE_DESIGNS.has(sceneId))
      .map(([id, design]) => ({ id, design }))
      .sort((first, second) => first.design.name.localeCompare(second.design.name, undefined, { sensitivity: 'base' })),
    layers,
    layerOf: (layerId) => layers.find((layer) => layer.id === layerId)?.design,
    isLayerChanged: (layerId) => BUILT_IN_LAYER_IDS.has(layerId) && layerId in savedLayers,
    hasFetchFailed: scenesQuery.isError || layersQuery.isError,
  }
}

/**
 * Tells whether a scene is one of the site's own, rather than one of one's own.
 *
 * @returns Whether it is the site's.
 */
export function isBuiltInScene(sceneId: string): boolean {
  return BUILT_IN_SCENE_DESIGNS.has(sceneId)
}

/**
 * Tells whether a layer is one of the site's own, rather than one of one's own.
 *
 * @returns Whether it is the site's.
 */
export function isBuiltInLayer(layerId: string): boolean {
  return BUILT_IN_LAYER_IDS.has(layerId)
}

/** Changes to the scenes and layers. None of them throw: each reports its outcome instead. */
export interface SceneActions {
  /** Saves a scene for every screen. A new id adds a scene of one's own. */
  saveScene: (sceneId: string, design: SceneDesign) => Promise<SaveOutcome>
  /** Puts one of the site's own scenes back as the site designs it, or deletes a scene of one's own. */
  forgetScene: (sceneId: string) => Promise<SaveOutcome>
  /** Saves a layer for every scene that uses it. A new id adds a layer of one's own. */
  saveLayer: (layerId: string, design: LayerDesign) => Promise<SaveOutcome>
  /** Puts one of the site's own layers back as the site designs it, or deletes a layer of one's own. */
  forgetLayer: (layerId: string) => Promise<SaveOutcome>
}

/**
 * Provides the changes that can be made to the scenes and layers, showing each on this screen as soon as it is saved.
 *
 * @returns The actions.
 */
export function useSceneActions(): SceneActions {
  const queryClient = useQueryClient()

  const changeMutation = useMutation({
    mutationFn: (change: SavedChange) => change.send(),
    onSuccess: async (_result, change) => {
      // The change is known to have been kept, so there's no need to ask again. A refresh that was sent before it
      // reached the API would bring back what was there before.
      await queryClient.cancelQueries({ queryKey: change.queryKey })
      queryClient.setQueryData<Record<string, unknown>>(change.queryKey, (saved) => change.apply(saved ?? {}))
    },
  })

  const keep = (queryKey: QueryKey, id: string, design: unknown, send: () => Promise<void>) =>
    reportOutcome(changeMutation.mutateAsync({ queryKey, send, apply: (saved) => ({ ...saved, [id]: design }) }))
  const forget = (queryKey: QueryKey, id: string, send: () => Promise<void>) =>
    reportOutcome(
      changeMutation.mutateAsync({ queryKey, send, apply: (saved) => Object.fromEntries(Object.entries(saved).filter(([savedId]) => savedId !== id)) }),
    )

  return {
    saveScene: (sceneId, design) => keep(SCENES_QUERY_KEY, sceneId, design, () => scenesApi.saveScene(sceneId, design)),
    forgetScene: (sceneId) => forget(SCENES_QUERY_KEY, sceneId, () => scenesApi.deleteScene(sceneId)),
    saveLayer: (layerId, design) => keep(LAYERS_QUERY_KEY, layerId, design, () => scenesApi.saveLayer(layerId, design)),
    forgetLayer: (layerId) => forget(LAYERS_QUERY_KEY, layerId, () => scenesApi.deleteLayer(layerId)),
  }
}

/** A change to send to the pixel art API, which saved designs it changes, and how, once the API has kept it. */
interface SavedChange {
  queryKey: QueryKey
  send: () => Promise<void>
  apply: (saved: Record<string, unknown>) => Record<string, unknown>
}
