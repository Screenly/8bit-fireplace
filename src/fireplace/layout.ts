/**
 * Scene geometry, in virtual (chunky) pixels.
 *
 * The screen *is* the fireplace opening — the TV's own bezel frames the
 * hearth, so nothing here draws a surround. Everything is derived from the
 * virtual framebuffer, so the same art composes correctly on every resolution
 * Screenly supports, landscape or portrait.
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Layout {
  width: number
  height: number
  portrait: boolean
  /** The firebox — the whole screen. */
  opening: Rect
  /** The ash bed at the bottom. */
  ashBed: Rect
  /** Where the logs are stacked. */
  logBed: Rect
  /** The area the flame simulation covers. */
  fire: Rect
}

/**
 * Picks an integer upscale factor so every virtual pixel lands on a whole
 * number of device pixels — uneven pixel sizes are the fastest way to make
 * pixel art look wrong.
 */
export function computeScale(
  width: number,
  height: number,
  targetShortSide: number,
): number {
  const short = Math.max(1, Math.min(width, height))
  return Math.max(1, Math.round(short / targetShortSide))
}

/** The virtual framebuffer size for a viewport at a given upscale factor. */
export function computeVirtualSize(
  width: number,
  height: number,
  scale: number,
): { width: number; height: number } {
  return {
    width: Math.max(16, Math.ceil(width / scale)),
    height: Math.max(16, Math.ceil(height / scale)),
  }
}

/** Derives the whole scene from a virtual framebuffer size. */
export function computeLayout(width: number, height: number): Layout {
  // Sized off the short edge so the pile looks the same weight in portrait as
  // it does in landscape, rather than a sliver at the bottom of a tall screen.
  const short = Math.min(width, height)
  const portrait = height > width
  const ashH = Math.max(2, Math.min(Math.round(short * 0.05), height - 6))
  const logH = Math.max(
    4,
    Math.min(Math.round(short * 0.17), height - ashH - 2),
  )
  // A wider pile in portrait, or the fire reads as a narrow column.
  const logW = Math.max(3, Math.round(width * (portrait ? 0.74 : 0.56)))

  const ashBed = { x: 0, y: height - ashH, w: width, h: ashH }
  const logBed = {
    x: Math.round((width - logW) / 2),
    y: ashBed.y - logH,
    w: logW,
    h: logH,
  }

  return {
    width,
    height,
    portrait,
    opening: { x: 0, y: 0, w: width, h: height },
    ashBed,
    logBed,
    // The fire runs down to the ash bed so the flame base sits on the hearth
    // beside the logs. The log overlay is drawn on top, so the pile still
    // covers the source and flames lick up between the logs.
    fire: {
      x: 0,
      y: 0,
      w: width,
      h: Math.min(height, Math.max(4, ashBed.y)),
    },
  }
}
