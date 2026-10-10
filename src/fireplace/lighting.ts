/**
 * Bakes the spatial firelight falloff into the scene pixels.
 *
 * The room is lit in four discrete steps rather than a smooth gradient, and
 * the boundaries are dithered with an ordered 4x4 matrix — which is both how
 * the hardware this is imitating would have done it and what stops the light
 * from reading as concentric rings.
 */
import type { Rect } from './layout'
import { LIGHT_BANDS, SCENE, SCENE_COLORS } from './palettes'

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Ordered-dither threshold in `[0, 1)` for a pixel. */
export function bayerAt(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16
}

/** Marks pixels that are never drawn over the top of anything. */
export const SKIP_PIXEL = 255

export interface LightField {
  /** Continuous exposure to the fire, from 0 (dark) to `LIGHT_BANDS - 1`. */
  at(x: number, y: number): number
}

/** Radial falloff around the flames: bright at the logs, dark up the flue. */
export function createLightField(fire: Rect): LightField {
  const cx = fire.x + fire.w / 2
  const cy = fire.y + fire.h * 0.78
  const rx = Math.max(1, fire.w * 1.4)
  const ry = Math.max(1, fire.h)
  const peak = LIGHT_BANDS - 1
  return {
    at(x: number, y: number): number {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      const distance = Math.sqrt(dx * dx + dy * dy)
      return peak * clamp01((1.05 - distance) / 0.78)
    },
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/**
 * Combines a colour-index bitmap with a light field into the packed bytes the
 * renderer consumes. `transparent` entries become {@link SKIP_PIXEL}.
 */
export function packLayer(
  colors: Uint8Array,
  width: number,
  height: number,
  field: LightField,
  transparent = false,
): Uint8Array {
  const packed = new Uint8Array(colors.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const color = colors[index]
      if (transparent && color === SCENE.TRANSPARENT) {
        packed[index] = SKIP_PIXEL
        continue
      }
      packed[index] = bandAt(field, x, y) * SCENE_COLORS + color
    }
  }
  return packed
}

/** The dithered light band a pixel falls in, from 0 to `LIGHT_BANDS - 1`. */
export function bandAt(field: LightField, x: number, y: number): number {
  const raw = field.at(x, y) + bayerAt(x, y)
  const top = LIGHT_BANDS - 1
  return raw < 0 ? 0 : raw > top ? top : Math.floor(raw)
}
