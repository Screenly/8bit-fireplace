/**
 * The 16-colour scene palette and the pre-baked firelight tables.
 *
 * Every static pixel is stored as `band * SCENE_COLORS + colour`, where `band`
 * is how exposed that pixel is to the fire. Lighting a frame is then one table
 * lookup per pixel — the same palette-animation trick 8-bit games used, and
 * cheap enough for a Raspberry Pi at 4K.
 */
import { litColor } from './colors'
import { FLAME_RAMPS, glowColor, type FlameColor } from './ramps'

/** Named slots in the scene palette. */
export const SCENE = {
  VOID: 0,
  MORTAR: 1,
  SOOT_DARK: 2,
  SOOT_MID: 3,
  SOOT_LIGHT: 4,
  LOG_DARK: 5,
  LOG_MID: 6,
  LOG_LIGHT: 7,
  LOG_HI: 8,
  EMBER_DARK: 9,
  EMBER_HOT: 10,
  ASH: 11,
  ASH_LIGHT: 12,
  IRON_DARK: 13,
  IRON_MID: 14,
  /** Overlay-only sentinel: leave whatever is underneath alone. */
  TRANSPARENT: 15,
} as const

/** Palette size. A power of two so a pixel can pack colour plus light band. */
export const SCENE_COLORS = 16

const PALETTE_HEX =
  '#05060a #050309 #080510 #0e0912 #150f17 #24150c #3b2413 #4a2c17 ' +
  '#5c3a20 #8a2b06 #d4520c #2a2731 #3b3644 #17151c #2a2731 #000000'

export const SCENE_PALETTE: readonly string[] = PALETTE_HEX.split(' ')

/**
 * How strongly each colour reacts to firelight. The coals are already glowing
 * at full heat, so they barely move.
 */
const GLOW_SENSITIVITY: Record<number, number> = {
  [SCENE.EMBER_HOT]: 0.2,
  [SCENE.EMBER_DARK]: 0.4,
  // The pile reads as firewood when it is silhouetted against the flames;
  // lit to the same degree as the brickwork it turns into pale sandstone.
  [SCENE.LOG_DARK]: 0.38,
  [SCENE.LOG_MID]: 0.38,
  [SCENE.LOG_LIGHT]: 0.38,
  [SCENE.LOG_HI]: 0.38,
  [SCENE.ASH]: 0.5,
  [SCENE.ASH_LIGHT]: 0.5,
}

/** Number of spatial firelight bands baked into the scene pixels. */
export const LIGHT_BANDS = 4
/** Number of pre-baked flicker steps. */
export const FLICKER_STEPS = 6

const BAND_STRENGTH = [0, 0.18, 0.42, 0.74]

/**
 * Builds one lookup table per flicker step, each indexed by a packed scene
 * pixel.
 */
export function buildLightTables(flame: FlameColor): Uint32Array[] {
  return buildPaletteTables(
    paletteFor(flame),
    glowColor(flame),
    GLOW_SENSITIVITY,
  )
}

/**
 * The same flicker tables for any 16-colour palette, so other layers drawn
 * into the firebox pick up the firelight exactly as the brickwork does.
 */
export function buildPaletteTables(
  palette: readonly string[],
  glow: string,
  sensitivity: Readonly<Record<number, number>>,
): Uint32Array[] {
  const tables: Uint32Array[] = []
  for (let step = 0; step < FLICKER_STEPS; step++) {
    const flicker = 0.72 + (0.28 * step) / (FLICKER_STEPS - 1)
    tables.push(buildLightTable(palette, glow, flicker, sensitivity))
  }
  return tables
}

/**
 * The coals take their colour from the flame ramp, so a blue or green fire
 * does not sit on a bed of orange embers.
 */
function paletteFor(flame: FlameColor): string[] {
  const ramp = FLAME_RAMPS[flame]
  const palette = [...SCENE_PALETTE]
  palette[SCENE.EMBER_DARK] = ramp[4]
  palette[SCENE.EMBER_HOT] = ramp[9]
  return palette
}

function buildLightTable(
  palette: readonly string[],
  glow: string,
  flicker: number,
  sensitivityOf: Readonly<Record<number, number>>,
): Uint32Array {
  const table = new Uint32Array(LIGHT_BANDS * SCENE_COLORS)
  for (let band = 0; band < LIGHT_BANDS; band++) {
    for (let color = 0; color < SCENE_COLORS; color++) {
      const sensitivity = sensitivityOf[color] ?? 1
      const amount = BAND_STRENGTH[band] * flicker * sensitivity
      table[band * SCENE_COLORS + color] = litColor(
        palette[color],
        glow,
        amount,
      )
    }
  }
  return table
}
