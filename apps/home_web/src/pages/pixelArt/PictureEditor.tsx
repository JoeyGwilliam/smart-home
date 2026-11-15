import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { PixelSprite, SCENE_PIXEL_SIZE } from '@/components/PixelSprite'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DrawingEditor } from '@/pages/pixelArt/DrawingEditor'
import { recordEdit, startHistory, undoEdit, type EditHistory } from '@/pages/pixelArt/editHistory'
import { FrameStrip } from '@/pages/pixelArt/FrameStrip'
import { PicturePicker } from '@/pages/pixelArt/PicturePicker'
import { SaveOutcomeMessage, type LatestSave } from '@/pages/pixelArt/SaveOutcomeMessage'
import { VariantBar } from '@/pages/pixelArt/VariantBar'
import { addFrame, addVariant, changeFrameTime, editFrame, isSameVariants, removeFrame, removeVariant, renameVariant } from '@/pixelArt/editPicture'
import { shiftSprite } from '@/pixelArt/editSprite'
import { getFrameSprite, type ArtVariant } from '@/pixelArt/pixelArt'
import { SCENE_PICTURES } from '@/pixelArt/scenePictures'
import { isCustomPicture, usePictureActions, usePictures } from '@/pixelArt/usePictures'
import { makeCustomId } from '@/scenes/editScene'

/**
 * Draws the pictures that layers are made of. Each picture has variants, the ways it can look, and each
 * variant has frames, which play in turn; a picture is drawn a frame at a time, pixel by pixel. The site's own pictures
 * can be redrawn and put back, and pictures of one's own can be made, renamed and deleted. Each change shows on every
 * screen as soon as it is saved. Work on each picture is kept while moving between them, until it is saved or discarded.
 */
