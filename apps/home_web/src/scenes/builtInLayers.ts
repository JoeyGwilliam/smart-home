import { FIREFLY, LIGHTNING, RAIN, SNOW, YAWN, ZZZ } from '@/pixelArt/animatedPictures'
import type { PixelArt } from '@/pixelArt/pixelArt'
import {
  BRIGHT_STAR,
  BUTTERFLY,
  CHICKEN,
  CLOUD,
  CLOUD_BANK,
  COW,
  FAINT_STARS,
  FOG,
  GRASS,
  MOON,
  OVERCAST,
  PUDDLE,
  SHEEP,
  SKY,
  SNOWMAN,
  SUN,
  UMBRELLA,
} from '@/pixelArt/scenePictures'
import type { TimeOfDay } from '@/scene/scene'
import { createPlacement } from '@/scenes/editScene'
import type { LayerDesign, ScenePlacement } from '@/scenes/sceneDesign'

// The site's own layers, as they are designed until someone changes them. The site's own scenes stack them up (see
// builtInScenes), so each is something that some scenes have and others don't: the sun shows in clear weather but not in
// fog, the umbrellas in the wet but not in the snow, and so on.

/** One of the site's own layers, and the group that the pixel art page lists it under. */
export interface BuiltInLayer {
  id: string
  group: 'Sky' | 'Ground' | 'Animals' | 'Weather'
  design: LayerDesign
}

/** How far up from the bottom of the screen the animals stand: a little way into the grass, so that they look planted in it. */
const GROUND_HEIGHT = 28

/** Each drawn pixel of the animals, and of most small pictures, is this many screen pixels across. */
const PIXEL_SIZE = 4

/** What an animal is doing, which is the name of the variant that shows it. */
type Pose = 'Standing' | 'Eating' | 'Yawning' | 'Sleeping'

interface Animal {
  id: string
  picture: PixelArt
  /** How far across the screen it stands, as a percentage of the screen's width. The umbrellas stand above these spots. */
  x: number
  isFlipped: boolean
  /**
   * What the animal does at each time of day. Everyone sleeps at night, and only one or two at a time eat or yawn, so
   * that the field looks lively rather than drilled.
   */
  poses: Record<TimeOfDay, Pose>
  /** Whether Zzzs rise from the animal while it sleeps. Only some do, so that the field isn't full of them. */
  isSnorer: boolean
  /** The colour of its umbrella in the wet, as the name of the umbrella's variant. */
  umbrella: string
}

const ANIMALS: Animal[] = [
  { id: 'cow', picture: COW, x: 10, isFlipped: false, poses: { sunrise: 'Yawning', day: 'Standing', sunset: 'Eating', night: 'Sleeping' }, isSnorer: true, umbrella: 'Red' },
  {
    id: 'chicken-1',
    picture: CHICKEN,
    x: 36,
    isFlipped: true,
    poses: { sunrise: 'Standing', day: 'Eating', sunset: 'Standing', night: 'Sleeping' },
    isSnorer: false,
    umbrella: 'Blue',
  },
  {
    id: 'sheep',
    picture: SHEEP,
    x: 60,
    isFlipped: false,
    poses: { sunrise: 'Standing', day: 'Eating', sunset: 'Standing', night: 'Sleeping' },
    isSnorer: true,
    umbrella: 'Purple',
  },
  {
    id: 'chicken-2',
    picture: CHICKEN,
    x: 82,
    isFlipped: false,
    poses: { sunrise: 'Yawning', day: 'Standing', sunset: 'Standing', night: 'Sleeping' },
    isSnorer: false,
    umbrella: 'Yellow',
  },
]

/** How far to the right of an animal's left edge its head is, as a percentage of the screen's width, for what rises from it. */
const HEAD_OFFSET = 3

/**
 * How many drawn pixels of an umbrella's pole reach down into a standing animal, so that the animal looks as if it is
 * holding it, and so that the umbrella still reaches an animal that has lain down to sleep.
 */
const UMBRELLA_POLE_OVERLAP = 3

/**
 * The clouds, ordered so that any number taken from the start is spread across the sky. Each starts somewhere along its
 * crossing, at `x`, so that the sky is never empty. A fine sky has the first two; grey weather adds more.
 */
