/**
 * Ties the scene, the flame simulation and the embers together and renders
 * them into a frame buffer. The engine knows nothing about the DOM, which
 * keeps it straightforward to exercise in unit tests.
 */
import { FIRE_MAX, FireSim, heatToRamp } from './fire'
import { HalloweenDecor } from './halloween'
import type { Rect } from './layout'
import { SKIP_PIXEL } from './lighting'
import { buildLightTables, FLICKER_STEPS } from './palettes'
import { createRng, type Rng } from './prng'
import { buildFlameTable, FLAME_STEPS, type FlameColor } from './ramps'
import { buildHearthScene, buildInfernoScene, type SceneData } from './scene'
import { Sparks } from './sparks'

export type SceneVariant = 'hearth' | 'inferno'
export type Theme = 'standard' | 'halloween'

export interface EngineConfig {
  width: number
  height: number
  flame: FlameColor
  /** Flame height as a fraction of the firebox. */
  reachFactor: number
  variant: SceneVariant
  theme: Theme
  seed: number
  /**
   * Seeds the Halloween dressing separately from the room, so the pumpkins
   * and webs can be rearranged on every load while the brickwork stays put.
   * Defaults to `seed`.
   */
  decorSeed?: number
}

export class Engine {
  readonly width: number
  readonly height: number

  private readonly rng: Rng
  private readonly scene: SceneData
  private readonly fire: FireSim
  private readonly sparks: Sparks
  private readonly lightTables: Uint32Array[]
  private readonly flameTable: Uint32Array
  private readonly heatTable: Uint32Array
  private readonly decor: HalloweenDecor | null

  private flicker = 0.5
  private flickerTarget = 0.5
  private flickerIndex = 0
  private ticks = 0

  constructor(config: EngineConfig) {
    this.width = config.width
    this.height = config.height
    this.rng = createRng(config.seed)
    this.scene =
      config.variant === 'inferno'
        ? buildInfernoScene(config.width, config.height)
        : buildHearthScene(config.width, config.height, this.rng)

    const { fire } = this.scene
    this.fire = new FireSim({
      width: fire.w,
      height: fire.h,
      reach: Math.max(4, fire.h * config.reachFactor),
      rng: this.rng,
    })
    this.fire.setSource(this.scene.sourceStrength)
    this.fire.prewarm(Math.min(400, fire.h + 60))

    this.sparks = new Sparks(
      emberBand(fire, this.scene.sparkSpan, config.reachFactor),
      this.scene.sparkBounds,
      this.rng,
      Math.max(8, Math.min(220, Math.round(fire.w * 0.8))),
    )

    this.lightTables = buildLightTables(config.flame)
    this.flameTable = buildFlameTable(config.flame)
    this.heatTable = buildHeatTable(this.flameTable)
    this.decor =
      config.theme === 'halloween'
        ? new HalloweenDecor(
            this.scene.layout,
            this.scene.light,
            config.variant,
            config.flame,
            config.decorSeed ?? config.seed,
          )
        : null
  }

  /** Advances the simulation by one fixed tick. */
  tick(): void {
    this.ticks++
    this.fire.step()
    const energy = this.fire.energy()
    this.sparks.update(energy)
    this.updateFlicker(energy)
    this.decor?.tick()
  }

  /** Composites the current state into `pixels` (length `width * height`). */
  paint(pixels: Uint32Array): void {
    const table = this.lightTables[this.flickerIndex]
    const background = this.scene.background
    for (let i = 0; i < background.length; i++) pixels[i] = table[background[i]]
    this.paintFire(pixels)
    this.paintOverlay(pixels, table)
    this.paintSparks(pixels)
    this.decor?.paint(pixels, this.flickerIndex)
  }

  private updateFlicker(energy: number): void {
    if (this.ticks % 3 === 0) this.flickerTarget = 0.25 + this.rng() * 0.75
    this.flicker += (this.flickerTarget - this.flicker) * 0.25
    const scaled = this.flicker * Math.min(1, energy / 0.42)
    const step = Math.floor(scaled * FLICKER_STEPS)
    this.flickerIndex = step < 0 ? 0 : Math.min(FLICKER_STEPS - 1, step)
  }

  private paintFire(pixels: Uint32Array): void {
    const { x: fx, y: fy, w: fw, h: fh } = this.scene.fire
    const cells = this.fire.cells
    for (let y = 0; y < fh; y++) {
      const row = y * fw
      const out = (fy + y) * this.width + fx
      for (let x = 0; x < fw; x++) {
        const color = this.heatTable[cells[row + x]]
        if (color !== 0) pixels[out + x] = color
      }
    }
  }

  private paintOverlay(pixels: Uint32Array, table: Uint32Array): void {
    const { x, y, w, h } = this.scene.overlayBounds
    const overlay = this.scene.overlay
    const x0 = Math.max(0, x)
    const y0 = Math.max(0, y)
    const x1 = Math.min(this.width, x + w)
    const y1 = Math.min(this.height, y + h)
    for (let py = y0; py < y1; py++) {
      const offset = py * this.width
      for (let px = x0; px < x1; px++) {
        const packed = overlay[offset + px]
        if (packed !== SKIP_PIXEL) pixels[offset + px] = table[packed]
      }
    }
  }

  private paintSparks(pixels: Uint32Array): void {
    this.sparks.forEach((x, y, heat) => {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
      const index = Math.max(1, Math.round(heat * FLAME_STEPS))
      pixels[y * this.width + x] = this.flameTable[index]
    })
  }
}

/**
 * Embers are thrown from around the flame tips. Spawning them at the source
 * instead just hides them inside the brightest part of the fire.
 */
function emberBand(
  fire: Rect,
  span: { x: number; w: number },
  reachFactor: number,
): Rect {
  const depth = Math.max(2, Math.round(fire.h * 0.2))
  const tips = fire.y + fire.h * Math.max(0, 1 - reachFactor)
  return { x: span.x, w: span.w, y: Math.round(tips), h: depth }
}

function buildHeatTable(flameTable: Uint32Array): Uint32Array {
  const table = new Uint32Array(FIRE_MAX + 1)
  for (let heat = 1; heat <= FIRE_MAX; heat++) {
    table[heat] = flameTable[heatToRamp(heat, FLAME_STEPS)]
  }
  return table
}
