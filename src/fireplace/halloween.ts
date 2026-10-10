/**
 * Halloween dressing for the firebox: cobwebs in the top corners, the
 * critters from `halloween-critters`, and jack-o'-lanterns on the hearth that
 * the skeletons from `halloween-skeletons` keep pinching.
 *
 * The webs never move, so they are drawn once into an indexed layer with
 * their own 16-colour palette and packed with the scene's light field,
 * exactly like the brickwork. Everything else is drawn each frame, lit by
 * looking up the light band under each pixel.
 */
import { IndexedBitmap } from './bitmap'
import { packHex } from './colors'
import type { SceneVariant } from './engine'
import { Critters } from './halloween-critters'
import { hearthSpans, placePumpkins } from './halloween-hearth'
import { Skeletons } from './halloween-skeletons'
import { DECOR, DECOR_PALETTE, DECOR_SENSITIVITY } from './halloween-sprites'
import type { Layout, Rect } from './layout'
import { bandAt, packLayer, SKIP_PIXEL, type LightField } from './lighting'
import {
  buildPaletteTables,
  FLICKER_STEPS,
  LIGHT_BANDS,
  SCENE_COLORS,
} from './palettes'
import { createRng, randRange, type Rng } from './prng'
import { FLAME_RAMPS, glowColor, type FlameColor } from './ramps'

/**
 * A corner cobweb anchored to both walls. Spoke count, angles and lengths,
 * ring spacing and the odd torn strand all vary, so the two corners never
 * mirror each other.
 */
function drawWeb(
  bmp: IndexedBitmap,
  originX: number,
  dir: 1 | -1,
  radius: number,
  rng: Rng,
): void {
  const spokes = randRange(rng, 3, 5) + 2
  const step = 1 / (spokes - 1)
  const angles: number[] = []
  const lengths: number[] = []
  for (let k = 0; k < spokes; k++) {
    const edge = k === 0 || k === spokes - 1
    const jitter = edge ? 0 : (rng() - 0.5) * step * 0.6
    angles.push((k * step + jitter) * (Math.PI / 2))
    lengths.push(radius * (edge ? 0.7 + rng() * 0.5 : 0.8 + rng() * 0.35))
  }
  const point = (angle: number, r: number): [number, number] => [
    originX + dir * Math.cos(angle) * r,
    Math.sin(angle) * r,
  ]

  for (let k = 1; k < spokes - 1; k++) {
    const [x, y] = point(angles[k], lengths[k])
    bmp.line(originX, 0, x, y, DECOR.WEB)
  }

  const rings = randRange(rng, 3, 5)
  for (let j = 1; j <= rings; j++) {
    const fraction = j === rings ? 1 : (j - 0.3 + rng() * 0.5) / rings
    for (let k = 0; k < spokes - 1; k++) {
      const [px, py] = point(angles[k], lengths[k] * fraction)
      if (rng() < 0.08) {
        // A torn strand hanging loose from the spoke.
        bmp.line(px, py, px, py + randRange(rng, 2, 4), DECOR.WEB)
        continue
      }
      const [qx, qy] = point(angles[k + 1], lengths[k + 1] * fraction)
      const sag = 0.76 + rng() * 0.14
      const middle = (angles[k] + angles[k + 1]) / 2
      const reach = ((lengths[k] + lengths[k + 1]) / 2) * fraction * sag
      const [mx, my] = point(middle, reach)
      bmp.line(px, py, mx, my, DECOR.WEB)
      bmp.line(mx, my, qx, qy, DECOR.WEB)
    }
  }
}

export class HalloweenDecor {
  private readonly width: number
  private readonly height: number
  private readonly light: LightField
  private readonly layer: Uint8Array
  private readonly layerBounds: Rect[] = []
  private readonly tables: Uint32Array[]
  private readonly critters: Critters
  private readonly skeletons: Skeletons

  constructor(
    layout: Layout,
    light: LightField,
    variant: SceneVariant,
    flame: FlameColor,
    seed: number,
  ) {
    this.width = layout.width
    this.height = layout.height
    this.light = light
    // A separate stream, so dressing the hearth does not change the flames.
    const rng = createRng(seed ^ 0x5bd1e995)
    this.tables = buildDecorTables(flame)

    const bmp = new IndexedBitmap(this.width, this.height)
    bmp.fill(DECOR.TRANSPARENT)
    this.drawWebs(bmp, rng)
    this.layer = packLayer(bmp.data, this.width, this.height, light, true)
    this.critters = new Critters(layout, rng)

    // The inferno has no hearth for a pumpkin to stand on, but a skeleton
    // can still stroll along the bottom of it.
    const spans = variant === 'hearth' ? hearthSpans(layout) : []
    this.skeletons = new Skeletons(
      { width: this.width, height: this.height, ground: layout.ashBed.y + 1 },
      rng,
      spans.length > 0 ? placePumpkins(spans, rng) : [],
      spans,
    )
  }

  tick(): void {
    this.critters.tick()
    this.skeletons.tick()
  }

  /** Composites the decorations over a frame at the given flicker step. */
  paint(pixels: Uint32Array, flickerIndex: number): void {
    const table = this.tables[flickerIndex]
    for (const { x, y, w, h } of this.layerBounds) {
      const x0 = Math.max(0, x)
      const y0 = Math.max(0, y)
      const x1 = Math.min(this.width, x + w)
      const y1 = Math.min(this.height, y + h)
      for (let py = y0; py < y1; py++) {
        const offset = py * this.width
        for (let px = x0; px < x1; px++) {
          const packed = this.layer[offset + px]
          if (packed !== SKIP_PIXEL) pixels[offset + px] = table[packed]
        }
      }
    }

    const plot = (x: number, y: number, color: number) => {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
      const band = bandAt(this.light, x, y)
      pixels[y * this.width + x] = table[band * SCENE_COLORS + color]
    }
    this.critters.draw(plot)
    this.skeletons.draw(plot)
  }

  /** One big web and one smaller one, on a random side each. */
  private drawWebs(bmp: IndexedBitmap, rng: Rng): void {
    const short = Math.min(this.width, this.height)
    const big = short * (0.22 + rng() * 0.08)
    const small = short * (0.13 + rng() * 0.07)
    const [left, right] = rng() < 0.5 ? [big, small] : [small, big]
    for (const [originX, dir, radius] of [
      [0, 1, left],
      [this.width - 1, -1, right],
    ] as const) {
      if (radius < 8) continue
      drawWeb(bmp, originX, dir, radius, rng)
      // Edge spokes can run to 1.2x the radius, plus a torn strand below.
      const size = Math.ceil(radius * 1.2) + 5
      const x = dir > 0 ? 0 : this.width - size
      this.layerBounds.push({ x, y: 0, w: size, h: size })
    }
  }
}

/**
 * The decorations take the firelight like the brickwork does. The candle slot is then overwritten per flicker
 * step: the candles inside the pumpkins are ordinary orange candles whatever
 * colour the fire is, and they flicker in step with it rather than being lit
 * by it.
 */
function buildDecorTables(flame: FlameColor): Uint32Array[] {
  const tables = buildPaletteTables(
    DECOR_PALETTE,
    glowColor(flame),
    DECOR_SENSITIVITY,
  )
  const ramp = FLAME_RAMPS.classic
  for (let step = 0; step < FLICKER_STEPS; step++) {
    const candle = packHex(ramp[Math.min(ramp.length - 1, 10 + step)])
    for (let band = 0; band < LIGHT_BANDS; band++) {
      tables[step][band * SCENE_COLORS + DECOR.CANDLE] = candle
    }
  }
  return tables
}
