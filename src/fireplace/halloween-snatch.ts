/**
 * A big spider that lowers itself on silk, waits for a small skeleton to walk
 * underneath, drops onto its skull and hauls it up out of the firebox.
 *
 * The spider only knows about its own thread. `Skeletons` decides when the
 * skeleton is underneath, and lifts the skeleton by `lift` while it is held.
 */
import { DECOR, drawSprite, SPIDERS, type Plot } from './halloween-sprites'

type Phase = 'waiting' | 'lowering' | 'hanging' | 'grabbing' | 'lifting'

/** The spider is drawn at 2x, so it is clearly bigger than its prey. */
const SCALE = 2
const KIND = SPIDERS.normal
const HEIGHT = KIND.frames[0].h * SCALE
/** How close the skeleton gets before the spider starts down. */
const WAKE_DISTANCE = 90
const LOWER_SPEED = 1.5
const LIFT_SPEED = 0.6
/** Ticks spent with a firm grip before hauling the skeleton up. */
const GRIP_TICKS = 12

export class SpiderSnatch {
  /** The column the silk hangs from. */
  readonly x: number
  /** How far the skeleton has been lifted off the hearth. */
  lift = 0

  private phase: Phase = 'waiting'
  private y = -HEIGHT
  private readonly hangY: number
  private readonly grabY: number
  private grip = GRIP_TICKS

  /** `skullTop` is the top of the skeleton's head while it walks. */
  constructor(x: number, skullTop: number) {
    this.x = x
    // Legs closing over the top of the skull.
    this.grabY = skullTop - HEIGHT + 4
    // Waiting just out of reach above the head.
    this.hangY = this.grabY - HEIGHT
  }

  /** True once the skeleton has been caught and should stop walking. */
  get holding(): boolean {
    return this.phase === 'grabbing' || this.phase === 'lifting'
  }

  get lifting(): boolean {
    return this.phase === 'lifting'
  }

  /** Whether the spider is down far enough to make a grab. */
  get ready(): boolean {
    return this.phase === 'lowering' || this.phase === 'hanging'
  }

  /** `distance` is how far the skeleton's centre is from the silk. */
  tick(distance: number): void {
    switch (this.phase) {
      case 'waiting':
        if (Math.abs(distance) < WAKE_DISTANCE) this.phase = 'lowering'
        break
      case 'lowering':
        this.y = Math.min(this.hangY, this.y + LOWER_SPEED)
        if (this.y >= this.hangY) this.phase = 'hanging'
        break
      case 'hanging':
        break
      case 'grabbing':
        this.y = Math.min(this.grabY, this.y + LOWER_SPEED)
        if (this.y >= this.grabY && --this.grip <= 0) this.phase = 'lifting'
        break
      case 'lifting':
        this.y -= LIFT_SPEED
        this.lift += LIFT_SPEED
        break
    }
  }

  grab(): void {
    this.phase = 'grabbing'
  }

  draw(plot: Plot, ticks: number): void {
    if (this.phase === 'waiting') return
    const top = Math.round(this.y)
    for (let y = 0; y < top; y++) plot(this.x, y, DECOR.WEB)
    // Legs working while it holds on, still while it waits.
    const frame = this.holding ? Math.floor(ticks / 6) % 2 : 0
    const left = this.x - KIND.attach * SCALE
    drawSprite(plot, KIND.frames[frame], left, top, SCALE)
  }
}
