/**
 * The skeletons on the hearth, and the pumpkins they make off with.
 *
 * Two kinds come and go on their own timers, so they can be on the hearth at
 * the same time:
 *
 * - Big skeletons run the pumpkin trade. One walks in, picks up a pumpkin at
 *   random and runs off with it over its head; a little later another walks
 *   in with a different pumpkin, sets it down at a random free spot and
 *   carries on across. Now and then one just strolls past.
 * - Small skeletons turn up more often. Most just stroll across, and half of
 *   those are snatched by a spider dropping from the top; the rest pinch a
 *   pumpkin, which a big one then replaces.
 *
 * The pumpkins are drawn here each frame rather than baked into the static
 * layer, because they come and go.
 */
import { pickPumpkin, type Pumpkin, type Span } from './halloween-hearth'
import {
  drawSprite,
  flipped,
  SKELETON,
  SKELETON_CARRY,
  type Plot,
  type Sprite,
} from './halloween-sprites'
import { SpiderSnatch } from './halloween-snatch'
import { randRange, type Rng } from './prng'

type Errand = 'stroll' | 'steal' | 'return'
type Kind = 'big' | 'small'

interface Skeleton {
  readonly kind: Kind
  active: boolean
  /** Ticks until the next visit, while off screen. */
  timer: number
  visits: number
  errand: Errand
  x: number
  vx: number
  scale: number
  /** Where it is headed: a pumpkin to take, or a spot to put one down. */
  target: Pumpkin | null
  carrying: Pumpkin | null
  /** Ticks left standing still at the target. */
  pause: number
  /** A thief legging it with the loot. */
  fleeing: boolean
  /** A spider lying in wait for a small skeleton out for a stroll. */
  snatch: SpiderSnatch | null
}

/** How long a skeleton stands at a pumpkin to pick it up or put it down. */
const PAUSE_TICKS = 24
/** How much faster a thief runs off than it walked in. */
const FLEE_SPEEDUP = 2.4
/** How often each kind does something other than stroll. */
const BIG_STEAL_CHANCE = 0.7
const SMALL_STEAL_CHANCE = 0.3
/** How often a small stroller is carried off by a spider. */
const SNATCH_CHANCE = 0.5
const WALK = SKELETON
const WALK_LEFT = SKELETON.map(flipped)
const CARRY = SKELETON_CARRY
const CARRY_LEFT = SKELETON_CARRY.map(flipped)

function skeleton(kind: Kind, timer: number): Skeleton {
  return {
    kind,
    active: false,
    timer,
    visits: 0,
    errand: 'stroll',
    x: 0,
    vx: 0,
    scale: 1,
    target: null,
    carrying: null,
    pause: 0,
    fleeing: false,
    snatch: null,
  }
}

export class Skeletons {
  private readonly width: number
  private readonly floor: number
  /** The row the pumpkins stand on. */
  private readonly ground: number
  private readonly rng: Rng
  private readonly pumpkins: Pumpkin[]
  private readonly spans: readonly Span[]
  /** How many pumpkins the hearth started with, so a theft gets undone. */
  private readonly fullCount: number
  /** Big ones are 2x when there is room, so a pumpkin fits in their hands. */
  private readonly bigScale: number
  private readonly skeletons: Skeleton[]

  private ticks = 0
  /**
   * Every design taken since the hearth was last full, so whatever comes back
   * is never one of them.
   */
  private readonly stolen = new Set<Sprite>()
  /** How many skeletons the spiders have carried off. */
  private snatched = 0

  constructor(
    size: { width: number; height: number; ground: number },
    rng: Rng,
    pumpkins: Pumpkin[],
    spans: readonly Span[],
  ) {
    this.width = size.width
    this.floor = size.height
    this.ground = size.ground
    this.rng = rng
    this.pumpkins = pumpkins
    this.spans = spans
    this.fullCount = pumpkins.length
    this.bigScale = size.height >= 100 ? 2 : 1
    this.skeletons = [
      skeleton('big', randRange(rng, 240, 600)),
      skeleton('small', randRange(rng, 120, 300)),
    ]
  }

  /** The pumpkins currently on the hearth. */
  get onHearth(): readonly Pumpkin[] {
    return this.pumpkins
  }

  /** How many skeletons the spiders have carried off so far. */
  get snatchCount(): number {
    return this.snatched
  }

