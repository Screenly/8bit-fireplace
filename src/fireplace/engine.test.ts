import { describe, expect, test } from 'bun:test'
import { Engine, type EngineConfig } from './engine'
import { SKIP_PIXEL } from './lighting'
import { createRng } from './prng'
import { buildHearthScene, buildInfernoScene } from './scene'

const BASE: EngineConfig = {
  width: 160,
  height: 96,
  flame: 'classic',
  reachFactor: 0.7,
  variant: 'hearth',
  theme: 'standard',
  seed: 42,
}

function render(config: Partial<EngineConfig> = {}): {
  engine: Engine
  pixels: Uint32Array
} {
  const merged = { ...BASE, ...config }
  const engine = new Engine(merged)
  const pixels = new Uint32Array(merged.width * merged.height)
  engine.paint(pixels)
  return { engine, pixels }
}

describe('scene assembly', () => {
  test('packs a background pixel for every cell', () => {
    const scene = buildHearthScene(160, 96, createRng(1))
    expect(scene.background).toHaveLength(160 * 96)
    expect(scene.background.every((pixel) => pixel !== SKIP_PIXEL)).toBe(true)
  })

  test('draws the firebox edge to edge, with no surround', () => {
    const scene = buildHearthScene(160, 96, createRng(1))
    expect(scene.fire).toEqual({ x: 0, y: 0, w: 160, h: scene.fire.h })
    expect(scene.layout.opening).toEqual({ x: 0, y: 0, w: 160, h: 96 })
  })

  test('leaves the overlay transparent everywhere but the log pile', () => {
    const scene = buildHearthScene(160, 96, createRng(1))
    const drawn = scene.overlay.filter((pixel) => pixel !== SKIP_PIXEL).length
    expect(drawn).toBeGreaterThan(0)
    expect(drawn).toBeLessThan(scene.overlay.length / 2)
  })

  test('covers every overlay pixel with the bounds the renderer blits', () => {
    // The log tiers can stand proud of the log bed once the minimum-thickness
    // clamp kicks in, which used to leave pixels drawn but never composited.
    for (const [w, h] of [
      [16, 16],
      [60, 24],
      [160, 96],
      [96, 160],
      [275, 155],
    ]) {
      const scene = buildHearthScene(w, h, createRng(1))
      const { x, y, w: bw, h: bh } = scene.overlayBounds
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          if (scene.overlay[py * w + px] === SKIP_PIXEL) continue
          expect(px).toBeGreaterThanOrEqual(x)
          expect(py).toBeGreaterThanOrEqual(y)
          expect(px).toBeLessThan(x + bw)
          expect(py).toBeLessThan(y + bh)
        }
      }
    }
  })

  test('keeps the flame seed within bounds along the whole row', () => {
    for (const scene of [
      buildHearthScene(160, 96, createRng(1)),
      buildInfernoScene(160, 96),
    ]) {
      for (let x = 0; x < scene.fire.w; x++) {
        const strength = scene.sourceStrength(x)
        expect(strength).toBeGreaterThanOrEqual(0)
        expect(strength).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('Engine', () => {
  test('paints every pixel opaquely — no holes in the frame', () => {
    const { pixels } = render()
    expect(pixels.every((pixel) => pixel !== 0)).toBe(true)
  })

  test('is deterministic for a given seed', () => {
    const a = render().pixels
    const b = render().pixels
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  test('draws a different room for a different screen', () => {
    const a = render({ seed: 1 }).pixels
    const b = render({ seed: 2 }).pixels
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })

  test('animates — a later frame differs from the first', () => {
    const { engine, pixels } = render()
    const first = Uint32Array.from(pixels)
    for (let i = 0; i < 10; i++) engine.tick()
    engine.paint(pixels)
    expect(Array.from(pixels)).not.toEqual(Array.from(first))
  })

  test('starts already alight, so a screen never shows a cold hearth', () => {
    const { pixels } = render()
    const distinct = new Set(pixels)
    expect(distinct.size).toBeGreaterThan(20)
  })

  test('renders the inferno variant across the full frame', () => {
    const { pixels } = render({ variant: 'inferno' })
    expect(pixels.every((pixel) => pixel !== 0)).toBe(true)
  })

  test('handles portrait and postage-stamp frames', () => {
    for (const [w, h] of [
      [96, 160],
      [40, 40],
      [16, 16],
    ]) {
      const engine = new Engine({ ...BASE, width: w, height: h })
      const pixels = new Uint32Array(w * h)
      engine.tick()
      engine.paint(pixels)
      expect(pixels.every((pixel) => pixel !== 0)).toBe(true)
    }
  })
})

describe('Halloween theme', () => {
  test('dresses the hearth for Halloween without touching the fire', () => {
    const standard = render().pixels
    const halloween = render({ theme: 'halloween' }).pixels
    expect(halloween.every((pixel) => pixel !== 0)).toBe(true)
    expect(Array.from(halloween)).not.toEqual(Array.from(standard))
    // The flames and embers come from their own random stream, so the
    // bottom-centre of the fire is identical either way.
    const row = Math.round(BASE.height * 0.7) * BASE.width
    const mid = row + BASE.width / 2
    expect(halloween[mid]).toBe(standard[mid])
  })

  test('keeps the Halloween critters inside any frame size', () => {
    for (const variant of ['hearth', 'inferno'] as const) {
      for (const [w, h] of [
        [16, 16],
        [96, 160],
        [275, 155],
      ]) {
        const engine = new Engine({
          ...BASE,
          width: w,
          height: h,
          variant,
          theme: 'halloween',
        })
        const pixels = new Uint32Array(w * h)
        for (let i = 0; i < 900; i++) engine.tick()
        engine.paint(pixels)
        expect(pixels.every((pixel) => pixel !== 0)).toBe(true)
      }
    }
  })
})
