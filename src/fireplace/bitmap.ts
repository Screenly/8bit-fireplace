/**
 * A clipped, indexed-colour bitmap — the surface all the pixel art is drawn
 * onto before the palette is applied.
 */
import type { Rect } from './layout'

export class IndexedBitmap {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8Array(width * height)
  }

  fill(color: number): void {
    this.data.fill(color)
  }

  set(x: number, y: number, color: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    this.data[y * this.width + x] = color
  }

  fillRect(x: number, y: number, w: number, h: number, color: number): void {
    const x0 = Math.max(0, x)
    const y0 = Math.max(0, y)
    const x1 = Math.min(this.width, x + w)
    const y1 = Math.min(this.height, y + h)
    for (let py = y0; py < y1; py++) {
      this.data.fill(color, py * this.width + x0, py * this.width + x1)
    }
  }

  fillArea(rect: Rect, color: number): void {
    this.fillRect(rect.x, rect.y, rect.w, rect.h, color)
  }

  hLine(x: number, y: number, w: number, color: number): void {
    this.fillRect(x, y, w, 1, color)
  }

  vLine(x: number, y: number, h: number, color: number): void {
    this.fillRect(x, y, 1, h, color)
  }

  /** A one-pixel Bresenham line, inclusive of both ends. */
  line(x0: number, y0: number, x1: number, y1: number, color: number): void {
    let x = Math.round(x0)
    let y = Math.round(y0)
    const tx = Math.round(x1)
    const ty = Math.round(y1)
    const dx = Math.abs(tx - x)
    const dy = -Math.abs(ty - y)
    const sx = x < tx ? 1 : -1
    const sy = y < ty ? 1 : -1
    let error = dx + dy
    for (;;) {
      this.set(x, y, color)
      if (x === tx && y === ty) return
      const twice = error * 2
      if (twice >= dy) {
        error += dy
        x += sx
      }
      if (twice <= dx) {
        error += dx
        y += sy
      }
    }
  }
}
