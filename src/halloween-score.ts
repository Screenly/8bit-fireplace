/**
 * The Halloween chiptunes, written as MIDI note numbers on a grid of
 * sixteenth notes. The player rotates between them so no single loop gets
 * on anyone's nerves.
 */

/**
 * - `arp`: thin pulse wave, short and plucky
 * - `bass`: triangle wave
 * - `lead`: reedy pulse wave with vibrato
 * - `pad`: thin pulse wave held for the full length, for an organ-like body
 * - `bell`: high triangle that rings out and decays, like a music box
 */
export type Voice = 'arp' | 'bass' | 'lead' | 'pad' | 'bell'

/** `[step, midi note, length in sixteenths, voice]` */
export type Note = readonly [number, number, number, Voice]

export interface Track {
  /** The value used for it in the `music` setting. */
  readonly id: string
  readonly name: string
  readonly bpm: number
  /** Loop length in sixteenth notes. */
  readonly steps: number
  readonly notes: readonly Note[]
  /** The lead sits out every other pass, so the loop breathes. */
  readonly leadEveryOther?: boolean
}

/** Repeats a voice's line, one entry per `every` sixteenths. */
function line(
  notes: readonly (number | null)[],
  every: number,
  length: number,
  voice: Voice,
): Note[] {
  return notes.flatMap((note, i) =>
    note === null ? [] : [[i * every, note, length, voice] as const],
  )
}

/** Notes given as `[midi, length]` back to back from a starting step. */
function phrase(
  start: number,
  notes: [number, number][],
  voice: Voice,
): Note[] {
  let step = start
  return notes.flatMap(([note, length]) => {
    const at = step
    step += length
    return note === 0 ? [] : [[at, note, length, voice] as const]
  })
}

/** A minor, Am F Dm E: arpeggios, a bass line, and a slow chromatic lead. */
const HAUNTED_HALL: Track = {
  id: 'haunted_hall',
  name: 'Haunted hall',
  bpm: 92,
  steps: 64,
  leadEveryOther: true,
  notes: [
    ...line(
      [
        [69, 72, 76, 72],
        [65, 69, 72, 69],
        [62, 65, 69, 65],
        [64, 68, 71, 68],
      ].flatMap((chord) => [...chord, ...chord, ...chord, ...chord]),
      1,
      1,
      'arp',
    ),
    ...line(
      [
        [45, 45, 52, 45, 45, 45, 52, 45],
        [41, 41, 48, 41, 41, 41, 48, 41],
        [38, 38, 45, 38, 38, 38, 45, 38],
        [40, 40, 47, 40, 44, 44, 47, 44],
      ].flat(),
      2,
      2,
      'bass',
    ),
    ...phrase(
      0,
      [
        [76, 6],
        [75, 2],
        [76, 8],
        [72, 6],
        [71, 2],
        [72, 8],
        [69, 6],
        [68, 2],
        [69, 8],
        [71, 4],
        [72, 4],
        [71, 4],
        [68, 4],
      ],
      'lead',
    ),
  ],
}

/**
 * D minor waltz, three beats to the bar: a bass note on one, chord stabs on
 * two and three, and a melody that wanders somewhere it should not.
 */
const GRAVEYARD_WALTZ: Track = {
  id: 'graveyard_waltz',
  name: 'Graveyard waltz',
  bpm: 138,
  steps: 96,
  leadEveryOther: true,
  notes: [
    // Root, then two stabs of the chord's upper notes, for each bar.
    ...(
      [
        [38, 65, 69],
        [38, 65, 69],
        [43, 70, 74],
        [38, 65, 69],
        [46, 62, 65],
        [43, 70, 74],
        [45, 61, 64],
        [45, 61, 67],
      ] as const
    ).flatMap(([root, a, b], bar): Note[] => {
      const at = bar * 12
      return [
        [at, root, 4, 'bass'],
        [at + 4, a, 2, 'arp'],
        [at + 4, b, 2, 'arp'],
        [at + 8, a, 2, 'arp'],
        [at + 8, b, 2, 'arp'],
      ]
    }),
    ...phrase(
      0,
      [
        [69, 4],
        [74, 4],
        [77, 4],
        [76, 8],
        [74, 4],
        [74, 4],
        [67, 4],
        [70, 4],
        [69, 12],
        [77, 4],
        [74, 4],
        [70, 4],
        [79, 4],
        [77, 4],
        [76, 4],
        [73, 4],
        [76, 4],
        [81, 4],
        [79, 4],
        [77, 4],
        [76, 4],
      ],
      'lead',
    ),
  ],
}

/**
 * Slow and quiet: a bass creeping down by semitones under a few music-box
 * notes. The calm one.
 */
const CREEPING: Track = {
  id: 'creeping',
  name: 'Creeping',
  bpm: 66,
  steps: 64,
  notes: [
    ...line([40, 39, 38, 37, 36, 35, 36, 35], 8, 8, 'bass'),
    ...(
      [
        [2, 83],
        [7, 79],
        [11, 76],
        [18, 83],
        [23, 82],
        [27, 78],
        [34, 84],
        [39, 83],
        [43, 79],
        [50, 78],
        [55, 75],
        [59, 71],
      ] as const
    ).map(([at, note]): Note => [at, note, 4, 'bell']),
  ],
}

/**
 * The opening of Bach's Toccata and Fugue in D minor, in 8-bit: the famous
 * mordent and run, then the same an octave down, over a pedal D.
 */
const TOCCATA: Track = {
  id: 'toccata',
  name: 'Toccata',
  bpm: 76,
  steps: 64,
  notes: (() => {
    const motif = (octave: number): [number, number][] => [
      [81 + octave, 2],
      [79 + octave, 1],
      [81 + octave, 9],
      [0, 4],
      [79 + octave, 1],
      [77 + octave, 1],
      [76 + octave, 1],
      [74 + octave, 1],
      [73 + octave, 4],
      [74 + octave, 8],
    ]
    const melody = [...motif(0), ...motif(-12)]
    return [
      ...phrase(0, melody, 'lead'),
      // Doubled an octave down, held, for the body of an organ.
      ...phrase(
        0,
        melody.map(([note, length]) => [note === 0 ? 0 : note - 12, length]),
        'pad',
      ),
      [16, 38, 16, 'bass'],
      [48, 38, 16, 'bass'],
    ]
  })(),
}

export const TRACKS: readonly Track[] = [
  HAUNTED_HALL,
  GRAVEYARD_WALTZ,
  CREEPING,
  TOCCATA,
]

export function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}