  tick(): void {
    this.ticks++
    for (const sk of this.skeletons) this.update(sk)
  }

  draw(plot: Plot): void {
    for (const p of this.pumpkins) {
      drawSprite(plot, p.sprite, p.x, this.ground - p.sprite.h)
    }
    for (const sk of this.skeletons) {
      if (sk.active) this.drawSkeleton(plot, sk)
    }
  }

  private update(sk: Skeleton): void {
    if (!sk.active) {
      if (--sk.timer <= 0) this.start(sk)
      return
    }
    if (sk.pause > 0) {
      if (--sk.pause === PAUSE_TICKS >> 1) this.handOver(sk)
      return
    }
    if (sk.snatch && this.updateSnatch(sk, sk.snatch)) return
    sk.x += sk.vx
    if (sk.target && this.reached(sk, sk.target)) {
      sk.x = this.standingX(sk, sk.target)
      sk.pause = PAUSE_TICKS
    }
    const w = CARRY[0].w * sk.scale
    if (sk.x < -w - 2 || sk.x > this.width + 2) this.finish(sk)
  }

  private drawSkeleton(plot: Plot, sk: Skeleton): void {
    const left = sk.vx < 0
    const frames = sk.carrying
      ? left
        ? CARRY_LEFT
        : CARRY
      : left
        ? WALK_LEFT
        : WALK
    // Standing still at the target, otherwise walking, faster when running
    // away. The hips drop a pixel on each stride, except while dangling from
    // a spider, when the legs just kick slowly.
    const snatch = sk.snatch
    const dangling = snatch?.lifting ?? false
    const walkPace = (sk.kind === 'small' ? 3 : 5) - (sk.fleeing ? 2 : 0)
    const pace = dangling ? 7 : walkPace
    const still = sk.pause > 0 || (snatch?.holding && !dangling)
    const step = still ? 0 : Math.floor(this.ticks / pace) % frames.length
    const frame = frames[step]
    const bob = dangling ? 0 : step % 2
    const y =
      this.floor -
      (frame.h + 1 - bob) * sk.scale -
      Math.round(snatch?.lift ?? 0)
    // `x` is the left of the plain walking frame; wider frames stay centred.
    const x = sk.x + ((WALK[0].w - frame.w) * sk.scale) / 2

    if (sk.carrying) {
      // Held between the raised hands, which are drawn over its sides.
      const p = sk.carrying.sprite
      const px = x + (frame.w * sk.scale - p.w) / 2
      drawSprite(plot, p, px, y - p.h + 2 * sk.scale)
    }
    drawSprite(plot, frame, x, y, sk.scale)
    snatch?.draw(plot, this.ticks)
  }

  /**
   * Runs the spider's ambush. Returns true while the skeleton is caught, so
   * it stops walking; once it has been hauled out of sight, its visit ends.
   */
  private updateSnatch(sk: Skeleton, snatch: SpiderSnatch): boolean {
    const centre = sk.x + (WALK[0].w * sk.scale) / 2
    snatch.tick(centre - snatch.x)
    if (snatch.ready) {
      const standX = Math.round(snatch.x - (WALK[0].w * sk.scale) / 2)
      if (sk.vx > 0 ? sk.x >= standX : sk.x <= standX) {
        sk.x = standX
        snatch.grab()
      }
    }
    if (!snatch.holding) return false
    if (snatch.lift > this.floor) {
      this.snatched++
      this.finish(sk)
    }
    return true
  }