const CLOUDS = [
  { x: 8, y: 8, pixelSize: 10 },
  { x: 53, y: 38, pixelSize: 14 },
  { x: 62, y: 22, pixelSize: 6 },
  { x: -14, y: 55, pixelSize: 8 },
  { x: 41, y: 14, pixelSize: 16 },
  { x: 84, y: 30, pixelSize: 12 },
  { x: 81, y: 3, pixelSize: 13 },
  { x: 17, y: 46, pixelSize: 11 },
  { x: 95, y: 18, pixelSize: 18 },
  { x: -16, y: 5, pixelSize: 15 },
  { x: 22, y: 34, pixelSize: 16 },
  { x: 79, y: 26, pixelSize: 13 },
  { x: 95, y: 11, pixelSize: 12 },
  { x: 80, y: 42, pixelSize: 15 },
]

const TIME_OF_DAY_TITLES: Record<TimeOfDay, string> = { sunrise: 'at sunrise', day: 'by day', sunset: 'at sunset', night: 'at night' }

function getPoseHeight(picture: PixelArt, pose: Pose): number {
  const variant = picture.variants.find((candidate) => candidate.name === pose) ?? picture.variants[0]
  return variant.frames[0].rows.length
}

/** Places the animals as they are at a time of day, with what rises from them after all of them, so that none is drawn over it. */
function placeAnimals(timeOfDay: TimeOfDay): ScenePlacement[] {
  const animals = ANIMALS.map((animal) => {
    const pose = animal.poses[timeOfDay]
    // A sleeping or eating animal stays put.
    const isStill = pose === 'Sleeping' || pose === 'Eating'
    return createPlacement({ id: animal.id, pictureId: animal.picture.id, variant: pose, x: animal.x, anchor: 'bottom', y: GROUND_HEIGHT, isFlipped: animal.isFlipped, motion: isStill ? 'none' : 'hop' })
  })
  const risings = ANIMALS.flatMap((animal) => {
    const pose = animal.poses[timeOfDay]
    const top = GROUND_HEIGHT + getPoseHeight(animal.picture, pose) * PIXEL_SIZE
    if (pose === 'Sleeping' && animal.isSnorer) return [createPlacement({ id: `zzz-${animal.id}`, pictureId: ZZZ.id, x: animal.x + HEAD_OFFSET, anchor: 'bottom', y: top })]
    if (pose === 'Yawning') {
      return [createPlacement({ id: `yawn-${animal.id}`, pictureId: YAWN.id, x: animal.x + HEAD_OFFSET, anchor: 'bottom', y: top, pixelSize: PIXEL_SIZE / 2 })]
    }
    return []
  })
  return [...animals, ...risings]
}

function placeClouds(clouds: typeof CLOUDS, firstNumber: number): ScenePlacement[] {
  return clouds.map((cloud, index) =>
    createPlacement({ id: `cloud-${firstNumber + index}`, pictureId: CLOUD.id, x: cloud.x, anchor: 'top', y: cloud.y, pixelSize: cloud.pixelSize, motion: 'drift' }),
  )
}

/** A grey veil over the sky, partly see-through, so that the sky looks dull. Grass and animals are drawn over it. */
function placeOvercast(opacity: number): ScenePlacement {
  return createPlacement({ id: 'overcast', pictureId: OVERCAST.id, anchor: 'top', y: 0, spread: 'screen', opacity })
}

function layer(id: string, group: BuiltInLayer['group'], name: string, placements: ScenePlacement[]): BuiltInLayer {
  return { id, group, design: { name, placements } }
}

