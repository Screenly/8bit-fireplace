/**
 * Where pumpkins can stand: the stretches of hearth either side of the log
 * pile. Both the opening arrangement and a skeleton bringing a pumpkin back
 * pick a random free spot here, so pumpkins never land in the same place
 * twice in a row and never overlap.
 */
import { flipped, type Sprite } from './halloween-sprites'
import { PUMPKINS } from './halloween-pumpkins'
import type { Layout } from './layout'
import type { Rng } from './prng'

/** A stretch of hearth, `[from, to)` in virtual pixels. */
export interface Span {
  readonly from: number
  readonly to: number
}

export interface Pumpkin {
  /** The design, before any mirroring. */
  readonly design: Sprite
  /** What is drawn: the design, possibly mirrored. */
  readonly sprite: Sprite
  readonly x: number
}

const LARGEST = Math.max(...PUMPKINS.map((s) => s.w))

/** The hearth either side of the log pile. */
export function hearthSpans(layout: Layout): Span[] {
  const { logBed, width } = layout
  // The pumpkins may stand a little in front of the ends of the pile, which
  // is what makes room for them on a narrow portrait hearth.
  const overlap = Math.round(logBed.w * 0.05)
  return [
    { from: 1, to: logBed.x + overlap },
    { from: logBed.x + logBed.w - overlap, to: width - 1 },
  ]
}

/**
 * A random left edge where a `w`-wide pumpkin fits without touching the
 * others, or `null` if there is no room. Every free position is equally
 * likely.
 */
export function freeSpot(
  spans: readonly Span[],
  pumpkins: readonly Pumpkin[],
  w: number,
  rng: Rng,
): number | null {
  const ranges: [number, number][] = []
  for (const span of spans) {
    let start = span.from
    const taken = pumpkins
      .map((p) => [p.x - 1, p.x + p.sprite.w + 1] as const)
      .filter(([a, b]) => b > span.from && a < span.to)
      .sort((a, b) => a[0] - b[0])
    for (const [a, b] of [...taken, [span.to, span.to] as const]) {
      if (a - start >= w) ranges.push([start, a - w])
      start = Math.max(start, b)
    }
  }
  const total = ranges.reduce((sum, [a, b]) => sum + b - a + 1, 0)
  if (total === 0) return null
  let pick = Math.floor(rng() * total)
  for (const [a, b] of ranges) {
    if (pick <= b - a) return a + pick
    pick -= b - a + 1
  }
  return null
}

/**
 * A design that has somewhere to stand, mirrored at random. Large pumpkins
 * read best from across a room, so they win most draws, and designs already
 * on show are skipped while another one fits.
 */
export function pickPumpkin(
  spans: readonly Span[],
  pumpkins: readonly Pumpkin[],
  avoid: ReadonlySet<Sprite>,
  rng: Rng,
): Pumpkin | null {
  const fits = PUMPKINS.filter(
    (s) => freeSpot(spans, pumpkins, s.w, () => 0) !== null,
  )
  const fresh = fits.filter((s) => !avoid.has(s))
  const pool = fresh.length > 0 ? fresh : fits
  if (pool.length === 0) return null
  const large = pool.filter((s) => s.w === LARGEST)
  const options = large.length > 0 && rng() < 0.75 ? large : pool
  const design = options[Math.floor(rng() * options.length)]
  const x = freeSpot(spans, pumpkins, design.w, rng)
  if (x === null) return null
  return { design, sprite: rng() < 0.5 ? flipped(design) : design, x }
}

/**
 * The opening arrangement: up to three pumpkins at random spots, one
 * guaranteed on each side of the pile when there is room for it. A narrow
 * portrait hearth only has room for one a side, so it gets two.
 */
export function placePumpkins(spans: readonly Span[], rng: Rng): Pumpkin[] {
  const pumpkins: Pumpkin[] = []
  const used = new Set<Sprite>()
  const sides = [[spans[0]], [spans[1]], spans]
  for (const where of sides) {
    const pumpkin = pickPumpkin(where, pumpkins, used, rng)
    if (!pumpkin) continue
    pumpkins.push(pumpkin)
    used.add(pumpkin.design)
  }
  return pumpkins
}
