import { test } from '@playwright/test'
import {
  captureScreenshot,
  createMockScreenlyForScreenshots,
} from '@screenly/edge-apps/test/screenshots'

const metadata = {
  hostname: 'srly-fireplace-demo',
  screen_name: 'Fireplace Demo',
}

const RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1080, height: 1920 },
] as const

const VARIANTS = [
  {
    filenamePrefix: '8bit-fireplace',
    settings: {
      crt_effect: 'false',
      flame_color: 'classic',
      flame_height: 'medium',
      pixel_size: 'classic',
      scene: 'hearth',
    },
  },
  {
    filenamePrefix: '8bit-fireplace-azure',
    settings: {
      crt_effect: 'false',
      flame_color: 'azure',
      flame_height: 'medium',
      pixel_size: 'classic',
      scene: 'hearth',
    },
  },
  {
    filenamePrefix: '8bit-fireplace-emerald',
    settings: {
      crt_effect: 'false',
      flame_color: 'emerald',
      flame_height: 'medium',
      pixel_size: 'classic',
      scene: 'hearth',
    },
  },
  {
    filenamePrefix: '8bit-fireplace-violet',
    settings: {
      crt_effect: 'false',
      flame_color: 'violet',
      flame_height: 'medium',
      pixel_size: 'classic',
      scene: 'hearth',
    },
  },
  {
    filenamePrefix: '8bit-fireplace-inferno',
    settings: {
      crt_effect: 'false',
      flame_color: 'classic',
      flame_height: 'medium',
      pixel_size: 'classic',
      scene: 'inferno',
    },
  },
  {
    filenamePrefix: '8bit-fireplace-crt',
    settings: {
      crt_effect: 'true',
      flame_color: 'classic',
      flame_height: 'medium',
      pixel_size: 'classic',
      scene: 'hearth',
    },
  },
  {
    filenamePrefix: '8bit-fireplace-chunky',
    settings: {
      crt_effect: 'false',
      flame_color: 'classic',
      flame_height: 'medium',
      pixel_size: 'chunky',
      scene: 'hearth',
    },
  },
  {
    filenamePrefix: '8bit-fireplace-fine',
    settings: {
      crt_effect: 'false',
      flame_color: 'classic',
      flame_height: 'medium',
      pixel_size: 'fine',
      scene: 'hearth',
    },
  },
] as const

for (const variant of VARIANTS) {
  const { screenlyJsContent } = createMockScreenlyForScreenshots(
    metadata,
    variant.settings,
  )

  for (const { width, height } of RESOLUTIONS) {
    test(`screenshot ${variant.filenamePrefix} ${width}x${height}`, async ({
      browser,
    }) => {
      await captureScreenshot(browser, {
        width,
        height,
        filenamePrefix: variant.filenamePrefix,
        screenlyJsContent,
      })
    })
  }
}
