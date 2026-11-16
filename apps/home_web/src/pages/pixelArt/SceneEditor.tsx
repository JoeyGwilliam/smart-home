import { ArrowDown, ArrowUp, CopyPlus, Monitor, Pencil, RotateCcw, Trash2, Undo2, X } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DesignList } from '@/pages/pixelArt/DesignList'
import { SaveOutcomeMessage, type LatestSave } from '@/pages/pixelArt/SaveOutcomeMessage'
import { ScenePreview, usePreviewOrientation } from '@/pages/pixelArt/ScenePreview'
import { useDrafts } from '@/pages/pixelArt/useDrafts'
import type { SceneWeather, TimeOfDay } from '@/scene/scene'
import { useScene } from '@/scene/useScene'
import { BUILT_IN_SCENES, getBuiltInSceneId, SCENE_WEATHERS, TIME_OF_DAY_NAMES, TIMES_OF_DAY, WEATHER_NAMES } from '@/scenes/builtInScenes'
import { addLayerToScene, makeCustomId, moveLayerInScene, removeLayerFromScene } from '@/scenes/editScene'
import type { SceneDesign } from '@/scenes/sceneDesign'
import { isBuiltInScene, useSceneActions, useSceneDesigns } from '@/scenes/useSceneDesigns'
import { stackLayers, useShownScene } from '@/scenes/useShownScene'
import { useSettings } from '@/settings/useSettings'

const SELECT_CLASS_NAME = 'h-10 w-full rounded-lg border border-input bg-field px-2 text-sm font-semibold'

interface SceneEditorProps {
  /** Called to work on one of a scene's layers, on the Layers tab. */
  onEditLayer: (layerId: string) => void
}

/**
 * Builds scenes out of layers: each scene is a stack of layers, back first, such as the sky, the animals and the rain.
 * Every time of day in every weather has a scene of the site's own, which the backdrop shows automatically, and scenes
 * of one's own can be made, which each screen can choose in its settings. Work on each scene is kept while moving
 * between them, until it is saved or discarded.
 */
