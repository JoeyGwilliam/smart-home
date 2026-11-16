import { ArrowDown, ArrowUp, CopyPlus, Pencil, RotateCcw, Trash2, Undo2, X } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DesignList } from '@/pages/pixelArt/DesignList'
import { PictureSelect } from '@/pages/pixelArt/PictureSelect'
import { PlacementInspector } from '@/pages/pixelArt/PlacementInspector'
import { SaveOutcomeMessage, type LatestSave } from '@/pages/pixelArt/SaveOutcomeMessage'
import { getPreviewScreenHeight, ScenePreview, usePreviewOrientation } from '@/pages/pixelArt/ScenePreview'
import { useDrafts } from '@/pages/pixelArt/useDrafts'
import { findVariant, getFrameSprite, type PixelArt } from '@/pixelArt/pixelArt'
import { usePictures } from '@/pixelArt/usePictures'
import { useScene } from '@/scene/useScene'
import { BUILT_IN_SCENES, getBuiltInSceneId } from '@/scenes/builtInScenes'
import { cn } from 'cn'
import { addPlacement, changeAnchor, changePlacement, makeCustomId, removePlacement, reorderPlacement } from '@/scenes/editScene'
import type { LayerDesign, ScenePlacement } from '@/scenes/sceneDesign'
import { isBuiltInLayer, useSceneActions, useSceneDesigns } from '@/scenes/useSceneDesigns'
import { stackLayers, type StackedLayer } from '@/scenes/useShownScene'

const SELECT_CLASS_NAME = 'h-10 w-full rounded-lg border border-input bg-field px-2 text-sm font-semibold'

interface LayerEditorProps {
  /** The layer to work on, as chosen here or on the Scenes tab. */
  chosenLayerId: string
  onChooseLayer: (layerId: string) => void
}

/**
 * Arranges the pictures in layers. The layer is shown in a scene, to see how it fits in, but only its own pictures can
 * be pressed and dragged, however much of the screen the other layers cover. A change to a layer shows in every scene
 * that uses it. Work on each layer is kept while moving between them, until it is saved or discarded.
 */
