import type { Sprite } from '@/components/PixelSprite'

/** The character of a transparent pixel. Painting with it rubs a pixel out. */
export const TRANSPARENT = '.'

/** The most pixels a drawing can have along either side, which the pixel art API also insists on. */
export const MAX_SIDE_PIXELS = 128

// The characters that a new colour can stand for. Any single character would do, but these are easy to read when a
// drawing is written out, as the site's own pictures are.
const PALETTE_KEYS = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']

// Every function here gives a changed copy of the sprite, leaving the one it was given as it was.

/**
 * Colours one pixel, or rubs it out. Does nothing if the pixel is outside the sprite.
 *
 * @param sprite The sprite to change.
 * @param x How far across the pixel is, counting from 0 at the left.
 * @param y How far down the pixel is, counting from 0 at the top.
 * @param key The palette's character for the colour, or TRANSPARENT to rub the pixel out.
 * @returns The changed sprite.
 */
export function paintPixel(sprite: Sprite, x: number, y: number, key: string): Sprite {
  if (!isInside(sprite, x, y)) return sprite
  const rows = sprite.rows.map((row, rowIndex) => (rowIndex === y ? row.slice(0, x) + key + row.slice(x + 1) : row))
  return { ...sprite, rows }
}

/**
 * Colours a pixel and every pixel joined to it, across or down, that is the same colour, like tipping a pot of paint.
 * Does nothing if the pixel is outside the sprite.
 *
 * @param sprite The sprite to change.
 * @param x How far across the pixel is, counting from 0 at the left.
 * @param y How far down the pixel is, counting from 0 at the top.
 * @param key The palette's character for the colour, or TRANSPARENT to rub the area out.
 * @returns The changed sprite.
 */
export function fillArea(sprite: Sprite, x: number, y: number, key: string): Sprite {
  if (!isInside(sprite, x, y)) return sprite
  const pixels = sprite.rows.map((row) => [...row])
  const keyToReplace = pixels[y][x]
  if (keyToReplace === key) return sprite

  const pixelsToVisit = [[x, y]]
  while (pixelsToVisit.length > 0) {
    const [visitedX, visitedY] = pixelsToVisit.pop()!
    if (pixels[visitedY]?.[visitedX] !== keyToReplace) continue
    pixels[visitedY][visitedX] = key
    pixelsToVisit.push([visitedX + 1, visitedY], [visitedX - 1, visitedY], [visitedX, visitedY + 1], [visitedX, visitedY - 1])
  }
  return { ...sprite, rows: pixels.map((row) => row.join('')) }
}

/**
 * Rubs out every pixel, keeping the sprite's size and palette.
 *
 * @param sprite The sprite to change.
 * @returns The changed sprite, which is entirely transparent.
 */
export function clearSprite(sprite: Sprite): Sprite {
  return { ...sprite, rows: sprite.rows.map((row) => TRANSPARENT.repeat(row.length)) }
}

/**
 * Changes the size of a sprite, as if changing the size of a sheet of paper under a drawing that stays put in its
 * top-left corner. New pixels on the right and at the bottom are transparent; pixels that no longer fit are lost.
 *
 * @param sprite The sprite to change.
 * @param width How many pixels across it should be. Kept between 1 and MAX_SIDE_PIXELS.
 * @param height How many pixels down it should be. Kept between 1 and MAX_SIDE_PIXELS.
 * @returns The changed sprite.
 */
export function resizeSprite(sprite: Sprite, width: number, height: number): Sprite {
  const newWidth = Math.min(Math.max(width, 1), MAX_SIDE_PIXELS)
  const newHeight = Math.min(Math.max(height, 1), MAX_SIDE_PIXELS)
  const rows = Array.from({ length: newHeight }, (_, y) => (sprite.rows[y] ?? '').slice(0, newWidth).padEnd(newWidth, TRANSPARENT))
  return { ...sprite, rows }
}

/**
 * Doubles a sprite's size, turning each pixel into a square of four, so that it looks the same but can be drawn in
 * finer detail. Does nothing if the sprite would then be more than MAX_SIDE_PIXELS along a side.
 *
 * @param sprite The sprite to change.
 * @returns The changed sprite.
 */
export function doubleSprite(sprite: Sprite): Sprite {
  if (sprite.rows.length * 2 > MAX_SIDE_PIXELS || sprite.rows[0].length * 2 > MAX_SIDE_PIXELS) return sprite
  const rows = sprite.rows.flatMap((row) => {
    const doubledRow = [...row].map((character) => character + character).join('')
    return [doubledRow, doubledRow]
  })
  return { ...sprite, rows }
}

/**
 * Makes a colour available to paint with, unless the palette already has it.
 *
 * @param sprite The sprite to change.
 * @param colour The colour, such as "#ffd94a".
 * @returns The sprite, with the colour in its palette, and the palette's character for the colour.
 * @throws RangeError If the palette is already full, with 62 colours, and doesn't have this one.
 */
export function addColour(sprite: Sprite, colour: string): { sprite: Sprite; key: string } {
  const existingKey = Object.keys(sprite.palette).find((key) => sprite.palette[key] === colour)
  if (existingKey !== undefined) return { sprite, key: existingKey }

  const key = PALETTE_KEYS.find((candidate) => !(candidate in sprite.palette))
  if (key === undefined) throw new RangeError('A drawing can have no more than 62 colours.')
  return { sprite: { ...sprite, palette: { ...sprite.palette, [key]: colour } }, key }
}

/**
 * Changes one of the palette's colours, recolouring every pixel painted in it.
 *
 * @param sprite The sprite to change.
 * @param key The palette's character for the colour.
 * @param colour The new colour, such as "#ffd94a".
 * @returns The changed sprite.
 */
export function changeColour(sprite: Sprite, key: string, colour: string): Sprite {
  return { ...sprite, palette: { ...sprite.palette, [key]: colour } }
}

/**
 * Tells whether two sprites look the same, with the same pixels and the same colour for each character.
 *
 * @returns Whether they look the same.
 */
export function isSameSprite(first: Sprite, second: Sprite): boolean {
  const keys = new Set([...Object.keys(first.palette), ...Object.keys(second.palette)])
  return first.rows.join('\n') === second.rows.join('\n') && [...keys].every((key) => first.palette[key] === second.palette[key])
}

function isInside(sprite: Sprite, x: number, y: number): boolean {
  return y >= 0 && y < sprite.rows.length && x >= 0 && x < sprite.rows[0].length
}

/**
 * Slides every pixel of a sprite, with those that leave one edge coming back in at the opposite one, so that a tile
 * that repeats still joins up. Sliding a copy of a frame a little further each time makes something fall or drift.
 *
 * @param sprite The sprite to change.
 * @param across How many pixels to slide to the right. Negative slides left.
 * @param down How many pixels to slide down. Negative slides up.
 * @returns The changed sprite.
 */
export function shiftSprite(sprite: Sprite, across: number, down: number): Sprite {
  const height = sprite.rows.length
  const width = sprite.rows[0].length
  const wrap = (position: number, size: number) => ((position % size) + size) % size
  const rows = sprite.rows.map((_, y) => {
    const sourceRow = sprite.rows[wrap(y - down, height)]
    return [...sourceRow].map((_character, x) => sourceRow[wrap(x - across, width)]).join('')
  })
  return { ...sprite, rows }
}
