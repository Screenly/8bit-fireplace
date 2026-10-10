/**
 * The Halloween palette and sprite art. Each sprite is drawn as text, one
 * character per pixel, so it can be edited by eye; `.` is transparent.
 */
/** Named slots in the decoration palette. */
export const DECOR = {
  OUTLINE: 0,
  PUMPKIN_DARK: 1,
  PUMPKIN: 2,
  PUMPKIN_LIGHT: 3,
  STEM: 4,
  LEAF: 5,
  /** The candle behind a carved face. Animated, not lit. */
  CANDLE: 6,
  WEB: 7,
  BODY: 8,
  BODY_LIGHT: 9,
  EYE: 10,
  GHOST: 11,
  GHOST_SHADE: 12,
  WING: 13,
  BONE: 14,
  TRANSPARENT: 15,
} as const

const DECOR_HEX =
  '#240a02 #5e2405 #a8460a #cc6a18 #3a2810 #3d6b1e #ffd76e #57526a ' +
  '#3a2d4a #7a6496 #ff3a22 #dcd8ea #9590ad #4a3666 #cfc8b2 #000000'

export const DECOR_PALETTE: readonly string[] = DECOR_HEX.split(' ')

/**
 * The ghost is already pale and the eyes already glow, so the firelight
 * barely moves them. The pumpkins are held back like the logs are, or they
 * wash out next to the fire and the carved faces stop reading.
 */
export const DECOR_SENSITIVITY: Record<number, number> = {
  [DECOR.OUTLINE]: 0.5,
  [DECOR.PUMPKIN_DARK]: 0.5,
  [DECOR.PUMPKIN]: 0.5,
  [DECOR.PUMPKIN_LIGHT]: 0.5,
  [DECOR.EYE]: 0.2,
  [DECOR.GHOST]: 0.4,
  [DECOR.GHOST_SHADE]: 0.5,
  [DECOR.BONE]: 0.6,
}

export interface Sprite {
  readonly w: number
  readonly h: number
  readonly pixels: Uint8Array
}

const SPRITE_KEY: Record<string, number> = {
  k: DECOR.OUTLINE,
  d: DECOR.PUMPKIN_DARK,
  o: DECOR.PUMPKIN,
  l: DECOR.PUMPKIN_LIGHT,
  s: DECOR.STEM,
  g: DECOR.LEAF,
  Y: DECOR.CANDLE,
  b: DECOR.BODY,
  h: DECOR.BODY_LIGHT,
  e: DECOR.EYE,
  w: DECOR.GHOST,
  x: DECOR.GHOST_SHADE,
  v: DECOR.WING,
  B: DECOR.BONE,
}

/**
 * Rows half as wide as the widest are the left half of a symmetric row and
 * are mirrored; full-width rows are taken as they are.
 */
