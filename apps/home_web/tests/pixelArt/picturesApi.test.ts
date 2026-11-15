import { deletePicture, listPictures, savePicture } from '@/pixelArt/picturesApi'

const CASTLE = { variants: [{ name: 'Day', palette: { c: '#888888' }, frames: [{ rows: ['c'], milliseconds: 200 }] }], title: 'Castle' }

afterEach(() => {
  vi.unstubAllGlobals()
})

test('gives each picture under its id when listing pictures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ 'custom-castle': CASTLE })))

  const pictures = await listPictures()

  expect(pictures).toEqual({ 'custom-castle': CASTLE })
})

test('puts the picture under its id when saving a picture', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(CASTLE))
  vi.stubGlobal('fetch', fetch)

  await savePicture('custom-castle', CASTLE)

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/pictures/custom-castle')
  expect(request.method).toBe('PUT')
  expect(JSON.parse(request.body)).toEqual(CASTLE)
})

test('sends a delete to the picture when deleting it', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)

  await deletePicture('sun')

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/pixel-art/pictures/sun')
  expect(request.method).toBe('DELETE')
})
