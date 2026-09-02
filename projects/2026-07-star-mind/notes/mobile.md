# Mobile + desktop dual support

STAR MIND ships as **one build / one URL**. Desktop keyboard and mobile touch are both first-class; do not fork the game into separate apps.

Live: https://tuchel.github.io/tuchel-general/star-mind/

## Detection

`src/platform.ts` classifies the session:

| Signal | Role |
|--------|------|
| `(pointer: coarse)` + touch points | Phone / tablet primary |
| `(hover: none)` + touch | Touch laptop / iPad |
| `max-width: 920px` + touch | Narrow touch viewport |
| `isIOS()` | Hide Fullscreen (Safari has no reliable FS API) |

`body` gets `is-touch` / `is-desktop` / `is-ios`. Keyboard input always works even on touch devices (Bluetooth keyboards, DevTools).

## Control map

| Action | Desktop | Mobile |
|--------|---------|--------|
| Strafe X / depth Z | A/D · W/S (arrows) | Left virtual stick |
| Fire | Hold J / Z | Hold **FIRE** |
| Jump / thrust | Space (hold in orbit) | **JUMP** |
| EMP | K / X | **EMP** (tap) |
| Swap weapon | L / Shift | **SWAP** (tap) |
| Pause | P / Esc | **II** |
| Menu select | W/S | ▲ / ▼ |
| Confirm | Enter / Space / J | **OK** |
| Back / title | Escape | **TITLE** (when shown) |
| Full screen | F / button | N/A on iOS; use Add to Home Screen |

## Layout

- **Landscape (preferred):** canvas fills the viewport; stick left, action buttons right as a fixed 2×2 grid (SWAP EMP / JUMP FIRE, pause above), semi-transparent over the playfield edges. The grid never wraps, so FIRE cannot fall off a short phone screen.
- **Portrait:** canvas capped ~52dvh on top; `#touch-layer` reparents into `#app` as a bottom control sheet (`touch-sheet` class). Soft “ROTATE DEVICE” hint stays on.

Safe-area insets (`viewport-fit=cover`) pad notch / home indicator.

## Zoom / graphics

Logical canvas stays **960×540**. On touch-primary, `mobileZoomFactor()` (≈1.14) multiplies stage `nearScale` / `farScale` in `Game.withMobileZoom()` so sprites stay readable at arm’s length without changing world math. Revisit the factor if art packs change — do not introduce a second resolution pipeline.

CSS uses `image-rendering: auto` (smooth upscale of hand-authored frames). Avoid `pixelated` unless the art pack goes strictly nearest-neighbor.

## Code ownership (do not regress)

| File | Owns |
|------|------|
| `platform.ts` | Detection + zoom factor + body classes |
| `input.ts` | Unified query API (`axisX/Z`, `shoot`, `jumpJust`, `confirm`, `back`, `menuNav`) — keyboard + touch backends |
| `touch-controls.ts` | DOM overlay only; never reads game mode directly except via `main.ts` |
| `main.ts` | Mounts overlay when touch-primary; syncs mode / orientation / visualViewport |
| `style.css` | Desktop chrome + touch chrome; gate touch rules under `body.is-touch` |
| `game.ts` | Gameplay + `uiMode()` / `showTouchBack()` / `showTouchNav()`; no DOM pointer handlers |

When adding a new action: extend `Input` first, wire keyboard + touch, then call sites. Never branch gameplay on `isTouchPrimary()` except for **copy/hints** and zoom.

## Smoke checklist (before merge touching controls)

1. Desktop: keyboard play L1, full screen toggle, title → briefing → play.
2. Touch DevTools (or phone): title ▲▼ / OK, briefing OK, stick + FIRE + JUMP + EMP + II pause.
3. Portrait sheet + landscape overlay both respond; rotate mid-run.
4. Dead: OK retries, TITLE returns; victory OK → title. Pause: OK resumes, TITLE quits.
5. No page scroll / rubber-band / double-tap zoom while interacting.
6. Canvas art: no clipped HUD, no stick knob “jump” on first touch, controls don’t cover critical center of play in landscape.
