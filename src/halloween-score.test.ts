import { describe, expect, test } from 'bun:test'
import { TRACKS } from './halloween-score'

describe('Halloween tunes', () => {
  test('there are several to rotate between', () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(TRACKS.map((t) => t.name)).size).toBe(TRACKS.length)
  })

  for (const track of TRACKS) {
    test(`${track.name} fits inside its loop`, () => {
      expect(track.notes.length).toBeGreaterThan(0)
      for (const [step, note, length] of track.notes) {
        expect(step).toBeGreaterThanOrEqual(0)
        expect(step + length).toBeLessThanOrEqual(track.steps)
        expect(length).toBeGreaterThan(0)
        // Somewhere between a low bass and a high bell.
        expect(note).toBeGreaterThanOrEqual(24)
        expect(note).toBeLessThanOrEqual(96)
      }
    })
  }
})
