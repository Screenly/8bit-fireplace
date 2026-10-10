/**
 * Spiders bobbing on silk, and bats and the odd ghost crossing the upper
 * firebox. The skeletons on the hearth live in `halloween-skeletons`.
 *
 * Every critter is drawn at a random whole-number scale, never a fractional
 * one, so the sprites stay as crisp as the rest of the pixel art.
 */
import {
  BAT,
  DECOR,
  drawSprite,
  GHOST,
  SPIDERS,
  type Plot,
  type SpiderKind,
} from './halloween-sprites'
import type { Layout } from './layout'
import { randRange, type Rng } from './prng'

interface Spider {
  kind: SpiderKind
  scale: number
  /** The column this spider's thread hangs near. */
  readonly home: number
  x: number
  min: number
  max: number
  phase: number
  speed: number
  /** Offsets the leg twitch so the spiders do not move in step. */
  twitch: number
  /** How far down it has let itself, from 0 (out of sight) to 1. */
  drop: number
  /** Ticks left before it climbs away and another takes its place. */
  life: number
}

/** How long a spider hangs about before climbing off, in ticks. */
const SPIDER_LIFE: [number, number] = [30 * 20, 30 * 45]
/** How much of the full drop a spider covers per tick, coming or going. */
const SPIDER_CLIMB = 0.012

interface Walker {
  active: boolean
  x: number
  y: number
  vx: number
  baseY: number
  amp: number
  phase: number
  scale: number
  frameOffset: number
}

function idle(): Walker {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    baseY: 0,
    amp: 0,
    phase: 0,
    scale: 1,
    frameOffset: 0,
  }
}

/** Picks a scale from weighted options, e.g. `[[1, 0.7], [2, 0.3]]`. */
export function pickScale(
  rng: Rng,
  weights: readonly [number, number][],
): number {
  let roll = rng()
  for (const [scale, weight] of weights) {
    if ((roll -= weight) < 0) return scale
  }
  return weights[0][0]
}

export class Critters {
  private readonly width: number
  private readonly height: number
  private readonly rng: Rng
  private readonly spiders: Spider[]
  private readonly spiderReach: number
  private readonly bats: Walker[] = [idle(), idle(), idle(), idle()]
  private readonly ghost = idle()

  private ticks = 0
  private batTimer: number
  private ghostTimer: number

  constructor(layout: Layout, rng: Rng) {
    this.width = layout.width
    this.height = layout.height
    this.rng = rng

    const reach = layout.logBed.y - 18
    this.spiderReach = Math.max(
      4,
      Math.min(Math.round(this.height * 0.3), reach),
    )
    const columns = layout.portrait ? [0.14, 0.5, 0.84] : [0.09, 0.66, 0.91]
    this.spiders = []
    for (const at of columns) {
      const spider = { home: Math.round(this.width * at) } as Spider
      this.respawn(spider)
      // Already down at the start, and leaving at different times.
      spider.drop = 1
      spider.life = randRange(rng, 30 * 5, SPIDER_LIFE[1])
      this.spiders.push(spider)
    }

    this.batTimer = randRange(rng, 45, 150)
    // The ghost turns up early once, then keeps to itself.
    this.ghostTimer = randRange(rng, 150, 450)
  }

  tick(): void {
    this.ticks++
    for (const spider of this.spiders) this.updateSpider(spider)
    this.updateBats()
    this.updateGhost()
  }

  draw(plot: Plot): void {
    for (const spider of this.spiders) this.drawSpider(plot, spider)
    for (const bat of this.bats) {
      if (!bat.active) continue
      const frame = Math.floor((this.ticks + bat.frameOffset) / 5) % 2
      drawSprite(plot, BAT[frame], bat.x, bat.y, bat.scale)
    }
    const ghost = this.ghost
    if (ghost.active) {
      const frame = Math.floor(this.ticks / 12) % 2
      drawSprite(plot, GHOST[frame], ghost.x, ghost.y, ghost.scale)
    }
  }

  private drawSpider(plot: Plot, spider: Spider): void {
    const { kind, scale } = spider
    const swing = 0.5 - 0.5 * Math.cos(this.ticks * spider.speed + spider.phase)
    const hang = spider.min + (spider.max - spider.min) * swing
    // Coming down from, or climbing back up to, just out of sight.
    const hidden = -kind.frames[0].h * scale
    const top = Math.round(hidden + (hang - hidden) * spider.drop)
    for (let y = 0; y < top; y++) plot(spider.x, y, DECOR.WEB)
    // A quick leg twitch every three seconds or so.
    const frame = (this.ticks + spider.twitch) % 90 < 8 ? 1 : 0
    const left = spider.x - kind.attach * scale
    drawSprite(plot, kind.frames[frame], left, top, scale)
  }

