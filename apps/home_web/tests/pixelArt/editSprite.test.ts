import { addColour, changeColour, clearSprite, doubleSprite, fillArea, isSameSprite, paintPixel, resizeSprite, shiftSprite } from '@/pixelArt/editSprite'

test('colours only that pixel when painting a pixel', () => {
  const sprite = { rows: ['...', '...'], palette: { o: '#ffd94a' } }

  const painted = paintPixel(sprite, 1, 0, 'o')

  expect(painted.rows).toEqual(['.o.', '...'])
})

test('rubs the pixel out when painting it transparent', () => {
  const sprite = { rows: ['ooo'], palette: { o: '#ffd94a' } }

  const painted = paintPixel(sprite, 2, 0, '.')

  expect(painted.rows).toEqual(['oo.'])
})

test('leaves the sprite as it was when painting a pixel outside it', () => {
  const sprite = { rows: ['...'], palette: { o: '#ffd94a' } }

  const painted = paintPixel(sprite, 3, 0, 'o')

  expect(painted.rows).toEqual(['...'])
})

test('fills only the joined area of the same colour when filling', () => {
  const sprite = {
    rows: ['..o..', '..o..', '..o..'],
    palette: { o: '#ffd94a', w: '#ffffff' },
  }

  const filled = fillArea(sprite, 0, 0, 'w')

  expect(filled.rows).toEqual(['wwo..', 'wwo..', 'wwo..'])
})

test('does not fill diagonally when filling', () => {
  const sprite = { rows: ['o.', '.o'], palette: { o: '#ffd94a', w: '#ffffff' } }

  const filled = fillArea(sprite, 0, 0, 'w')

  expect(filled.rows).toEqual(['w.', '.o'])
})

test('rubs out every pixel and keeps the size and palette when clearing', () => {
  const sprite = { rows: ['oo', 'o.'], palette: { o: '#ffd94a' } }

  const cleared = clearSprite(sprite)

  expect(cleared).toEqual({ rows: ['..', '..'], palette: { o: '#ffd94a' } })
})

test('adds transparent pixels on the right and at the bottom when making a sprite bigger', () => {
  const sprite = { rows: ['oo'], palette: { o: '#ffd94a' } }

  const resized = resizeSprite(sprite, 3, 2)

  expect(resized.rows).toEqual(['oo.', '...'])
})

test('drops pixels from the right and the bottom when making a sprite smaller', () => {
  const sprite = { rows: ['abc', 'def'], palette: { a: '#000000', b: '#000000', c: '#000000', d: '#000000', e: '#000000', f: '#000000' } }

  const resized = resizeSprite(sprite, 2, 1)

  expect(resized.rows).toEqual(['ab'])
})

test('keeps the sprite between 1 and 128 pixels along each side when resizing', () => {
  const sprite = { rows: ['o'], palette: { o: '#ffd94a' } }

  const resized = resizeSprite(sprite, 0, 200)

  expect(resized.rows[0]).toHaveLength(1)
  expect(resized.rows).toHaveLength(128)
})

test('gives a character that the palette does not use when adding a new colour', () => {
  const sprite = { rows: ['a'], palette: { a: '#ffd94a' } }

  const { sprite: withColour, key } = addColour(sprite, '#123456')

  expect(key).toBe('b')
  expect(withColour.palette).toEqual({ a: '#ffd94a', b: '#123456' })
})

test('gives the existing character and leaves the palette as it was when adding a colour it already has', () => {
  const sprite = { rows: ['o'], palette: { o: '#ffd94a' } }

  const { sprite: withColour, key } = addColour(sprite, '#ffd94a')

  expect(key).toBe('o')
  expect(withColour.palette).toEqual({ o: '#ffd94a' })
})

test('recolours every pixel of that colour when changing a colour', () => {
  const sprite = { rows: ['oo'], palette: { o: '#ffd94a' } }

  const changed = changeColour(sprite, 'o', '#ff0000')

  expect(changed).toEqual({ rows: ['oo'], palette: { o: '#ff0000' } })
})

test('treats sprites as the same when only the order of their palettes differs', () => {
  const first = { rows: ['ab'], palette: { a: '#000000', b: '#ffffff' } }
  const second = { rows: ['ab'], palette: { b: '#ffffff', a: '#000000' } }

  expect(isSameSprite(first, second)).toBe(true)
})

test('treats sprites as different when one has a colour that the other does not', () => {
  const first = { rows: ['a'], palette: { a: '#000000' } }
  const second = { rows: ['a'], palette: { a: '#000000', b: '#ffffff' } }

  expect(isSameSprite(first, second)).toBe(false)
})

test('turns each pixel into a square of four when doubling a sprite', () => {
  const sprite = { rows: ['o.'], palette: { o: '#ffd94a' } }

  const doubled = doubleSprite(sprite)

  expect(doubled.rows).toEqual(['oo..', 'oo..'])
})

test('leaves the sprite as it was when doubling would make it more than 128 pixels across', () => {
  const sprite = { rows: ['o'.repeat(65)], palette: { o: '#ffd94a' } }

  const doubled = doubleSprite(sprite)

  expect(doubled).toBe(sprite)
})

test('brings pixels that leave one edge back in at the opposite one when sliding a sprite', () => {
  const sprite = { rows: ['o..', '...'], palette: { o: '#ffd94a' } }

  const shifted = shiftSprite(sprite, -1, 1)

  expect(shifted.rows).toEqual(['...', '..o'])
})