export function sprite(source: readonly string[]): Sprite {
  const w = Math.max(...source.map((row) => row.length))
  const rows = source.map((row) =>
    row.length * 2 === w ? row + [...row].reverse().join('') : row,
  )
  const pixels = new Uint8Array(w * rows.length).fill(DECOR.TRANSPARENT)
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Ragged sprite row: ${row}`)
    for (let x = 0; x < w; x++) {
      const color = SPRITE_KEY[row[x]]
      if (color !== undefined) pixels[y * w + x] = color
    }
  })
  return { w, h: rows.length, pixels }
}

/** The same sprite facing the other way. */
export function flipped(s: Sprite): Sprite {
  const pixels = new Uint8Array(s.pixels.length)
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      pixels[y * s.w + x] = s.pixels[y * s.w + s.w - 1 - x]
    }
  }
  return { w: s.w, h: s.h, pixels }
}

export interface SpiderKind {
  readonly frames: readonly Sprite[]
  /** The column the silk attaches to. */
  readonly attach: number
}

const SPIDER_FRAMES = [
  sprite([
    'b.....b',
    '.b.b.b.',
    '..bhb..',
    'bbbbbbb',
    '..ebe..',
    '.b...b.',
    'b.....b',
  ]),
  sprite([
    '.b...b.',
    'b..b..b',
    '..bhb..',
    'bbbbbbb',
    '..ebe..',
    'b.....b',
    '.......',
  ]),
]

const SPIDER_TINY = sprite(['b...b', '.bhb.', 'bbbbb', '.ebe.', 'b...b'])

export const SPIDERS: Record<'normal' | 'tiny', SpiderKind> = {
  normal: { frames: SPIDER_FRAMES, attach: 3 },
  tiny: { frames: [SPIDER_TINY, SPIDER_TINY], attach: 2 },
}

export const BAT = [
  sprite([
    'v.........v',
    'vv..b.b..vv',
    '.vvvebevvv.',
    '..vvbbbvv..',
    '.....b.....',
  ]),
  sprite([
    '....b.b....',
    '...vebev...',
    '.vvvbbbvvv.',
    'vv.v.b.v.vv',
    'v.........v',
  ]),
]

const GHOST_BODY = [
  '..wwwww..',
  '.wwwwwwx.',
  'wwwwwwwwx',
  'wwkwwwkwx',
  'wwkwwwkwx',
  'wwwwwwwwx',
  'wwwwkwwwx',
  'wwwwwwwwx',
  'wwwwwwwwx',
]
export const GHOST = [
  sprite([...GHOST_BODY, 'w.ww.ww.x']),
  sprite([...GHOST_BODY, '.ww.ww.wx']),
]

const SKELETON_HEAD = [
  '..BBBBB..',
  '.BBBBBBB.',
  '.BkkBkkB.',
  '.BBBkBBB.',
  '..BxBxB..',
  '....B....',
  '.BBBBBBB.',
  'B.BBBBB.B',
]
const SKELETON_STAND = sprite([
  ...SKELETON_HEAD,
  'B..xBx..B',
  'B.BBBBB.B',
  'B...B...B',
  '..BBBBB..',
  '..B...B..',
  '..B...B..',
  '..B...B..',
  '.BB...BB.',
])
const SKELETON_STRIDE = sprite([
  ...SKELETON_HEAD,
  '.B.xBx..B',
  '.BBBBBB.B',
  '..B.B...B',
  '..BBBBB..',
  '..B...B..',
  '.B....B..',
  '.B.....B.',
  'BB.....BB',
])

const SKELETON_ARMS_UP = [
  'B.........B',
  'B..BBBBB..B',
  'B.BBBBBBB.B',
  'B.BkkBkkB.B',
  'B.BBBkBBB.B',
  'B..BxBxB..B',
  'B....B....B',
  '.BBBBBBBBB.',
  '...BBBBB...',
  '....xBx....',
  '...BBBBB...',
  '.....B.....',
  '...BBBBB...',
]
const SKELETON_CARRY_STAND = sprite([
  ...SKELETON_ARMS_UP,
  '...B...B...',
  '...B...B...',
  '...B...B...',
  '..BB...BB..',
])
const SKELETON_CARRY_STRIDE = sprite([
  ...SKELETON_ARMS_UP,
  '...B...B...',
  '..B....B...',
  '..B.....B..',
  '.BB.....BB.',
])

/** A four-step walk: stand, stride, stand, stride on the other leg. */
export const SKELETON = [
  SKELETON_STAND,
  SKELETON_STRIDE,
  SKELETON_STAND,
  flipped(SKELETON_STRIDE),
]

/** The same walk with both arms up, holding something over its head. */
export const SKELETON_CARRY = [
  SKELETON_CARRY_STAND,
  SKELETON_CARRY_STRIDE,
  SKELETON_CARRY_STAND,
  flipped(SKELETON_CARRY_STRIDE),
]

export type Plot = (x: number, y: number, color: number) => void

/** Draws a sprite at a whole-number scale, so it stays crisp. */
export function drawSprite(
  plot: Plot,
  s: Sprite,
  x: number,
  y: number,
  scale = 1,
): void {
  const left = Math.round(x)
  const top = Math.round(y)
  for (let row = 0; row < s.h * scale; row++) {
    const source = Math.floor(row / scale) * s.w
    for (let col = 0; col < s.w * scale; col++) {
      const color = s.pixels[source + Math.floor(col / scale)]
      if (color !== DECOR.TRANSPARENT) plot(left + col, top + row, color)
    }
  }
}