  /**
   * Spiders take turns: each hangs about for a while, climbs off, and a new
   * one of a random kind and size lets itself down nearby.
   */
  private updateSpider(spider: Spider): void {
    if (spider.life > 0) {
      spider.life--
      spider.drop = Math.min(1, spider.drop + SPIDER_CLIMB)
      return
    }
    spider.drop -= SPIDER_CLIMB
    if (spider.drop <= 0) this.respawn(spider)
  }

  /** A fresh spider for a thread, starting out of sight. */
  private respawn(spider: Spider): void {
    const rng = this.rng
    const roll = rng()
    // Never all tiny at once, or they are lost against the brickwork.
    const othersTiny = (this.spiders ?? []).every(
      (other) => other === spider || other.kind === SPIDERS.tiny,
    )
    const tiny = roll < 0.3 && !othersTiny
    spider.kind = tiny ? SPIDERS.tiny : SPIDERS.normal
    spider.scale = roll > 0.65 ? 2 : 1
    spider.x = spider.home + randRange(rng, -4, 4)
    spider.min = Math.max(2, Math.round(this.height * 0.05))
    spider.max = Math.max(4, Math.round(this.spiderReach * (0.5 + rng() * 0.5)))
    spider.phase = rng() * Math.PI * 2
    spider.speed = (Math.PI * 2) / (30 * (8 + rng() * 6))
    spider.twitch = randRange(rng, 0, 89)
    spider.drop = 0
    spider.life = randRange(rng, SPIDER_LIFE[0], SPIDER_LIFE[1])
  }

  private updateBats(): void {
    for (const bat of this.bats) {
      if (!bat.active) continue
      bat.x += bat.vx
      bat.y = bat.baseY + Math.sin(bat.x * 0.09 + bat.phase) * bat.amp
      this.retireOffscreen(bat, BAT[0].w)
    }
    if (--this.batTimer > 0) return
    const bat = this.bats.find((candidate) => !candidate.active)
    if (bat) {
      bat.scale = pickScale(this.rng, [
        [1, 0.65],
        [2, 0.35],
      ])
      this.launch(bat, 0.45 + this.rng() * 0.4, BAT[0].w, 0.06, 0.3)
      bat.amp = (2 + this.rng() * 3) * bat.scale
    }
    // Bats often come in twos and threes.
    this.batTimer =
      this.rng() < 0.45
        ? randRange(this.rng, 8, 30)
        : randRange(this.rng, 150, 420)
  }

  private updateGhost(): void {
    const ghost = this.ghost
    if (ghost.active) {
      ghost.x += ghost.vx
      ghost.y =
        ghost.baseY + Math.sin(this.ticks * 0.05 + ghost.phase) * ghost.amp
      if (this.retireOffscreen(ghost, GHOST[0].w)) {
        this.ghostTimer = randRange(this.rng, 900, 2100)
      }
      return
    }
    if (--this.ghostTimer > 0) return
    ghost.scale = pickScale(this.rng, [
      [1, 0.5],
      [2, 0.5],
    ])
    this.launch(ghost, 0.16 + this.rng() * 0.12, GHOST[0].w, 0.12, 0.25)
    ghost.amp = 2 + ghost.scale
  }

  /** Deactivates a critter once it has fully left the screen. */
  private retireOffscreen(walker: Walker, spriteWidth: number): boolean {
    const w = spriteWidth * walker.scale
    if (walker.x >= -w - 2 && walker.x <= this.width + 2) return false
    walker.active = false
    return true
  }

  /** Sends a critter across from a random side, somewhere in a band. */
  private launch(
    walker: Walker,
    speed: number,
    spriteWidth: number,
    top: number,
    band: number,
  ): void {
    const rightward = this.rng() < 0.5
    walker.active = true
    walker.x = rightward ? -spriteWidth * walker.scale : this.width + 1
    walker.vx = rightward ? speed : -speed
    walker.baseY = Math.round(this.height * (top + this.rng() * band))
    walker.y = walker.baseY
    walker.phase = this.rng() * Math.PI * 2
    walker.frameOffset = randRange(this.rng, 0, 9)
  }
}