  private start(sk: Skeleton): void {
    sk.active = true
    sk.pause = 0
    sk.fleeing = false
    sk.snatch = null
    sk.carrying = null
    sk.target = null
    sk.visits++
    // The small ones scurry.
    const speed =
      sk.kind === 'small' ? 0.8 + this.rng() * 0.3 : 0.45 + this.rng() * 0.2
    sk.scale = sk.kind === 'big' ? this.bigScale : 1

    const replacement = sk.kind === 'big' ? this.replacement() : null
    const loot = this.unclaimed()
    const stealChance =
      sk.kind === 'small'
        ? SMALL_STEAL_CHANCE
        : sk.visits === 1
          ? 1
          : BIG_STEAL_CHANCE

    if (replacement) {
      // Bring a different pumpkin in from the nearer side, put it down at a
      // fresh spot, and carry on across the hearth.
      sk.errand = 'return'
      sk.target = replacement
      sk.carrying = replacement
      this.enter(sk, this.centre(replacement) < this.width / 2, speed)
    } else if (loot.length > 0 && this.rng() < stealChance) {
      sk.errand = 'steal'
      sk.target = loot[randRange(this.rng, 0, loot.length - 1)]
      this.enter(sk, this.centre(sk.target) < this.width / 2, speed)
    } else {
      sk.errand = 'stroll'
      // No hearth (the inferno) means no ambush either: just a stroll.
      const hearth = this.spans.length > 0
      if (hearth && sk.kind === 'small' && this.rng() < SNATCH_CHANCE) {
        const x = Math.round(this.width * (0.3 + this.rng() * 0.4))
        const skullTop = this.floor - (WALK[0].h + 1) * sk.scale
        sk.snatch = new SpiderSnatch(x, skullTop)
      }
      this.enter(sk, this.rng() < 0.5, speed)
    }
  }

  /**
   * A pumpkin to bring back if the hearth is short, avoiding the spot and
   * design of any other one already on its way in.
   */
  private replacement(): Pumpkin | null {
    const inbound = this.skeletons
      .filter((sk) => sk.active && sk.errand === 'return' && sk.target)
      .map((sk) => sk.target as Pumpkin)
    if (this.pumpkins.length + inbound.length >= this.fullCount) return null
    const occupied = [...this.pumpkins, ...inbound]
    const avoid = new Set<Sprite>(occupied.map((p) => p.design))
    for (const design of this.stolen) avoid.add(design)
    return pickPumpkin(this.spans, occupied, avoid, this.rng)
  }

  /** Pumpkins no other skeleton is already on its way to take. */
  private unclaimed(): Pumpkin[] {
    const claimed = new Set(
      this.skeletons
        .filter((sk) => sk.active && sk.errand === 'steal')
        .map((sk) => sk.target),
    )
    return this.pumpkins.filter((p) => !claimed.has(p))
  }

  /** Puts the skeleton just off one edge, walking inwards. */
  private enter(sk: Skeleton, fromLeft: boolean, speed: number): void {
    const w = CARRY[0].w * sk.scale
    sk.x = fromLeft ? -w : this.width + 1
    sk.vx = fromLeft ? speed : -speed
  }

  private handOver(sk: Skeleton): void {
    const target = sk.target
    sk.target = null
    if (!target) return
    if (sk.errand === 'return') {
      this.pumpkins.push(target)
      sk.carrying = null
      if (this.pumpkins.length >= this.fullCount) this.stolen.clear()
      return
    }
    const index = this.pumpkins.indexOf(target)
    if (index < 0) {
      // Beaten to it; carry on as if nothing happened.
      sk.errand = 'stroll'
      return
    }
    this.pumpkins.splice(index, 1)
    this.stolen.add(target.design)
    sk.carrying = target
    // And off back the way it came, sharpish.
    sk.vx = -sk.vx * FLEE_SPEEDUP
    sk.fleeing = true
    // A big one comes to fill the gap soon, whoever made it.
    const big = this.skeletons.find((other) => other.kind === 'big')
    if (big && !big.active)
      big.timer = Math.min(big.timer, randRange(this.rng, 150, 360))
  }

  private finish(sk: Skeleton): void {
    sk.active = false
    if (sk.kind === 'small') {
      sk.timer = randRange(this.rng, 180, 450)
      return
    }
    // A gap on the hearth is not left for long; otherwise 10-20 s.
    const short = this.pumpkins.length < this.fullCount
    sk.timer = short
      ? randRange(this.rng, 150, 360)
      : randRange(this.rng, 300, 600)
  }

  private centre(p: Pumpkin): number {
    return p.x + p.sprite.w / 2
  }

  /** Where the skeleton stands to be centred on a pumpkin. */
  private standingX(sk: Skeleton, p: Pumpkin): number {
    return Math.round(this.centre(p) - (WALK[0].w * sk.scale) / 2)
  }

  private reached(sk: Skeleton, p: Pumpkin): boolean {
    const x = this.standingX(sk, p)
    return sk.vx > 0 ? sk.x >= x : sk.x <= x
  }
}