export function SceneEditor({ onEditLayer }: SceneEditorProps) {
  const designs = useSceneDesigns()
  const { saveScene, forgetScene } = useSceneActions()
  const liveScene = useScene()
  const shownScene = useShownScene()
  const [settings, changeSettings] = useSettings()
  const drafts = useDrafts<SceneDesign>()
  const [orientation, setOrientation] = usePreviewOrientation()
  const [chosenSceneId, setChosenSceneId] = useState(() => getBuiltInSceneId(liveScene.timeOfDay, liveScene.weather))
  const [latestSave, setLatestSave] = useState<LatestSave | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // A scene of one's own that has been deleted on another screen falls back to the first of the site's own.
  const sceneId = designs.designOf(chosenSceneId) ? chosenSceneId : BUILT_IN_SCENES[0].id
  const savedScene = designs.designOf(sceneId)!
  const scene = drafts.draftOf(sceneId, savedScene)
  const isCustom = !isBuiltInScene(sceneId)
  const hasUnsavedChanges = drafts.hasUnsavedChanges(sceneId, savedScene)
  const unusedLayers = designs.layers.filter((layer) => !scene.layerIds.includes(layer.id))

  const edit = (change: (draft: SceneDesign) => SceneDesign, group?: string) => {
    setLatestSave(null)
    drafts.edit(sceneId, savedScene, change, group)
  }

  const choose = (id: string) => {
    setChosenSceneId(id)
    setLatestSave(null)
  }

  const describeState = (id: string) => {
    const saved = designs.designOf(id)
    if (saved && drafts.hasUnsavedChanges(id, saved)) return 'Not on the site yet'
    return designs.isChanged(id) ? 'Changed' : undefined
  }

  const showOnSite = async () => {
    const id = sceneId
    const outcome = await saveScene(id, scene)
    if (outcome === 'saved') drafts.forget(id)
    setLatestSave({ outcome, successMessage: 'Done. Every screen now shows this scene as you built it.' })
  }

  const putBackOrDelete = async () => {
    const id = sceneId
    const outcome = await forgetScene(id)
    if (outcome === 'saved') {
      drafts.forget(id)
      if (isCustom) {
        if (settings.chosenSceneId === id) changeSettings({ chosenSceneId: null })
        choose(BUILT_IN_SCENES[0].id)
      }
    }
    setLatestSave({ outcome, successMessage: isCustom ? 'Done. That scene is gone.' : "Done. Every screen now shows the site's own scene again." })
  }

  /** Makes a scene of one's own, starting as a copy of the one being worked on, and saves it straight away. */
  const createScene = async () => {
    const id = makeCustomId()
    const name = isCustom ? `${scene.name} (copy)`.slice(0, 80) : 'My scene'
    const outcome = await saveScene(id, { ...scene, name })
    if (outcome === 'saved') choose(id)
    setLatestSave({ outcome, successMessage: `Made "${name}", starting from a copy of the scene you were on. Show it on any screen from its settings.` })
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_17rem]">
      <section aria-label={`Building ${scene.name}`} className="panel grid gap-5 rounded-3xl p-4 shadow-md shadow-shade sm:p-6">
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-field/70 px-4 py-3 text-sm">
          <span>
            Behind this screen now: <span className="font-bold">{shownScene.scene.name}</span>
            {shownScene.isChosen ? ', chosen for this screen.' : ', following the time of day and weather.'}
          </span>
          {shownScene.isChosen && (
            <Button variant="outline" onClick={() => changeSettings({ chosenSceneId: null })} className="h-9 rounded-full px-4 font-bold">
              Follow the time and weather again
            </Button>
          )}
        </div>

        {isCustom ? (
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <label className="grid gap-1 text-sm font-semibold">
              Name
              <Input value={scene.name} maxLength={80} onChange={(event) => edit((draft) => ({ ...draft, name: event.target.value }), 'name')} className="h-10 bg-field text-base" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Colours of
              <select
                className={SELECT_CLASS_NAME}
                value={scene.look.timeOfDay}
                onChange={(event) => edit((draft) => ({ ...draft, look: { ...draft.look, timeOfDay: event.target.value as TimeOfDay } }))}
              >
                {TIMES_OF_DAY.map((timeOfDay) => (
                  <option key={timeOfDay} value={timeOfDay}>
                    {TIME_OF_DAY_NAMES[timeOfDay]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              In the weather
              <select
                className={SELECT_CLASS_NAME}
                value={scene.look.weather}
                onChange={(event) => edit((draft) => ({ ...draft, look: { ...draft.look, weather: event.target.value as SceneWeather } }))}
              >
                {SCENE_WEATHERS.map((weather) => (
                  <option key={weather} value={weather}>
                    {WEATHER_NAMES[weather]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="grid gap-1">
            <h2 className="text-2xl font-semibold">{scene.name}</h2>
            <p className="text-sm text-muted-foreground">
              Every screen shows this automatically at {TIME_OF_DAY_NAMES[scene.look.timeOfDay].toLowerCase()} when the weather is{' '}
              {WEATHER_NAMES[scene.look.weather].toLowerCase()}, unless it has chosen a scene of your own in its settings.
            </p>
          </div>
        )}

        <ScenePreview
          look={scene.look}
          layers={stackLayers(scene, designs.layerOf)}
          moonPhase={liveScene.moonPhase}
          orientation={orientation}
          onOrientationChange={setOrientation}
        />

        <section aria-label="Layers" className="grid gap-2 rounded-2xl bg-field/70 p-4">
          <h3 className="text-lg font-semibold">Layers, front first</h3>
          <ol className="grid gap-1">
            {[...scene.layerIds].reverse().map((layerId, index, frontFirst) => (
              <li key={layerId} className="flex items-center gap-2 rounded-xl bg-card px-3 py-1.5">
                <span className="flex-1 text-sm font-semibold">{designs.layerOf(layerId)?.name ?? 'A layer that has been deleted'}</span>
                <Button variant="ghost" size="icon" aria-label={`Bring ${designs.layerOf(layerId)?.name ?? layerId} forward`} disabled={index === 0} onClick={() => edit((draft) => moveLayerInScene(draft, layerId, 'forward'))}>
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Send ${designs.layerOf(layerId)?.name ?? layerId} back`}
                  disabled={index === frontFirst.length - 1}
                  onClick={() => edit((draft) => moveLayerInScene(draft, layerId, 'back'))}
                >
                  <ArrowDown />
                </Button>
                {designs.layerOf(layerId) && (
                  <Button variant="ghost" size="icon" aria-label={`Edit ${designs.layerOf(layerId)?.name}`} onClick={() => onEditLayer(layerId)}>
                    <Pencil />
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label={`Take ${designs.layerOf(layerId)?.name ?? layerId} out`} onClick={() => edit((draft) => removeLayerFromScene(draft, layerId))}>
                  <X />
                </Button>
              </li>
            ))}
          </ol>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Add a layer at the front
            <select
              className={SELECT_CLASS_NAME + ' w-auto bg-card'}
              value=""
              onChange={(event) => event.target.value && edit((draft) => addLayerToScene(draft, event.target.value))}
            >
              <option value="">Choose one…</option>
              {unusedLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.design.name}
                </option>
              ))}
            </select>
          </label>
        </section>

      <DesignList
        label="Scenes"
        groups={[
          { title: 'Your scenes', items: designs.customScenes.map(({ id, design }) => ({ id, name: design.name, state: describeState(id) })) },
          ...TIMES_OF_DAY.map((timeOfDay) => ({
            title: TIME_OF_DAY_NAMES[timeOfDay],
            items: SCENE_WEATHERS.map((weather) => {
              const id = getBuiltInSceneId(timeOfDay, weather)
              return { id, name: WEATHER_NAMES[weather], accessibleName: `${TIME_OF_DAY_NAMES[timeOfDay]}, ${WEATHER_NAMES[weather].toLowerCase()}`, state: describeState(id) }
            }),
          })),
        ]}
        chosenId={sceneId}
        onChoose={choose}
        createLabel="Make a new scene"
        onCreate={() => void createScene()}
      />

        <div className="flex flex-wrap items-center gap-3 border-t border-panel-edge/40 pt-5">
          <Button onClick={() => void showOnSite()} disabled={!hasUnsavedChanges} className="h-11 rounded-full px-6 text-base font-bold shadow-md shadow-shade">
            Show on the site
          </Button>
          <Button variant="outline" disabled={!drafts.canUndo(sceneId)} onClick={() => drafts.undo(sceneId)} className="h-11 rounded-full px-5 font-bold">
            <Undo2 />
            Undo
          </Button>
          {hasUnsavedChanges && (
            <Button variant="outline" onClick={() => drafts.forget(sceneId)} className="h-11 rounded-full px-5 font-bold">
              Discard changes
            </Button>
          )}
          <Button variant="outline" onClick={() => void createScene()} className="h-11 rounded-full px-5 font-bold">
            <CopyPlus />
            Copy into a new scene
          </Button>
          <Button
            variant={settings.chosenSceneId === sceneId ? 'secondary' : 'outline'}
            aria-pressed={settings.chosenSceneId === sceneId}
            onClick={() => changeSettings({ chosenSceneId: settings.chosenSceneId === sceneId ? null : sceneId })}
            className="h-11 rounded-full px-5 font-bold"
          >
            <Monitor />
            {settings.chosenSceneId === sceneId ? 'Showing behind this screen' : 'Show behind this screen'}
          </Button>
          {!isCustom && designs.isChanged(sceneId) && (
            <Button variant="ghost" onClick={() => void putBackOrDelete()} className="h-11 rounded-full px-5 font-bold">
              <RotateCcw />
              Put back the site's own scene
            </Button>
          )}
          {isCustom && (
            <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)} className="h-11 rounded-full px-5 font-bold">
              <Trash2 />
              Delete this scene
            </Button>
          )}
        </div>
        <SaveOutcomeMessage latestSave={latestSave} />
      </section>

      <ConfirmDeleteDialog
        question="Delete this scene?"
        itemName={scene.name}
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        onConfirm={() => void putBackOrDelete()}
      />
    </div>
  )
}
