/**
 * The jack-o'-lantern designs, drawn the same way as the other Halloween
 * sprites. The large ones are all the same width, as are the medium ones, so
 * a skeleton can swap one for another without the gap changing size.
 */
import { sprite } from './halloween-sprites'

export const PUMPKIN_LARGE = sprite([
  '.........ssg........',
  '.........ss.........',
  '.....kkkdd',
  '...kkoolod',
  '..koollodo',
  '.kolllodoo',
  '.kollYodoo',
  '.kolYYYdoo',
  'kolYYYYYdo',
  'kollodoodY',
  'kollodooYY',
  'kolYodoodo',
  'kolYYYoYYY',
  '.koYYYYYYY',
  '.kolYYYoYY',
  '..koolddoo',
  '...kkkkkkk',
])

export const PUMPKIN_MEDIUM = sprite([
  '.......sg.......',
  '.......ss.......',
  '...kkooddookk...',
  '..kolloddollok..',
  '.kollodoodollok.',
  'kolloYoddoYollok',
  'kolYYYoddoYYYlok',
  'kolloooYYooollok',
  'kollododdodollok',
  'kolYodoooodoYlok',
  'kolYYYYYYYYYYlok',
  '.kolYoYYYYoYlok.',
  '..kooldoodlook..',
  '...kkkkkkkkkk...',
])

/** Scowling, with slanted eyes and zigzag teeth. */
export const PUMPKIN_ANGRY = sprite([
  '.........ssg........',
  '.........ss.........',
  '.....kkkdd',
  '...kkoolod',
  '..koollodo',
  '.kolllodoo',
  '.kolYYodoo',
  '.kolYYYYoo',
  'kollodYYdo',
  'kollodoodo',
  'kollodoodY',
  'kolYodoodo',
  'kolYYYYYYY',
  '.koYoYoYoY',
  '.kolloYYYY',
  '..koolddoo',
  '...kkkkkkk',
])

/** One eye shut, and a wide grin. */
export const PUMPKIN_WINK = sprite([
  '.......sg.......',
  '.......ss.......',
  '...kkooddookk...',
  '..kolloddollok..',
  '.kollodoodollok.',
  'kolloYoddoooolok',
  'kolYYYoddoYYYlok',
  'kolloooddooollok',
  'kollododdodollok',
  'koYodoooooodoYok',
  'kolYYYYYYYYYYlok',
  '.kooYYYYYYYYook.',
  '..kooldoodlook..',
  '...kkkkkkkkkk...',
])

/** Round eyes and a gap-toothed grin. */
export const PUMPKIN_GRIN = sprite([
  '.........ssg........',
  '.........ss.........',
  '.....kkkdd',
  '...kkoolod',
  '..koollodo',
  '.kollYYdoo',
  '.kolYYYYoo',
  'kollYYYYdo',
  'kolllYYodo',
  'kollodoodo',
  'koYYodoodo',
  'kolYYYYYYY',
  'kolYoYYoYY',
  '.koYYYYYYY',
  '.kolYYoYYY',
  '..koolddoo',
  '...kkkkkkk',
])

/** A squat one nobody has carved yet. */
export const PUMPKIN_PLAIN = sprite([
  '.........ssg........',
  '.........ss.........',
  '....kkkkdd',
  '..kkoolldo',
  '.kolllodoo',
  'kolllodood',
  'kollodoodo',
  'kollodoodo',
  'kollodoodo',
  'koolodoodo',
  '.kooododdo',
  '..kkooddoo',
  '....kkkkkk',
])

/** Every pumpkin design, so a hearth can show a mix of them. */
export const PUMPKINS = [
  PUMPKIN_LARGE,
  PUMPKIN_ANGRY,
  PUMPKIN_GRIN,
  PUMPKIN_PLAIN,
  PUMPKIN_MEDIUM,
  PUMPKIN_WINK,
]