export function PictureEditor() {
  const pictures = usePictures()
  const { savePicture, createPicture, renamePicture, forgetPicture } = usePictureActions()
  const [chosenPictureId, setChosenPictureId] = useState(SCENE_PICTURES[0].id)
  const [chosenVariantIndex, setChosenVariantIndex] = useState(0)
  const [chosenFrameIndex, setChosenFrameIndex] = useState(0)
  // Only pictures that have been edited here have a history. The rest are shown as the site shows them.
  const [histories, setHistories] = useState<Record<string, EditHistory<ArtVariant[]>>>({})
  const [latestSave, setLatestSave] = useState<LatestSave | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // A picture of one's own that has been deleted on another screen falls back to the first of the site's own.
  const chosenPicture = pictures.pictureOf(chosenPictureId) ?? pictures.pictures[0]
  const isCustom = isCustomPicture(chosenPicture.id)
  const history = histories[chosenPicture.id]
  const variants = history?.present ?? chosenPicture.variants
  const hasUnsavedChanges = history !== undefined && !isSameVariants(variants, chosenPicture.variants)
  const unsavedPictureIds = new Set(
    pictures.pictures.filter((picture) => histories[picture.id] && !isSameVariants(histories[picture.id].present, picture.variants)).map((picture) => picture.id),
  )
  // An undo or another screen's change can leave fewer variants or frames than were chosen.
  const variantIndex = Math.min(chosenVariantIndex, variants.length - 1)
  const variant = variants[variantIndex]
  const frameIndex = Math.min(chosenFrameIndex, variant.frames.length - 1)
  const drawing = getFrameSprite(variant, frameIndex)

  const edit = (change: (variants: ArtVariant[]) => ArtVariant[], group?: string) => {
    setLatestSave(null)
    setHistories((previous) => {
      const pictureHistory = previous[chosenPicture.id] ?? startHistory(chosenPicture.variants)
      return { ...previous, [chosenPicture.id]: recordEdit(pictureHistory, change(pictureHistory.present), group) }
    })
  }

  const forgetChanges = (pictureId: string) => {
    setHistories(({ [pictureId]: _forgotten, ...others }) => others)
  }

  const choosePicture = (pictureId: string) => {
    setChosenPictureId(pictureId)
    setChosenVariantIndex(0)
    setChosenFrameIndex(0)
    setLatestSave(null)
  }

  const chooseVariant = (index: number) => {
    setChosenVariantIndex(index)
    setChosenFrameIndex(0)
  }

  const showOnSite = async () => {
    const picture = chosenPicture
    const outcome = await savePicture(picture, variants)
    if (outcome === 'saved') forgetChanges(picture.id)
    setLatestSave({ outcome, successMessage: 'Done. Every screen now shows your drawing.' })
  }

  const putBackOrDelete = async () => {
    const pictureId = chosenPicture.id
    const outcome = await forgetPicture(pictureId)
    if (outcome === 'saved') forgetChanges(pictureId)
    if (outcome === 'saved' && isCustom) choosePicture(SCENE_PICTURES[0].id)
    setLatestSave({ outcome, successMessage: isCustom ? 'Done. That picture is gone.' : "Done. Every screen now shows the site's own picture again." })
  }

  /** Makes a picture of one's own, starting as a copy of the picture being worked on, and saves it straight away. */
  const makeNewPicture = async () => {
    const pictureId = makeCustomId()
    const title = isCustom ? `${chosenPicture.title} (copy)`.slice(0, 80) : 'My picture'
    const outcome = await createPicture(pictureId, title, variants)
    if (outcome === 'saved') choosePicture(pictureId)
    setLatestSave({ outcome, successMessage: `Made "${title}", starting from a copy of the picture you were on. Place it in any scene.` })
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_17rem]">
      <section aria-label={`Drawing ${chosenPicture.title}`} className="panel grid gap-5 rounded-3xl p-4 shadow-md shadow-shade sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {isCustom ? (
            <label className="grid min-w-60 flex-1 gap-1 text-sm font-semibold">
              Name
              <Input
                key={chosenPicture.id + chosenPicture.title}
                defaultValue={chosenPicture.title}
                maxLength={80}
                className="h-10 bg-field text-base"
                onBlur={(event) => {
                  const title = event.target.value.trim()
                  if (title && title !== chosenPicture.title) void renamePicture(chosenPicture, title)
                }}
                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
              />
            </label>
          ) : (
            <h2 className="text-2xl font-semibold">{chosenPicture.title}</h2>
          )}
          <div className="grid justify-items-end gap-1 text-sm text-muted-foreground">
            <span>Actual size</span>
            <div className="grid max-h-40 max-w-60 min-h-12 min-w-12 place-items-center overflow-hidden rounded-lg bg-field p-2">
              <PixelSprite sprite={drawing} pixelSize={SCENE_PIXEL_SIZE} />
            </div>
          </div>
        </div>

        <VariantBar
          variants={variants}
          chosenVariantIndex={variantIndex}
          onChoose={chooseVariant}
          onAdd={() => {
            edit((current) => addVariant(current, variantIndex))
            chooseVariant(variantIndex + 1)
          }}
          onRename={(name) => edit((current) => renameVariant(current, variantIndex, name))}
          onRemove={() => {
            edit((current) => removeVariant(current, variantIndex))
            chooseVariant(Math.max(variantIndex - 1, 0))
          }}
        />

        <FrameStrip
          variant={variant}
          chosenFrameIndex={frameIndex}
          onChoose={setChosenFrameIndex}
          onAdd={() => {
            edit((current) => addFrame(current, variantIndex, frameIndex))
            setChosenFrameIndex(frameIndex + 1)
          }}
          onRemove={() => {
            edit((current) => removeFrame(current, variantIndex, frameIndex))
            setChosenFrameIndex(Math.max(frameIndex - 1, 0))
          }}
          onChangeTime={(milliseconds) => edit((current) => changeFrameTime(current, variantIndex, frameIndex, milliseconds))}
          onSlide={(across, down) => edit((current) => editFrame(current, variantIndex, frameIndex, (frame) => shiftSprite(frame, across, down)))}
        />

        <DrawingEditor
          key={`${chosenPicture.id}-${variantIndex}`}
          drawing={drawing}
          colourNames={nameSceneColours(variant.palette)}
          onEdit={(change, group) => edit((current) => editFrame(current, variantIndex, frameIndex, change), group)}
          canUndo={history !== undefined && history.past.length > 0}
          onUndo={() => setHistories((previous) => ({ ...previous, [chosenPicture.id]: undoEdit(previous[chosenPicture.id]) }))}
        />

        <div className="flex flex-wrap items-center gap-3 border-t border-panel-edge/40 pt-5">
          <Button onClick={() => void showOnSite()} disabled={!hasUnsavedChanges} className="h-11 rounded-full px-6 text-base font-bold shadow-md shadow-shade">
            Show on the site
          </Button>
          {hasUnsavedChanges && (
            <Button variant="outline" onClick={() => forgetChanges(chosenPicture.id)} className="h-11 rounded-full px-5 font-bold">
              Discard changes
            </Button>
          )}
          {pictures.isRedrawn(chosenPicture.id) && (
            <Button variant="ghost" onClick={() => void putBackOrDelete()} className="h-11 rounded-full px-5 font-bold">
              <RotateCcw />
              Put back the site's own picture
            </Button>
          )}
          {isCustom && (
            <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)} className="h-11 rounded-full px-5 font-bold">
              <Trash2 />
              Delete this picture
            </Button>
          )}
        </div>
        <SaveOutcomeMessage latestSave={latestSave} />
      </section>

      <div className="grid gap-3">
        <Button variant="outline" onClick={() => void makeNewPicture()} className="panel h-11 justify-start rounded-2xl font-bold shadow-md shadow-shade">
          <ImagePlus />
          Make a new picture
        </Button>
        <PicturePicker pictures={pictures} chosenPictureId={chosenPicture.id} unsavedPictureIds={unsavedPictureIds} onChoose={choosePicture} />
      </div>

      <ConfirmDeleteDialog
        question="Delete this picture?"
        itemName={chosenPicture.title}
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        onConfirm={() => void putBackOrDelete()}
      />
    </div>
  )
}

/** Names the colours that index.css changes with the time of day and weather, so that the palette can say what they are. */
function nameSceneColours(palette: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(palette)
      .filter(([, colour]) => colour.startsWith('var('))
      .map(([key]) => [key, 'Changes with the time of day and weather']),
  )
}
