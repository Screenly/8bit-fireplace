/**
 * Binds the engine to a canvas.
 *
 * The canvas is kept at the small virtual resolution and blown up by a whole
 * number of device pixels via CSS. That keeps every chunky pixel exactly
 * square on 480x800 and on 4096x2160 alike, and means the per-frame cost
 * barely moves between them.
 */
import { Engine, type Theme } from './engine'
import { computeScale, computeVirtualSize } from './layout'
import {
  REACH_FACTOR,
  resolveTheme,
  TARGET_SHORT_SIDE,
  type FireplaceSettings,
} from './settings'

export interface Viewport {
  width: number
  height: number
}

export interface Stage {
  engine: Engine
  context: CanvasRenderingContext2D
  frame: ImageData
  pixels: Uint32Array
  scale: number
  /** The theme this stage was built with, after resolving `auto`. */
  theme: Theme
}

/** Builds a stage sized for `viewport` and lays the canvas out over it. */
export function createStage(
  canvas: HTMLCanvasElement,
  settings: FireplaceSettings,
  viewport: Viewport,
  options: { now?: Date; decorSeed?: number } = {},
): Stage {
  const theme = resolveTheme(settings.theme, options.now ?? new Date())
  const scale = computeScale(
    viewport.width,
    viewport.height,
    TARGET_SHORT_SIDE[settings.pixelSize],
  )
  const size = computeVirtualSize(viewport.width, viewport.height, scale)

  canvas.width = size.width
  canvas.height = size.height
  applyCanvasLayout(canvas, size, scale, viewport)

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('2D canvas context is unavailable')
  context.imageSmoothingEnabled = false

  const frame = context.createImageData(size.width, size.height)
  return {
    engine: new Engine({
      width: size.width,
      height: size.height,
      flame: settings.flame,
      reachFactor: REACH_FACTOR[settings.flameHeight],
      variant: settings.variant,
      theme,
      seed: settings.seed,
      decorSeed: options.decorSeed,
    }),
    context,
    frame,
    pixels: new Uint32Array(frame.data.buffer),
    scale,
    theme,
  }
}

/**
 * Centres the upscaled canvas. Offsets are whole pixels: a half-pixel here is
 * enough to make the browser resample and soften every edge in the scene.
 */
function applyCanvasLayout(
  canvas: HTMLCanvasElement,
  size: Viewport,
  scale: number,
  viewport: Viewport,
): void {
  const cssWidth = size.width * scale
  const cssHeight = size.height * scale
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`
  canvas.style.left = `${Math.round((viewport.width - cssWidth) / 2)}px`
  canvas.style.top = `${Math.round((viewport.height - cssHeight) / 2)}px`
  canvas.ownerDocument.documentElement.style.setProperty(
    '--scanline',
    `${Math.max(2, scale)}px`,
  )
}

/** Pushes the current frame buffer to the canvas. */
export function present(stage: Stage): void {
  stage.engine.paint(stage.pixels)
  stage.context.putImageData(stage.frame, 0, 0)
}
