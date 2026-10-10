import { afterEach, describe, expect, test } from 'bun:test'
import { resetScreenlyMock, setupScreenlyMock } from '@screenly/edge-apps/test'
import { pickChoice, readSettings, resolveTheme, seedFrom } from './settings'

describe('pickChoice', () => {
  const allowed = ['classic', 'azure'] as const

  test('accepts a valid choice', () => {
    expect(pickChoice('azure', allowed, 'classic')).toBe('azure')
  })

  test('is forgiving about case and whitespace', () => {
    expect(pickChoice('  AZURE ', allowed, 'classic')).toBe('azure')
  })

  test('falls back rather than blanking the screen', () => {
    expect(pickChoice('chartreuse', allowed, 'classic')).toBe('classic')
    expect(pickChoice(undefined, allowed, 'classic')).toBe('classic')
    expect(pickChoice(42, allowed, 'classic')).toBe('classic')
  })
})

describe('seedFrom', () => {
  test('is stable for a given screen', () => {
    expect(seedFrom('srly-lobby-01')).toBe(seedFrom('srly-lobby-01'))
  })

  test('differs between screens', () => {
    expect(seedFrom('srly-lobby-01')).not.toBe(seedFrom('srly-lobby-02'))
  })

  test('never returns zero, even for an empty name', () => {
    expect(seedFrom('')).toBeGreaterThan(0)
  })
})

describe('readSettings', () => {
  afterEach(() => {
    resetScreenlyMock()
  })

  test('reads the configured values', () => {
    setupScreenlyMock(
      { hostname: 'srly-lobby-01' },
      {
        crt_effect: 'true',
        flame_color: 'emerald',
        flame_height: 'high',
        pixel_size: 'chunky',
        scene: 'inferno',
        theme: 'halloween',
        music: 'toccata',
      },
    )
    expect(readSettings()).toEqual({
      crt: true,
      flame: 'emerald',
      flameHeight: 'high',
      pixelSize: 'chunky',
      variant: 'inferno',
      theme: 'halloween',
      sound: false,
      music: 'toccata',
      seed: seedFrom('srly-lobby-01'),
    })
  })

  test('falls back to a lit hearth when nothing is configured', () => {
    setupScreenlyMock({ hostname: 'srly-lobby-01' }, {})
    const settings = readSettings()
    expect(settings.flame).toBe('classic')
    expect(settings.flameHeight).toBe('medium')
    expect(settings.pixelSize).toBe('classic')
    expect(settings.variant).toBe('hearth')
    expect(settings.crt).toBe(false)
    expect(settings.theme).toBe('auto')
    expect(settings.sound).toBe(false)
    expect(settings.music).toBe('shuffle')
  })

  test('ignores nonsense values instead of failing', () => {
    setupScreenlyMock(
      { hostname: 'srly-lobby-01' },
      {
        flame_color: 'chartreuse',
        pixel_size: '',
        scene: 'volcano',
        theme: 'christmas',
        music: 'jingle_bells',
      },
    )
    const settings = readSettings()
    expect(settings.music).toBe('shuffle')
    expect(settings.theme).toBe('auto')
    expect(settings.flame).toBe('classic')
    expect(settings.pixelSize).toBe('classic')
    expect(settings.variant).toBe('hearth')
  })
})

describe('resolveTheme', () => {
  test('auto dresses up for Halloween through October', () => {
    expect(resolveTheme('auto', new Date(2026, 9, 1))).toBe('halloween')
    expect(resolveTheme('auto', new Date(2026, 9, 31, 23, 59))).toBe(
      'halloween',
    )
  })

  test('auto is standard for the rest of the year', () => {
    expect(resolveTheme('auto', new Date(2026, 8, 30, 23, 59))).toBe('standard')
    expect(resolveTheme('auto', new Date(2026, 10, 1))).toBe('standard')
    expect(resolveTheme('auto', new Date(2026, 5, 15))).toBe('standard')
  })

  test('a pinned theme ignores the calendar', () => {
    expect(resolveTheme('standard', new Date(2026, 9, 31))).toBe('standard')
    expect(resolveTheme('halloween', new Date(2026, 5, 15))).toBe('halloween')
  })
})
