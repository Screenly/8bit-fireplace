import { describe, expect, test } from 'bun:test'
import {
  computeLayout,
  computeScale,
  computeVirtualSize,
  type Rect,
} from './layout'

/** Every resolution a Screenly player can run at. */
const RESOLUTIONS = [
  [4096, 2160],
  [2160, 4096],
  [3840, 2160],
  [2160, 3840],
  [1920, 1080],
  [1080, 1920],
  [1280, 720],
  [720, 1280],
  [800, 480],
  [480, 800],
] as const

const TARGETS = [108, 156, 216]

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  )
}

describe('computeScale', () => {
  test('keeps the upscale factor a whole number of at least one', () => {
    for (const [w, h] of RESOLUTIONS) {
      for (const target of TARGETS) {
        const scale = computeScale(w, h, target)
        expect(Number.isInteger(scale)).toBe(true)
        expect(scale).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('never scales below one on a tiny viewport', () => {
    expect(computeScale(64, 32, 216)).toBe(1)
  })
})

describe('computeVirtualSize', () => {
  test('covers the whole viewport once upscaled', () => {
    for (const [w, h] of RESOLUTIONS) {
      const scale = computeScale(w, h, 156)
      const size = computeVirtualSize(w, h, scale)
      expect(size.width * scale).toBeGreaterThanOrEqual(w)
      expect(size.height * scale).toBeGreaterThanOrEqual(h)
    }
  })
})

describe('computeLayout', () => {
  test('nests the scene correctly at every supported resolution', () => {
    for (const [w, h] of RESOLUTIONS) {
      for (const target of TARGETS) {
        const scale = computeScale(w, h, target)
        const size = computeVirtualSize(w, h, scale)
        const layout = computeLayout(size.width, size.height)
        const screen = { x: 0, y: 0, w: size.width, h: size.height }

        expect(layout.opening).toEqual(screen)
        expect(contains(screen, layout.ashBed)).toBe(true)
        expect(contains(screen, layout.logBed)).toBe(true)
        expect(contains(screen, layout.fire)).toBe(true)
        expect(layout.portrait).toBe(h > w)
      }
    }
  })

  test('fills the frame edge to edge — the TV bezel is the surround', () => {
    const layout = computeLayout(275, 155)
    expect(layout.opening).toEqual({ x: 0, y: 0, w: 275, h: 155 })
    expect(layout.fire.x).toBe(0)
    expect(layout.fire.w).toBe(275)
    expect(layout.ashBed.y + layout.ashBed.h).toBe(155)
  })

  test('stacks the logs straight onto the ash bed', () => {
    const layout = computeLayout(275, 155)
    expect(layout.logBed.y + layout.logBed.h).toBe(layout.ashBed.y)
  })

  test('gives the pile the same weight in portrait as in landscape', () => {
    const landscape = computeLayout(275, 155)
    const portrait = computeLayout(155, 275)
    expect(portrait.logBed.h).toBe(landscape.logBed.h)
  })

  test('plants the flame base on the hearth so it does not float beside the logs', () => {
    const layout = computeLayout(275, 155)
    expect(layout.fire.h).toBeGreaterThan(layout.logBed.y)
    expect(layout.fire.h).toBe(layout.ashBed.y)
  })

  test('survives a frame too small for a full pile', () => {
    const layout = computeLayout(16, 16)
    expect(layout.logBed.h).toBeGreaterThan(0)
    expect(layout.ashBed.y).toBeGreaterThan(0)
    expect(layout.fire.h).toBeGreaterThan(0)
  })

  test('produces whole-pixel geometry', () => {
    const layout = computeLayout(275, 155)
    for (const rect of [layout.opening, layout.logBed, layout.fire]) {
      for (const value of [rect.x, rect.y, rect.w, rect.h]) {
        expect(Number.isInteger(value)).toBe(true)
      }
    }
  })
})
