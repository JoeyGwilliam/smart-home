import { sendToHomeApi } from '@/homeApi/homeApi'
import type { ArtVariant } from '@/pixelArt/pixelArt'

// nginx.conf and vite.config.ts forward this to the pixel art API.
const PICTURES_URL = '/api/pixel-art/pictures'

/** A picture that the pixel art API keeps. It is sent and received in this same form. */
export interface SavedPicture {
  variants: ArtVariant[]
  /** What a picture of one's own is called, or null for a redrawing of one of the site's own pictures. */
  title: string | null
}

/**
 * Lists every picture that has been saved: redrawings of the site's own pictures, and pictures of one's own.
 *
 * @returns Each picture, keyed by its id (see PixelArt.id).
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function listPictures(): Promise<Record<string, SavedPicture>> {
  const response = await sendToHomeApi('pixel art', 'GET', PICTURES_URL)
  return response.json()
}

/**
 * Keeps a picture for every screen, replacing any picture already kept under its id.
 *
 * @param pictureId The id of one of the site's pictures to redraw, or of a picture of one's own.
 * @param picture The picture. One of one's own must have a title; a redrawing of the site's has none.
 * @throws RequestRefusedError If the API rejects the picture, which happens when a frame is more than 128 pixels across
 *   or down, a variant's frames differ in size, there are too many variants or frames, or a name or the title is blank.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function savePicture(pictureId: string, picture: SavedPicture): Promise<void> {
  await sendToHomeApi('pixel art', 'PUT', `${PICTURES_URL}/${pictureId}`, picture)
}

/**
 * Shows the site's own picture again, or deletes a picture of one's own, on every screen. Does nothing if no picture is
 * kept under the id.
 *
 * @param pictureId The id of the picture.
 * @throws ApiUnavailableError If the API is unavailable.
 */
export async function deletePicture(pictureId: string): Promise<void> {
  await sendToHomeApi('pixel art', 'DELETE', `${PICTURES_URL}/${pictureId}`)
}
