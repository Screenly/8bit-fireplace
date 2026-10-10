/**
 * Assembles the static parts of the picture.
 *
 * Everything that does not change frame to frame — firebrick, ash bed, logs —
 * is drawn once into indexed bitmaps and then packed with its light band. Each
 * frame only has to apply a palette and draw the flames.
 */
import { IndexedBitmap } from './bitmap'
import type { Layout, Rect } from './layout'
import { computeLayout } from './layout'
import { createLightField, packLayer, type LightField } from './lighting'
import { drawAndirons, drawFirebox, drawLogs, logPileBounds } from './logs'
import { SCENE } from './palettes'
import type { Rng } from './prng'

export interface SceneData {
  /** Packed static pixels, drawn under the flames. */
  background: Uint8Array
  /** Packed pixels drawn over the flames; `SKIP_PIXEL` means "leave alone". */
  overlay: Uint8Array
  /** The area the flame simulation covers. */
  fire: Rect
  /** Seed heat per flame column, 0 to 1. */
  sourceStrength: (x: number) => number
  /** Where the overlay has anything to draw, so the blit stays cheap. */
  overlayBounds: Rect
  /**
   * The horizontal span embers are thrown from. The engine places them
   * vertically, because only it knows how high the flames reach.
   */
  sparkSpan: { x: number; w: number }
  /** How far an ember may travel before it is recycled. */
  sparkBounds: Rect
  /** How exposed each pixel is to the fire, for anything drawn on top. */
  light: LightField
  layout: Layout
}

/**
 * The hearth: a full-bleed firebox with a burning log pile. There is no
 * surround, mantel or wall — the screen's own bezel frames the fire.
 */
export function buildHearthScene(
  width: number,
  height: number,
  rng: Rng,
): SceneData {
  const layout = computeLayout(width, height)
  const background = new IndexedBitmap(width, height)
  drawFirebox(background, layout, rng)
  drawAndirons(background, layout)

  const overlay = new IndexedBitmap(width, height)
  overlay.fill(SCENE.TRANSPARENT)
  drawLogs(overlay, layout, rng)

  // The glow comes off the burning pile, so the falloff is measured from
  // there — keyed to the full-width simulation grid it would wash the
  // brickwork out to both edges of the screen.
  const field = createLightField({
    x: layout.logBed.x,
    y: layout.fire.y,
    w: layout.logBed.w,
    h: layout.fire.h,
  })
  return {
    background: packLayer(background.data, width, height, field),
    overlay: packLayer(overlay.data, width, height, field, true),
    fire: layout.fire,
    sourceStrength: logBedStrength(layout),
    overlayBounds: logPileBounds(layout),
    sparkSpan: { x: layout.logBed.x, w: layout.logBed.w },
    sparkBounds: layout.opening,
    light: field,
    layout,
  }
}

/** Flames taper off past the ends of the log pile rather than stopping dead. */
function logBedStrength(layout: Layout): (x: number) => number {
  const { logBed, fire } = layout
  const half = Math.max(1, logBed.w / 2)
  const center = logBed.x + half
  return (x: number) => {
    const t = Math.abs(fire.x + x - center) / half
    if (t <= 0.82) return 1
    return Math.max(0, 1 - (t - 0.82) / 0.32)
  }
}

/** The "inferno" variant: no logs at all, just a full-screen wall of flame. */
export function buildInfernoScene(width: number, height: number): SceneData {
  const layout = computeLayout(width, height)
  const fire = { x: 0, y: 0, w: width, h: height }
  const dark = new Uint8Array(width * height)
  const overlay = new Uint8Array(width * height).fill(255)
  const taper = Math.max(1, Math.round(width * 0.06))
  return {
    background: dark,
    overlay,
    fire,
    sourceStrength: (x: number) => {
      const edge = Math.min(x, width - 1 - x)
      return edge >= taper ? 1 : Math.max(0.15, edge / taper)
    },
    overlayBounds: { x: 0, y: 0, w: 0, h: 0 },
    sparkSpan: { x: 0, w: width },
    sparkBounds: fire,
    // A wall of flame lights everything in front of it about evenly.
    light: { at: () => 1.5 },
    layout,
  }
}