/** Every layer of the site's own, in the order the pixel art page lists them, which is also the order scenes stack them in. */
export const BUILT_IN_LAYERS: BuiltInLayer[] = [
  layer('sky', 'Sky', 'Sky', [createPlacement({ id: 'sky', pictureId: SKY.id, anchor: 'top', y: 0, spread: 'screen' })]),
  layer('stars', 'Sky', 'Stars', [
    createPlacement({ id: 'faint-stars', pictureId: FAINT_STARS.id, anchor: 'top', y: 0, pixelSize: 2, spread: 'tile' }),
    ...[
      { x: 38, y: 6 },
      { x: 62, y: 16 },
      { x: 84, y: 9 },
      { x: 50, y: 28 },
    ].map((star, index) => createPlacement({ id: `bright-star-${index + 1}`, pictureId: BRIGHT_STAR.id, x: star.x, anchor: 'top', y: star.y })),
  ]),
  // At sunrise and sunset the sun is low enough for the grass, a later layer, to hide its lower half, and it sits between
  // the animals so that none stands in front of it.
  layer('sun-sunrise', 'Sky', 'Rising sun', [createPlacement({ id: 'sun', pictureId: SUN.id, variant: 'Low', x: 24, anchor: 'bottom', y: 16, pixelSize: 8 })]),
  layer('sun-day', 'Sky', 'Midday sun', [createPlacement({ id: 'sun', pictureId: SUN.id, variant: 'Midday', x: 14, anchor: 'top', y: 12, pixelSize: 8 })]),
  layer('sun-sunset', 'Sky', 'Setting sun', [createPlacement({ id: 'sun', pictureId: SUN.id, variant: 'Low', x: 69, anchor: 'bottom', y: 16, pixelSize: 8 })]),
  layer('moon', 'Sky', 'Moon', [createPlacement({ id: 'moon', pictureId: MOON.id, x: 14, anchor: 'top', y: 12, pixelSize: 8 })]),
  layer('fair-clouds', 'Sky', 'A few clouds', placeClouds(CLOUDS.slice(0, 2), 1)),
  layer('grey-clouds', 'Weather', 'Grey clouds', [
    placeOvercast(25),
    ...placeClouds(CLOUDS.slice(2, 11), 3),
    createPlacement({ id: 'cloud-bank', pictureId: CLOUD_BANK.id, anchor: 'top', y: 0, pixelSize: 8, spread: 'across' }),
  ]),
  layer('snow-clouds', 'Weather', 'Snow clouds', [placeOvercast(25), ...placeClouds(CLOUDS.slice(2, 8), 3)]),
  layer('grass', 'Ground', 'Grass', [createPlacement({ id: 'grass', pictureId: GRASS.id, anchor: 'bottom', y: 0, spread: 'across' })]),
  // Between the animals, so that none stands in one.
  layer(
    'puddles',
    'Ground',
    'Puddles',
    [24, 48, 72, 93].map((x, index) => createPlacement({ id: `puddle-${index + 1}`, pictureId: PUDDLE.id, x, anchor: 'bottom', y: 12 })),
  ),
  layer('snowman', 'Ground', 'Snowman', [createPlacement({ id: 'snowman', pictureId: SNOWMAN.id, x: 48, anchor: 'bottom', y: 24 })]),
  ...(['sunrise', 'day', 'sunset', 'night'] as TimeOfDay[]).map((timeOfDay) => layer(`animals-${timeOfDay}`, 'Animals', `Animals ${TIME_OF_DAY_TITLES[timeOfDay]}`, placeAnimals(timeOfDay))),
  layer(
    'umbrellas',
    'Animals',
    'Umbrellas',
    ANIMALS.map((animal) =>
      createPlacement({
        id: `umbrella-${animal.id}`,
        pictureId: UMBRELLA.id,
        variant: animal.umbrella,
        x: animal.x,
        anchor: 'bottom',
        y: GROUND_HEIGHT + (getPoseHeight(animal.picture, 'Standing') - UMBRELLA_POLE_OVERLAP) * PIXEL_SIZE,
      }),
    ),
  ),
  layer('butterflies', 'Animals', 'Butterflies', [
    createPlacement({ id: 'butterfly-1', pictureId: BUTTERFLY.id, variant: 'Pink', x: 20, anchor: 'bottom', y: 64, motion: 'flutter' }),
    createPlacement({ id: 'butterfly-2', pictureId: BUTTERFLY.id, variant: 'Yellow', x: 66, anchor: 'bottom', y: 88, motion: 'flutter' }),
  ]),
  layer(
    'fireflies',
    'Animals',
    'Fireflies',
    [
      { x: 18, y: 70 },
      { x: 30, y: 110 },
      { x: 50, y: 60 },
      { x: 72, y: 96 },
      { x: 90, y: 76 },
    ].map((firefly, index) => createPlacement({ id: `firefly-${index + 1}`, pictureId: FIREFLY.id, x: firefly.x, anchor: 'bottom', y: firefly.y, pixelSize: 2, motion: 'wander' })),
  ),
  layer('fog', 'Weather', 'Fog', [placeOvercast(30), createPlacement({ id: 'fog', pictureId: FOG.id, anchor: 'top', y: 0, spread: 'screen' })]),
  layer('drizzle', 'Weather', 'Drizzle', [createPlacement({ id: 'drizzle', pictureId: RAIN.id, variant: 'Drizzle', anchor: 'top', y: 0, spread: 'tile' })]),
  layer('rain', 'Weather', 'Rain', [createPlacement({ id: 'rain', pictureId: RAIN.id, variant: 'Rain', anchor: 'top', y: 0, spread: 'tile' })]),
  layer('snow', 'Weather', 'Snow', [createPlacement({ id: 'snow', pictureId: SNOW.id, anchor: 'top', y: 0, spread: 'tile' })]),
  layer('lightning', 'Weather', 'Lightning', [createPlacement({ id: 'lightning', pictureId: LIGHTNING.id, anchor: 'top', y: 0, spread: 'screen' })]),
]
