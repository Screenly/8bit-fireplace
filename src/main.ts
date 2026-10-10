import './style.css'
import {
  getHardware,
  getScreenName,
  getScreenlyVersion,
  reportError,
  setupErrorHandling,
  setupSentry,
  signalReady,
} from '@screenly/edge-apps'
import { createStage, present, type Stage } from './fireplace/display'
import {
  readSettings,
  resolveTheme,
  type FireplaceSettings,
} from './fireplace/settings'

/** The simulation runs at a fixed 30 ticks per second on every player. */
const TICK_MS = 1000 / 30
/** Ticks caught up in one frame before the clock is considered lost. */
const MAX_CATCH_UP = 4
const RESIZE_DEBOUNCE_MS = 250
/** How often an `auto` theme looks at the calendar again. */
const THEME_CHECK_MS = 60_000

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight }
}

function start(canvas: HTMLCanvasElement, settings: FireplaceSettings): void {
  // The brickwork is seeded from the hostname so a screen always shows the
  // same room, but the Halloween dressing is rearranged on every load. It is
  // picked once here, so a resize keeps the same arrangement.
  const options = { decorSeed: Math.floor(Math.random() * 0xffffffff) + 1 }

  // Paint the first frame synchronously, then signal ready. Waiting for
  // requestAnimationFrame (as we used to) overshoots the player's ready
  // timeout on Pi / Player Max and the asset gets skipped, while Anywhere
  // still looks fine — same pattern as the 44con CTF edge-app fix.
  let stage: Stage = createStage(canvas, settings, viewport(), options)
  present(stage)
  signalReady()

  let last = Date.now()
  let accumulator = 0
  let reported = false

  function rebuildNow(source: string): void {
    try {
      stage = createStage(canvas, settings, viewport(), options)
      accumulator = TICK_MS
    } catch (error) {
      reportError(error, { source })
    }
  }
  const rebuild = debounce(() => rebuildNow('resize'), RESIZE_DEBOUNCE_MS)

  // A screen can run for weeks without a reload, so an `auto` theme has to
  // notice the season changing on its own.
  if (settings.theme === 'auto') {
    setInterval(() => {
      if (resolveTheme(settings.theme, new Date()) !== stage.theme) {
        rebuildNow('theme')
      }
    }, THEME_CHECK_MS)
  }

  function frame(): void {
    const now = Date.now()
    // A player's clock can jump when NTP lands; clamp rather than fast-forward.
    const delta = Math.min(1000, Math.max(0, now - last))
    last = now
    accumulator += delta

    let ticks = 0
    while (accumulator >= TICK_MS && ticks < MAX_CATCH_UP) {
      stage.engine.tick()
      accumulator -= TICK_MS
      ticks++
    }
    if (accumulator > TICK_MS * MAX_CATCH_UP) accumulator = 0

    if (ticks > 0) {
      try {
        present(stage)
      } catch (error) {
        if (!reported) {
          reported = true
          reportError(error, { source: 'render' })
        }
      }
    }
    window.requestAnimationFrame(frame)
  }

  window.addEventListener('resize', rebuild)
  window.addEventListener('orientationchange', rebuild)
  window.requestAnimationFrame(frame)
}

function debounce(action: () => void, wait: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(action, wait)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    setupErrorHandling()
    setupSentry('8bit-fireplace', {
      '8bit-fireplace': {
        screenName: getScreenName(),
        // The renderer is CPU-bound on the flame simulation, so hardware class
        // and player version are the first things worth knowing about a crash.
        hardware: getHardware(),
        screenlyVersion: getScreenlyVersion(),
      },
    })

    const settings = readSettings()
    document.body.classList.toggle('crt', settings.crt)

    const canvas = document.getElementById('fireplace')
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Missing #fireplace canvas')
    }
    start(canvas, settings)
  } catch (error) {
    // Nothing can be drawn, but the player must not be left waiting on a
    // ready signal that will never come — that holds a blank screen for the
    // asset's whole duration instead of moving on to the next one.
    reportError(error, { source: 'startup' })
    signalReady()
  }
})
