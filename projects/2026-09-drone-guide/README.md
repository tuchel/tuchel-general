# How a Drone Flies

An interactive 3D guide to quadcopters for a 10-year-old who likes robots. Part 1 explains how a drone flies. Part 2 walks through building one.

**Status:** built; Pages path `/drone/` after merge — https://tuchel.github.io/tuchel-general/drone/

## What is on the page

A 3D drone in a sunny low-poly park (Three.js) changes for each chapter as you scroll. Each chapter pairs one idea with one control:

| Chapter | Idea | Control |
| --- | --- | --- |
| Meet the quadcopter | Eight parts, one job each | Exploded model; tap a part |
| Push air down, go up | Thrust vs. gravity; hover at 50% | Power slider |
| The propeller's secret | Tilted blades throw air down | Blade-tilt slider |
| The twist problem | Opposite-spinning pairs cancel twist | Make all four spin the same way |
| Steering | Pitch, roll, yaw from motor speed alone | Hold-to-fly buttons, keyboard |
| The brain | Feel → compare → fix, 4,000 times a second | Gust button; brain on/off |
| Follow the power | Energy vs. messages; how a motor spins | Step-through flow; coil animation |
| Fly it yourself | Mode 2 sticks | Virtual sticks |
| Three levels | Simulator → kit → custom build | — |
| What you need | Parts, tools, LiPo and soldering safety | Labeled exploded model |
| Build it | Eight assembly steps, props last | Stepper; parts drop into place |
| Test before you fly | Bind, arm, failsafe, motor direction | Find the backwards motor |
| Your first flight | Checklist and drills | Fly through three rings |
| Rules of the sky | FAA recreational rules, glossary | — |

## Layout

- **Desktop and tablets held sideways:** story on the left, 3D view on the right.
- **Phones and tablets held upright:** 3D view pinned to the top, story scrolling below it. Vertical swipes on the 3D view scroll the page; sideways swipes turn the view.
- **Phones held sideways:** side by side, like desktop.
- The **Chapters** button opens a menu of all 14 chapters; on phones it slides up from the bottom.
- The flying chapters put two thumb sticks right on the 3D view.

The motor-power map in the corner of the 3D panel reads straight from the toy physics model (`web/src/sim.ts`). Every motion comes from the four motor powers through the same mixer real flight controllers use. Its numbers are tuned to look right, not to match a specific aircraft.

## Run

```sh
cd web
npm install
npm run dev
```

`npm run build` type-checks and writes `web/dist/`.

## Notes

- `notes/prior-art.md` — what already exists and where this differs
- `notes/sources.md` — sources for every factual claim on the page
