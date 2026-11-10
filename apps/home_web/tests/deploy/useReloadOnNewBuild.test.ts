import { isNewerBuildServed } from '@/deploy/useReloadOnNewBuild'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reports a newer build when the server is serving a different build ID', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ buildId: 'a-different-build' })))

  const isNewer = await isNewerBuildServed()

  expect(isNewer).toBe(true)
})

test('reports no newer build when the server is serving this page\'s build ID', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ buildId: __BUILD_ID__ })))

  const isNewer = await isNewerBuildServed()

  expect(isNewer).toBe(false)
})

test('reports no newer build when the server cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  const isNewer = await isNewerBuildServed()

  expect(isNewer).toBe(false)
})

test('reports no newer build when the server answers with an error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })))

  const isNewer = await isNewerBuildServed()

  expect(isNewer).toBe(false)
})

test('reports no newer build when the server answers with something other than a build ID', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 200 })))

  const isNewer = await isNewerBuildServed()

  expect(isNewer).toBe(false)
})
