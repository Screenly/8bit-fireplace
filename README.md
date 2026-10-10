# 8bit Fireplace

A full-screen 8-bit fireplace for Screenly digital signage screens — a burning
pixel-art log pile with drifting embers and firelight moving across the
firebrick behind it.

There is deliberately no drawn surround, mantel or caption: the screen's own
bezel frames the hearth, so the TV itself becomes the mantelpiece.

![The fireplace at 1920x1080](screenshots/8bit-fireplace-1920x1080.webp)

## How it works

The whole picture is one small canvas — around 280x155 pixels — upscaled by a
whole number of device pixels and drawn with `image-rendering: pixelated`. That
keeps every chunky pixel exactly square from 480x800 up to 4096x2160, and means
the cost per frame barely changes with the display's resolution.

- **Flames** are the classic cellular "Doom fire": heat seeded along the top of
  the log pile, spreading one row up per tick with a little random loss. It runs
  at a fixed 30 ticks per second regardless of the display's refresh rate, and
  is pre-warmed at startup so a screen never shows a cold hearth.
- **Firelight** is palette animation, not per-pixel shading. Each static pixel
  stores a colour plus how exposed it is to the fire; lighting a frame is one
  lookup per pixel against a pre-baked table. The band edges are dithered with
  an ordered 4x4 matrix so the light does not read as concentric rings.
- **Colours** come from a 16-colour scene palette and a 15-step flame ramp.
- **The logs** are composited _over_ the flames, so the fire licks up between
  them, and they are deliberately lit less than the brickwork — a pile lit to
  the same degree turns into pale sandstone rather than firewood.

The brickwork is generated from a seed derived from the screen's hostname, so
each screen gets its own firebox but always looks the same after a restart.

## Configuration

| Setting        | Description                                                     | Required | Default   |
| -------------- | --------------------------------------------------------------- | -------- | --------- |
| `crt_effect`   | Overlay CRT-style scanlines                                     | No       | `false`   |
| `flame_color`  | `classic`, `azure`, `emerald` or `violet`                       | No       | `classic` |
| `flame_height` | `low`, `medium` or `high`                                       | No       | `medium`  |
| `pixel_size`   | `chunky`, `classic` or `fine`                                   | No       | `classic` |
| `scene`        | `hearth` for the log fire, `inferno` for a full screen of flame | No       | `hearth`  |
| `sentry_dsn`   | Sentry DSN for error reporting; leave empty to disable          | No       | _(empty)_ |
| `theme`        | `auto`, `standard` or `halloween`                               | No       | `auto`    |

With `theme` on `auto` the fireplace dresses up for Halloween through the
whole of October, by the player's local clock, and goes back to standard on
1 November. The app checks the date once a minute, so a screen that runs for
weeks without a reload still changes over. The Halloween theme adds three jack-o'-lanterns with candle-lit faces on the
hearth, cobwebs in the top corners, spiders on silk, bats and the odd ghost.
Every so often a big skeleton walks in, grabs a pumpkin and runs off with it,
and another turns up a few seconds later with a different one and puts it down
somewhere new. Small skeletons scurry past on their own timer: about a third
of them pinch a pumpkin too, and the rest have an even chance of being
snatched by a big spider that drops from the top and hauls them away. The
dangling spiders take turns, climbing off and being replaced by new ones. The
pumpkin designs and the webs are rearranged on every load (the
brickwork still comes from the hostname, so the room itself stays the same),
and the critters come in random sizes. Everything is lit by the fire the same
way as the brickwork. The inferno scene has no hearth, so it gets the webs and
critters, and the skeletons only stroll past.

An unrecognised value falls back to its default rather than blanking the screen.

The app deliberately ignores the workspace's branding colours: the palette is
fixed, and recolouring it would break the period look. Use `flame_color` to
change the mood instead.

## Use of `@screenly/edge-apps`

Settings, metadata, the ready signal, error handling, Sentry reporting, the
base reset and design tokens, the shared ESLint/Vite/Playwright tooling and the
screenshot and mock helpers all come from the library.

Two things are deliberately not used:

- **`<auto-scaler>` / `initEdgeApp()`** scale a fixed 1920x1080 reference box
  with a fractional CSS transform and letterbox whatever does not fit. That is
  right for a layout-based app and wrong for this one: it resamples the pixel
  art and leaves dead bars. Measured on a real player frame, the app's own
  integer upscale keeps 100% of pixel blocks a single flat colour, whereas the
  same frame through `<auto-scaler>` is 54% impure at 800x480 and loses 44% of
  a 1080x1920 screen to letterboxing. The app sizes its own canvas instead.
- **`base/fonts.css`** (via the `@screenly/edge-apps/styles` barrel) inlines
  ~450 kB of base64 Inter. This app renders no HTML text, so it imports the
  reset and tokens directly and ships 0.9 kB of CSS.

## Getting Started

Install dependencies:

```bash
bun install
```

## Development

```bash
bun run dev
```

## Testing

```bash
bun run test
bun run lint
```

## Build

```bash
bun run build
```

## Screenshots

```bash
bun run screenshots
```

## Deployment

```bash
screenly edge-app create --name 8bit-fireplace --in-place
bun run deploy
screenly edge-app instance create
```

Stage and production share a single `screenly.yml` with no `id`. The Edge App ID
for each environment is supplied by GitHub:

| Source                                       | Used when                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `EDGE_APP_ID` environment secret             | Set on the `stage` or `production` GitHub Environment (takes precedence) |
| `STAGE_EDGE_APP_ID` repository variable      | Fallback for stage                                                       |
| `PRODUCTION_EDGE_APP_ID` repository variable | Fallback for production                                                  |

Run **Initialize Edge App** against stage or production to create the app, then
store the printed id in the matching variable (or environment secret). **Update
Edge App** deploys on push to `development` (stage) and `master` (production),
and can also be run by hand against stage.
