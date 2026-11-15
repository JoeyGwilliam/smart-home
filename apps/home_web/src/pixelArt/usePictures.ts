import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { reportOutcome, type SaveOutcome } from '@/homeApi/homeApi'
import type { ArtVariant, PixelArt } from '@/pixelArt/pixelArt'
import * as picturesApi from '@/pixelArt/picturesApi'
import { SCENE_PICTURES } from '@/pixelArt/scenePictures'

export const PICTURES_QUERY_KEY = ['pixel-art-pictures']

// Every screen shows the same pictures, so each one refreshes by itself to show a picture saved on another. Pictures
// change rarely, so a few seconds' wait on the other screens is fine; the screen that saved one shows it at once.
const REFRESH_INTERVAL_MILLISECONDS = 10_000

/** The group that the pixel art page lists pictures of one's own under. */
const CUSTOM_PICTURE_GROUP = 'Your pictures'

const BUILT_IN_PICTURES = new Map(SCENE_PICTURES.map((picture) => [picture.id, picture]))

/** The pictures, as this screen last heard of them. */
export interface Pictures {
  /**
   * Every picture as every screen should show it: the site's own, each as it was last redrawn, or as the site draws it
   * if it hasn't been; then one's own, in alphabetical order of title.
   */
  pictures: PixelArt[]
  /** Finds a picture by its id, such as one that a scene places, or gives undefined if there is no such picture. */
  pictureOf: (pictureId: string) => PixelArt | undefined
  /** Whether one of the site's own pictures has been redrawn. */
  isRedrawn: (pictureId: string) => boolean
  /** Whether the latest attempt to fetch the pictures failed, in which case they show as last fetched. */
  hasFetchFailed: boolean
}

/**
 * Keeps this screen in step with the pictures that every screen shares. Until they have been fetched, and if the pixel
 * art API can't be reached, pictures show as last fetched, or as the site draws them.
 *
 * @returns The pictures.
 */
export function usePictures(): Pictures {
  const query = useQuery({ queryKey: PICTURES_QUERY_KEY, queryFn: picturesApi.listPictures, refetchInterval: REFRESH_INTERVAL_MILLISECONDS })
  const savedPictures = query.data ?? {}

  const builtInPictures = SCENE_PICTURES.map((picture) => (picture.id in savedPictures ? { ...picture, variants: savedPictures[picture.id].variants } : picture))
  const customPictures: PixelArt[] = Object.entries(savedPictures)
    .filter(([pictureId]) => !BUILT_IN_PICTURES.has(pictureId))
    .map(([id, { variants, title }]) => ({ id, title: title ?? id, group: CUSTOM_PICTURE_GROUP, variants }))
    .sort((first, second) => first.title.localeCompare(second.title, undefined, { sensitivity: 'base' }))
  const pictures = [...builtInPictures, ...customPictures]

  return {
    pictures,
    pictureOf: (pictureId) => pictures.find((picture) => picture.id === pictureId),
    isRedrawn: (pictureId) => BUILT_IN_PICTURES.has(pictureId) && pictureId in savedPictures,
    hasFetchFailed: query.isError,
  }
}

/**
 * Tells whether a picture is one of one's own, rather than one of the site's.
 *
 * @returns Whether it is one's own.
 */
export function isCustomPicture(pictureId: string): boolean {
  return !BUILT_IN_PICTURES.has(pictureId)
}

/** Changes to the pictures. None of them throw: each reports its outcome instead. */
export interface PictureActions {
  /** Shows a picture with these variants on every screen. A picture of one's own keeps its title. */
  savePicture: (art: PixelArt, variants: ArtVariant[]) => Promise<SaveOutcome>
  /** Makes a new picture of one's own, with the given id, which must be one that no picture has. */
  createPicture: (pictureId: string, title: string, variants: ArtVariant[]) => Promise<SaveOutcome>
  /** Renames a picture of one's own, keeping it as it is shown now. */
  renamePicture: (art: PixelArt, title: string) => Promise<SaveOutcome>
  /** Shows the site's own picture again on every screen, or deletes a picture of one's own. */
  forgetPicture: (pictureId: string) => Promise<SaveOutcome>
}

/**
 * Provides the changes that can be made to the pictures, showing each on this screen as soon as it is saved.
 *
 * @returns The actions.
 */
export function usePictureActions(): PictureActions {
  const queryClient = useQueryClient()

  const changeMutation = useMutation({
    mutationFn: (change: PictureChange) => change.send(),
    onSuccess: async (_result, change) => {
      // The change is known to have been kept, so there's no need to ask again. A refresh that was sent before it
      // reached the API would bring back the pictures as they were.
      await queryClient.cancelQueries({ queryKey: PICTURES_QUERY_KEY })
      queryClient.setQueryData<Record<string, picturesApi.SavedPicture>>(PICTURES_QUERY_KEY, (saved) => change.apply(saved ?? {}))
    },
  })

  const keep = (pictureId: string, picture: picturesApi.SavedPicture) =>
    reportOutcome(
      changeMutation.mutateAsync({ send: () => picturesApi.savePicture(pictureId, picture), apply: (saved) => ({ ...saved, [pictureId]: picture }) }),
    )

  return {
    savePicture: (art, variants) => keep(art.id, { variants, title: isCustomPicture(art.id) ? art.title : null }),
    createPicture: (pictureId, title, variants) => keep(pictureId, { variants, title }),
    renamePicture: (art, title) => keep(art.id, { variants: art.variants, title }),
    forgetPicture: (pictureId) =>
      reportOutcome(
        changeMutation.mutateAsync({
          send: () => picturesApi.deletePicture(pictureId),
          apply: (saved) => Object.fromEntries(Object.entries(saved).filter(([savedId]) => savedId !== pictureId)),
        }),
      ),
  }
}

/** A change to send to the pixel art API, and how it changes the saved pictures once the API has kept it. */
interface PictureChange {
  send: () => Promise<void>
  apply: (saved: Record<string, picturesApi.SavedPicture>) => Record<string, picturesApi.SavedPicture>
}