export function LayerEditor({ chosenLayerId, onChooseLayer }: LayerEditorProps) {
  const designs = useSceneDesigns()
  const { saveLayer, forgetLayer } = useSceneActions()
  const { pictureOf } = usePictures()
  const liveScene = useScene()
  const drafts = useDrafts<LayerDesign>()
  const [orientation, setOrientation] = usePreviewOrientation()
  // The scene that the layer is shown in, or "" to show the layer on its own.
  const [previewSceneId, setPreviewSceneId] = useState(() => getBuiltInSceneId(liveScene.timeOfDay, liveScene.weather))
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [latestSave, setLatestSave] = useState<LatestSave | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // A layer of one's own that has been deleted on another screen falls back to the first of the site's own.
  const layerId = designs.layerOf(chosenLayerId) ? chosenLayerId : designs.layers[0].id
  const savedLayer = designs.layerOf(layerId)!
  const layer = drafts.draftOf(layerId, savedLayer)
  const isCustom = !isBuiltInLayer(layerId)
  const hasUnsavedChanges = drafts.hasUnsavedChanges(layerId, savedLayer)
  const selectedPlacement = layer.placements.find((placement) => placement.id === selectedPlacementId)

  const previewScene = previewSceneId === '' ? undefined : designs.designOf(previewSceneId)
  const arrangedLayer = { id: layerId, design: layer }
  const previewLayers = previewScene ? arrangePreview(stackLayers(previewScene, designs.layerOf), arrangedLayer) : [arrangedLayer]
  // On its own, the layer takes the colours of the time of day and weather outside.
  const previewLook = previewScene?.look ?? { timeOfDay: liveScene.timeOfDay, weather: liveScene.weather }

  const edit = (change: (draft: LayerDesign) => LayerDesign, group?: string) => {
    setLatestSave(null)
    drafts.edit(layerId, savedLayer, change, group)
  }

  const choose = (id: string) => {
    onChooseLayer(id)
    setSelectedPlacementId(null)
    setLatestSave(null)
  }

  const describeState = (id: string, saved: LayerDesign) =>
    drafts.hasUnsavedChanges(id, saved) ? 'Not on the site yet' : designs.isLayerChanged(id) ? 'Changed' : undefined

  const showOnSite = async () => {
    const id = layerId
    const outcome = await saveLayer(id, layer)
    if (outcome === 'saved') drafts.forget(id)
    setLatestSave({ outcome, successMessage: 'Done. Every scene with this layer now shows it as you arranged it.' })
  }

  const putBackOrDelete = async () => {
    const id = layerId
    const outcome = await forgetLayer(id)
    if (outcome === 'saved') {
      drafts.forget(id)
      if (isCustom) choose(designs.layers[0].id)
    }
    setLatestSave({ outcome, successMessage: isCustom ? 'Done. That layer is gone.' : "Done. Every screen now shows the site's own layer again." })
  }

  /** Makes a layer of one's own, empty or as a copy of the one being worked on, and saves it straight away. */
  const createLayer = async (isCopy: boolean) => {
    const id = makeCustomId()
    const name = isCopy ? `${layer.name} (copy)`.slice(0, 80) : 'My layer'
    const outcome = await saveLayer(id, { name, placements: isCopy ? layer.placements : [] })
    if (outcome === 'saved') choose(id)
    setLatestSave({ outcome, successMessage: `Made "${name}". Add it to any scene on the Scenes tab.` })
  }

  const pictureHeight = (placement: ScenePlacement) => {
    const picture = pictureOf(placement.pictureId)
    return picture ? getFrameSprite(findVariant(picture, placement.variant), 0).rows.length * placement.pixelSize : 0
  }

  const groups = [...new Set(designs.layers.map((listed) => listed.group))]

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_17rem]">
      <section aria-label={`Arranging ${layer.name}`} className="panel grid gap-5 rounded-3xl p-4 shadow-md shadow-shade sm:p-6">
        {isCustom ? (
          <label className="grid gap-1 text-sm font-semibold">
            Name
            <Input value={layer.name} maxLength={80} onChange={(event) => edit((draft) => ({ ...draft, name: event.target.value }), 'name')} className="h-10 bg-field text-base" />
          </label>
        ) : (
          <h2 className="text-2xl font-semibold">{layer.name}</h2>
        )}

        <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          Show it in the scene
          <select className={SELECT_CLASS_NAME + ' w-auto'} value={previewSceneId} onChange={(event) => setPreviewSceneId(event.target.value)}>
            <option value="">None: just this layer</option>
            {[...designs.customScenes, ...BUILT_IN_SCENES].map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.design.name}
              </option>
            ))}
          </select>
        </label>

        <ScenePreview
          look={previewLook}
          layers={previewLayers}
          moonPhase={liveScene.moonPhase}
          orientation={orientation}
          onOrientationChange={setOrientation}
          arranging={{
            layerId,
            selectedPlacementId,
            onSelect: setSelectedPlacementId,
            onMove: (placementId, position, group) => edit((draft) => changePlacement(draft, placementId, position), group),
          }}
        />

        <section aria-label="Pictures in this layer" className="grid gap-2 rounded-2xl bg-field/70 p-4">
          <h3 className="text-lg font-semibold">Pictures, front first</h3>
          {layer.placements.length === 0 && <p className="text-sm text-muted-foreground">This layer is empty. Add a picture to start.</p>}
          <ol className="grid gap-1">
            {[...layer.placements].reverse().map((placement, index, frontFirst) => {
              const name = namePlacement(placement, layer.placements, pictureOf)
              const isSelected = placement.id === selectedPlacementId
              return (
                <li key={placement.id} className={cn('flex items-center gap-2 rounded-xl bg-card px-3 py-1.5', isSelected && 'ring-2 ring-primary')}>
                  <span className="flex-1 text-sm font-semibold">{name}</span>
                  <Button variant="ghost" size="icon" aria-label={`Bring ${name} forward`} disabled={index === 0} onClick={() => edit((draft) => reorderPlacement(draft, placement.id, 'forward'))}>
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Send ${name} back`}
                    disabled={index === frontFirst.length - 1}
                    onClick={() => edit((draft) => reorderPlacement(draft, placement.id, 'back'))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${name}`} aria-pressed={isSelected} onClick={() => setSelectedPlacementId(isSelected ? null : placement.id)}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Take ${name} out`}
                    onClick={() => {
                      edit((draft) => removePlacement(draft, placement.id))
                      if (isSelected) setSelectedPlacementId(null)
                    }}
                  >
                    <X />
                  </Button>
                </li>
              )
            })}
          </ol>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Add a picture at the front
            <PictureSelect
              value=""
              placeholder="Choose one…"
              className="w-auto bg-card"
              onChange={(pictureId) => {
                const picture = pictureOf(pictureId)
                if (!picture) return
                const { design: changedLayer, placementId } = addPlacement(layer, picture)
                edit(() => changedLayer)
                setSelectedPlacementId(placementId)
              }}
            />
          </label>
        </section>

        {selectedPlacement ? (
          <PlacementInspector
            key={selectedPlacement.id}
            placement={selectedPlacement}
            onChange={(changes, group) => edit((draft) => changePlacement(draft, selectedPlacement.id, changes), group)}
            onChangeAnchor={(anchor) => edit((draft) => changeAnchor(draft, selectedPlacement.id, anchor, getPreviewScreenHeight(orientation), pictureHeight(selectedPlacement)))}
          />
        ) : (
          layer.placements.length > 0 && (
            <p className="text-sm text-muted-foreground">Choose a picture from the list, or press one in the preview, to change it. Drag it in the preview to move it.</p>
          )
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-panel-edge/40 pt-5">
          <Button onClick={() => void showOnSite()} disabled={!hasUnsavedChanges} className="h-11 rounded-full px-6 text-base font-bold shadow-md shadow-shade">
            Show on the site
          </Button>
          <Button variant="outline" disabled={!drafts.canUndo(layerId)} onClick={() => drafts.undo(layerId)} className="h-11 rounded-full px-5 font-bold">
            <Undo2 />
            Undo
          </Button>
          {hasUnsavedChanges && (
            <Button variant="outline" onClick={() => drafts.forget(layerId)} className="h-11 rounded-full px-5 font-bold">
              Discard changes
            </Button>
          )}
          <Button variant="outline" onClick={() => void createLayer(true)} className="h-11 rounded-full px-5 font-bold">
            <CopyPlus />
            Copy into a new layer
          </Button>
          {!isCustom && designs.isLayerChanged(layerId) && (
            <Button variant="ghost" onClick={() => void putBackOrDelete()} className="h-11 rounded-full px-5 font-bold">
              <RotateCcw />
              Put back the site's own layer
            </Button>
          )}
          {isCustom && (
            <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)} className="h-11 rounded-full px-5 font-bold">
              <Trash2 />
              Delete this layer
            </Button>
          )}
        </div>
        <SaveOutcomeMessage latestSave={latestSave} />
      </section>

      <DesignList
        label="Layers"
        groups={groups.map((group) => ({
          title: group,
          items: designs.layers.filter((listed) => listed.group === group).map(({ id, design }) => ({ id, name: design.name, state: describeState(id, design) })),
        }))}
        chosenId={layerId}
        onChoose={choose}
        createLabel="Make a new layer"
        onCreate={() => void createLayer(false)}
      />

      <ConfirmDeleteDialog
        question="Delete this layer?"
        itemName={layer.name}
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        onConfirm={() => void putBackOrDelete()}
      />
    </div>
  )
}

/**
 * Puts the layer being arranged in a scene's stack, as it is now rather than as it is saved: in its own place if the
 * scene has it, and in front of everything if not.
 */
function arrangePreview(sceneLayers: StackedLayer[], arranged: StackedLayer): StackedLayer[] {
  const isInScene = sceneLayers.some((sceneLayer) => sceneLayer.id === arranged.id)
  return isInScene ? sceneLayers.map((sceneLayer) => (sceneLayer.id === arranged.id ? arranged : sceneLayer)) : [...sceneLayers, arranged]
}

/**
 * Names a placement for the list of a layer's pictures: its picture, and its variant if the picture has several, such as
 * "Umbrella, Red". Placements that would share a name are numbered, such as "Cloud 2".
 */
function namePlacement(placement: ScenePlacement, placements: ScenePlacement[], pictureOf: (pictureId: string) => PixelArt | undefined): string {
  const describe = (candidate: ScenePlacement) => {
    const picture = pictureOf(candidate.pictureId)
    if (!picture) return 'A picture that has been deleted'
    return picture.variants.length > 1 ? `${picture.title}, ${findVariant(picture, candidate.variant).name}` : picture.title
  }
  const name = describe(placement)
  const namesakes = placements.filter((candidate) => describe(candidate) === name)
  return namesakes.length > 1 ? `${name} ${namesakes.indexOf(placement) + 1}` : name
}
