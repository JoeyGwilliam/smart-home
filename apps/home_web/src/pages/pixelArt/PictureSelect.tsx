import { usePictures } from '@/pixelArt/usePictures'
import { cn } from 'cn'

interface PictureSelectProps {
  /** The chosen picture's id, or "" for none, which shows `placeholder`. */
  value: string
  onChange: (pictureId: string) => void
  /** Shown while no picture is chosen, such as "Choose one…". Left out, a picture is always chosen. */
  placeholder?: string
  className?: string
}

/** A list of every picture, the site's own and one's own, in their groups, for choosing one. */
export function PictureSelect({ value, onChange, placeholder, className }: PictureSelectProps) {
  const { pictures } = usePictures()
  const groups = [...new Set(pictures.map((picture) => picture.group))]

  return (
    <select
      className={cn('h-10 w-full rounded-lg border border-input bg-card px-2 text-sm font-semibold', className)}
      value={value}
      onChange={(event) => event.target.value && onChange(event.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {groups.map((group) => (
        <optgroup key={group} label={group}>
          {pictures
            .filter((picture) => picture.group === group)
            .map((picture) => (
              <option key={picture.id} value={picture.id}>
                {picture.title}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}
