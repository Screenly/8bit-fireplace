import { describe, expect, test } from 'bun:test'
import { freeSpot, placePumpkins, type Span } from './halloween-hearth'
import { Skeletons } from './halloween-skeletons'
import { createRng } from './prng'

const SPANS: Span[] = [
  { from: 1, to: 70 },
  { from: 205, to: 274 },
]
const SIZE = { width: 275, height: 155, ground: 148 }

function overlaps(a: { x: number; w: number }, b: { x: number; w: number }) {
  return a.x < b.x + b.w && b.x < a.x + a.w
}

describe('hearth', () => {
  test('places pumpkins inside the hearth without overlapping', () => {
    for (let seed = 1; seed < 50; seed++) {
      const pumpkins = placePumpkins(SPANS, createRng(seed))
      expect(pumpkins.length).toBeGreaterThanOrEqual(2)
      const boxes = pumpkins.map((p) => ({ x: p.x, w: p.sprite.w }))
      for (const box of boxes) {
        const inside = SPANS.some(
          (span) => box.x >= span.from && box.x + box.w <= span.to,
        )
        expect(inside).toBe(true)
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i], boxes[j])).toBe(false)
        }
      }
    }
  })

  test('varies the arrangement between loads', () => {
    const layouts = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        placePumpkins(SPANS, createRng(seed))
          .map((p) => p.x)
          .join(','),
      ),
    )
    expect(layouts.size).toBeGreaterThan(1)
  })

  test('reports no spot when nothing fits', () => {
    expect(freeSpot([{ from: 0, to: 10 }], [], 20, () => 0.5)).toBeNull()
  })
})

describe('Skeletons', () => {
  test('steal a pumpkin, then bring back a different one somewhere else', () => {
    const rng = createRng(3)
    const pumpkins = placePumpkins(SPANS, rng)
    const start = pumpkins.length
    const skeletons = new Skeletons(SIZE, rng, pumpkins, SPANS)

    let taken: { x: number; design: unknown } | null = null
    let brought: { x: number; design: unknown } | null = null
    for (let i = 0; i < 30 * 60 * 10 && !brought; i++) {
      const before = new Set(skeletons.onHearth)
      skeletons.tick()
      const now = skeletons.onHearth
      // A big and a small thief can each be off with one at most.
      expect(now.length).toBeGreaterThanOrEqual(start - 2)
      expect(now.length).toBeLessThanOrEqual(start)
      if (!taken && now.length < before.size) {
        taken = [...before].find((p) => !now.includes(p)) ?? null
      }
      if (taken && now.length === start) {
        brought = now.find((p) => !before.has(p)) ?? null
      }
    }

    expect(taken).not.toBeNull()
    expect(brought).not.toBeNull()
    expect(brought?.design).not.toBe(taken?.design)
  })

  test('only stroll when there is no hearth', () => {
    const skeletons = new Skeletons(SIZE, createRng(3), [], [])
    for (let i = 0; i < 30 * 60 * 10; i++) skeletons.tick()
    expect(skeletons.onHearth).toHaveLength(0)
    expect(skeletons.snatchCount).toBe(0)
  })

  test('small skeletons turn up often, and spiders take some of them', () => {
    const rng = createRng(3)
    const skeletons = new Skeletons(SIZE, rng, placePumpkins(SPANS, rng), SPANS)
    const pixels: number[] = []
    for (let i = 0; i < 30 * 60 * 10; i++) {
      skeletons.tick()
      skeletons.draw((x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) pixels.push(i)
      })
    }
    expect(pixels).toHaveLength(0)
    // Ten minutes is plenty of time for several snatches.
    expect(skeletons.snatchCount).toBeGreaterThan(3)
  })
})
