import { useScene } from '@/scene/useScene'
import { getBuiltInSceneId } from '@/scenes/builtInScenes'
import type { LayerDesign, SceneDesign } from '@/scenes/sceneDesign'
import { useSceneDesigns } from '@/scenes/useSceneDesigns'
import { useSettings } from '@/settings/useSettings'

/** A layer of a scene, as the backdrop draws it. */
export interface StackedLayer {
  id: string
  design: LayerDesign
}

/** What the backdrop behind every page shows: a scene, and its layers, back first. */
export interface ShownScene {
  sceneId: string
  scene: SceneDesign
  /** Whether the scene was chosen in this device's settings, rather than following the time of day and weather. */
  isChosen: boolean
  layers: StackedLayer[]
  /** How far the moon is through its cycle (see Scene.moonPhase). */
  moonPhase: number
}

/**
 * Provides what the backdrop behind every page shows: the scene chosen in this device's settings, or else the site's
 * scene for the time of day and weather (see useScene), as it was last saved.
 *
 * @returns The scene, its layers and the moon, kept up to date.
 */
export function useShownScene(): ShownScene {
  const { timeOfDay, weather, moonPhase } = useScene()
  const [{ chosenSceneId }] = useSettings()
  const { designOf, layerOf } = useSceneDesigns()

  const chosenScene = chosenSceneId === null ? undefined : designOf(chosenSceneId)
  if (chosenSceneId !== null && chosenScene) {
    return { sceneId: chosenSceneId, scene: chosenScene, isChosen: true, layers: stackLayers(chosenScene, layerOf), moonPhase }
  }
  const sceneId = getBuiltInSceneId(timeOfDay, weather)
  // Every time of day in every weather has one of the site's own scenes, so this always finds one.
  const scene = designOf(sceneId)!
  return { sceneId, scene, isChosen: false, layers: stackLayers(scene, layerOf), moonPhase }
}

/**
 * Finds the layers that a scene stacks up, leaving out any that have since been deleted.
 *
 * @param scene The scene.
 * @param layerOf Finds a layer by its id (see SceneDesigns.layerOf).
 * @returns Its layers, back first.
 */
export function stackLayers(scene: SceneDesign, layerOf: (layerId: string) => LayerDesign | undefined): StackedLayer[] {
  return scene.layerIds.flatMap((id) => {
    const design = layerOf(id)
    return design ? [{ id, design }] : []
  })
}
