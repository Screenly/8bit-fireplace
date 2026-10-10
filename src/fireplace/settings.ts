/**
 * Reads the Edge App settings and turns them into engine configuration.
 *
 * The parsing helpers are pure so they can be tested without a Screenly
 * runtime; only {@link readSettings} touches the global `screenly` object.
 */
import { getSettingWithDefault } from '@screenly/edge-apps'
import { getHostname } from '@screenly/edge-apps/utils'
import type { SceneVariant, Theme } from './engine'
import { FLAME_COLORS, type FlameColor } from './ramps'

export type PixelSize = 'chunky' | 'classic' | 'fine'
export type FlameHeight = 'low' | 'medium' | 'high'
/** `auto` follows the calendar; the others pin a theme all year round. */
export type ThemeSetting = 'auto' | Theme

export const PIXEL_SIZES: readonly PixelSize[] = ['chunky', 'classic', 'fine']
export const FLAME_HEIGHTS: readonly FlameHeight[] = ['low', 'medium', 'high']
export const SCENE_VARIANTS: readonly SceneVariant[] = ['hearth', 'inferno']
export const THEME_SETTINGS: readonly ThemeSetting[] = [
  'auto',
  'standard',
  'halloween',
]

/** How many virtual pixels the shorter edge of the screen is divided into. */
export const TARGET_SHORT_SIDE: Record<PixelSize, number> = {
  chunky: 108,
  classic: 156,
  fine: 216,
}

/** Flame height as a fraction of the firebox. */
export const REACH_FACTOR: Record<FlameHeight, number> = {
  low: 0.3,
  medium: 0.45,
  high: 0.62,
}

export interface FireplaceSettings {
  flame: FlameColor
  flameHeight: FlameHeight
  pixelSize: PixelSize
  variant: SceneVariant
  theme: ThemeSetting
  crt: boolean
  seed: number
}

/**
 * The theme to draw on a given day. `auto` dresses the hearth for Halloween
 * through the whole of October, by the player's local clock.
 */
export function resolveTheme(setting: ThemeSetting, date: Date): Theme {
  if (setting !== 'auto') return setting
  return date.getMonth() === 9 ? 'halloween' : 'standard'
}

/** Falls back rather than throwing, so a bad setting never blanks a screen. */
export function pickChoice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  return allowed.includes(normalized as T) ? (normalized as T) : fallback
}

/**
 * A stable seed per screen, so two screens side by side do not have pixel-identical
 * masonry while each one stays the same across restarts.
 */
export function seedFrom(name: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 || 1
}

export function readSettings(): FireplaceSettings {
  return {
    flame: pickChoice(
      getSettingWithDefault<string>('flame_color', 'classic'),
      FLAME_COLORS,
      'classic',
    ),
    flameHeight: pickChoice(
      getSettingWithDefault<string>('flame_height', 'medium'),
      FLAME_HEIGHTS,
      'medium',
    ),
    pixelSize: pickChoice(
      getSettingWithDefault<string>('pixel_size', 'classic'),
      PIXEL_SIZES,
      'classic',
    ),
    variant: pickChoice(
      getSettingWithDefault<string>('scene', 'hearth'),
      SCENE_VARIANTS,
      'hearth',
    ),
    theme: pickChoice(
      getSettingWithDefault<string>('theme', 'auto'),
      THEME_SETTINGS,
      'auto',
    ),
    crt: getSettingWithDefault<boolean>('crt_effect', false),
    seed: seedFrom(safeHostname()),
  }
}

function safeHostname(): string {
  try {
    return getHostname() || 'screenly'
  } catch {
    return 'screenly'
  }
}
