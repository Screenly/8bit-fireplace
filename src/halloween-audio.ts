/**
 * 8-bit background music for the Halloween theme, synthesised live with the
 * Web Audio API, so there are no audio files to ship.
 *
 * On shuffle it rotates between the tunes in `halloween-score`: each plays
 * for about {@link PLAY_SECONDS}, then a few seconds of silence, then a
 * different one, so no single loop wears on anyone. Given one tune, it just
 * loops that.
 *
 * Players differ on whether audio may start without a user gesture. If the
 * context comes up suspended it is resumed on the first click or key press.
 */
import {
  hz,
  TRACKS,
  type Note,
  type Track,
  type Voice,
} from './halloween-score'

/** How far ahead notes are scheduled, in seconds. */
const LOOKAHEAD = 0.3
const SCHEDULER_MS = 50
/** Roughly how long each tune plays before moving on, in seconds. */
const PLAY_SECONDS = 50
/** Silence between tunes, in seconds. */
const GAP_SECONDS: [number, number] = [3, 6]

/** A pulse wave of the given duty cycle, the classic 8-bit timbre. */
function pulseWave(context: BaseAudioContext, duty: number): PeriodicWave {
  const harmonics = 64
  const real = new Float32Array(harmonics)
  const imag = new Float32Array(harmonics)
  for (let n = 1; n < harmonics; n++) {
    real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  }
  return context.createPeriodicWave(real, imag)
}

interface VoiceSound {
  wave: 'thin' | 'reedy' | OscillatorType
  volume: number
  /** Fraction of the written length that sounds; the rest is a gap. */
  gate: number
  vibrato?: number
  /** Rings out and decays over this many seconds instead of holding. */
  ring?: number
}

const VOICES: Record<Voice, VoiceSound> = {
  arp: { wave: 'thin', volume: 0.05, gate: 0.6 },
  bass: { wave: 'triangle', volume: 0.22, gate: 0.7 },
  lead: { wave: 'reedy', volume: 0.07, gate: 0.95, vibrato: 18 },
  pad: { wave: 'thin', volume: 0.08, gate: 0.95 },
  bell: { wave: 'triangle', volume: 0.14, gate: 1, ring: 0.9 },
}

export class HalloweenAudio {
  private readonly context: AudioContext | OfflineAudioContext
  private readonly music: GainNode
  private readonly waves: Record<'thin' | 'reedy', PeriodicWave>
  private timer: ReturnType<typeof setInterval> | undefined
  private nextTime = 0
  private track: Track = TRACKS[0]
  /** The track's notes grouped by the step they start on. */
  private byStep: Note[][] = []
  private step = 0
  private loop = 0
  private loops = 1
  /** The one tune to loop, or `null` to shuffle. */
  private readonly only: Track | null

  /**
   * `track` is a tune's id, or `shuffle`. `context` can be an offline one, to
   * render the music for checking.
   */
  constructor(track = 'shuffle', context?: AudioContext | OfflineAudioContext) {
    this.only = TRACKS.find((t) => t.id === track) ?? null
    this.context = context ?? new AudioContext()
    this.music = this.context.createGain()
    this.music.gain.value = 0.3
    this.music.connect(this.context.destination)
    this.waves = {
      thin: pulseWave(this.context, 0.125),
      reedy: pulseWave(this.context, 0.25),
    }
    this.resumeOnGesture()
  }

  /** Starts the music. Calling it again is harmless. */
  start(): void {
    if (this.timer !== undefined) return
    this.nextTime = this.context.currentTime + 0.1
    this.cue(this.only ?? TRACKS[Math.floor(Math.random() * TRACKS.length)])
    this.timer = setInterval(() => this.schedule(), SCHEDULER_MS)
  }

  stop(): void {
    if (this.timer === undefined) return
    clearInterval(this.timer)
    this.timer = undefined
  }

  /** Lines up a tune to play from the top for about `PLAY_SECONDS`. */
  private cue(track: Track): void {
    this.track = track
    this.byStep = Array.from({ length: track.steps }, () => [])
    for (const note of track.notes) this.byStep[note[0]].push(note)
    this.step = 0
    this.loop = 0
    const loopSeconds = track.steps * this.sixteenth()
    this.loops = this.only
      ? Infinity
      : Math.max(2, Math.round(PLAY_SECONDS / loopSeconds))
  }

  private sixteenth(): number {
    return 60 / this.track.bpm / 4
  }

  private schedule(): void {
    const now = this.context.currentTime
    // After a long stall (a backgrounded tab), skip ahead rather than
    // firing a burst of stale notes.
    if (this.nextTime < now - 1) this.nextTime = now + 0.05
    while (this.nextTime < now + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime)
      this.nextTime += this.sixteenth()
      if (++this.step < this.track.steps) continue
      this.step = 0
      if (++this.loop < this.loops) continue
      // Done with this one: a breather, then something different.
      const [min, max] = GAP_SECONDS
      this.nextTime += min + Math.random() * (max - min)
      const others = TRACKS.filter((t) => t !== this.track)
      this.cue(others[Math.floor(Math.random() * others.length)])
    }
  }

  private playStep(step: number, time: number): void {
    const sixteenth = this.sixteenth()
    const restLead = this.track.leadEveryOther && this.loop % 2 === 1
    for (const [, note, length, voice] of this.byStep[step]) {
      if (voice === 'lead' && restLead) continue
      this.tone(VOICES[voice], hz(note), time, length * sixteenth)
    }
  }

  private tone(
    sound: VoiceSound,
    freq: number,
    start: number,
    length: number,
  ): void {
    const { context } = this
    const osc = context.createOscillator()
    if (sound.wave === 'thin' || sound.wave === 'reedy') {
      osc.setPeriodicWave(this.waves[sound.wave])
    } else {
      osc.type = sound.wave
    }
    osc.frequency.value = freq

    const gain = context.createGain()
    const { volume } = sound
    const end = start + (sound.ring ?? length * sound.gate)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + 0.008)
    if (sound.ring) {
      gain.gain.exponentialRampToValueAtTime(0.001, end)
    } else {
      gain.gain.setValueAtTime(volume, Math.max(start + 0.01, end - 0.03))
      gain.gain.linearRampToValueAtTime(0, end)
    }
    osc.connect(gain).connect(this.music)

    if (sound.vibrato) {
      const lfo = context.createOscillator()
      const depth = context.createGain()
      lfo.frequency.value = 6
      depth.gain.value = sound.vibrato
      lfo.connect(depth).connect(osc.detune)
      lfo.start(start)
      lfo.stop(end)
    }
    osc.start(start)
    osc.stop(end + 0.01)
  }

  private resumeOnGesture(): void {
    if (this.context.state !== 'suspended') return
    const resume = () => {
      void this.context.resume()
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)
  }
}
