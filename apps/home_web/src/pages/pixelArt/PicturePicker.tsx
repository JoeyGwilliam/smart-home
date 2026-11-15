import { PixelSprite } from '@/components/PixelSprite'
import { findStillFrame, getFrameSprite, type PixelArt } from '@/pixelArt/pixelArt'
import type { Pictures } from '@/pixelArt/usePictures'
import { cn } from 'cn'

/** How many screen pixels the longer side of each picture's thumbnail takes up. */
const THUMBNAIL_SIZE = 32

interface PicturePickerProps {
  pictures: Pictures
  chosenPictureId: string
  /** The ids of the pictures that have changes that haven't been shown on the site yet. */
  unsavedPictureIds: Set<string>
  onChoose: (pictureId: string) => void
}

/**
 * Every picture, in its groups, each as it looks on the site now, with how many variants it has, for choosing one to
 * work on.
 */
export function PicturePicker({ pictures, chosenPictureId, unsavedPictureIds, onChoose }: PicturePickerProps) {
  const groups = [...new Set(pictures.pictures.map((picture) => picture.group))]

  return (
    <nav aria-label="Pictures" className="panel grid content-start gap-4 rounded-3xl p-4 shadow-md shadow-shade lg:max-h-[80vh] lg:overflow-y-auto">
      {groups.map((group) => (
        <section key={group} className="grid gap-1">
          <h2 className="px-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">{group}</h2>
          {pictures.pictures
            .filter((picture) => picture.group === group)
            .map((picture) => (
              <PictureButton
                key={picture.id}
                picture={picture}
                state={unsavedPictureIds.has(picture.id) ? 'Not on the site yet' : pictures.isRedrawn(picture.id) ? 'Your drawing' : undefined}
                isChosen={picture.id === chosenPictureId}
                onChoose={() => onChoose(picture.id)}
              />
            ))}
        </section>
      ))}
    </nav>
  )
}

interface PictureButtonProps {
  picture: PixelArt
  /** Such as "Your drawing", or undefined to say nothing. */
  state: string | undefined
  isChosen: boolean
  onChoose: () => void
}

function PictureButton({ picture, state, isChosen, onChoose }: PictureButtonProps) {
  const firstVariant = picture.variants[0]
  const thumbnail = getFrameSprite(firstVariant, findStillFrame(firstVariant))
  const longerSide = Math.max(thumbnail.rows.length, thumbnail.rows[0].length)
  const details = [picture.variants.length > 1 && `${picture.variants.length} variants`, picture.variants.some((variant) => variant.frames.length > 1) && 'animated']
    .filter(Boolean)
    .join(', ')

  return (
    <button
      type="button"
      aria-pressed={isChosen}
      onClick={onChoose}
      className={cn('flex items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted', isChosen && 'bg-secondary text-secondary-foreground hover:bg-secondary')}
    >
      <span className="grid size-9 shrink-0 place-items-center">
        <PixelSprite sprite={thumbnail} pixelSize={THUMBNAIL_SIZE / longerSide} />
      </span>
      <span className="grid">
        <span className="text-sm leading-tight font-semibold">{picture.title}</span>
        {details && <span className="text-xs text-muted-foreground">{details}</span>}
        {state && <span className="text-xs text-muted-foreground">{state}</span>}
      </span>
    </button>
  )
}
