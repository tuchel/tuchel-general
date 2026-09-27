# How a Drone Flies

An interactive 3D guide to quadcopters for a 10-year-old who likes robots. Part 1 explains how a drone flies. Part 2 walks through building one.

**Status:** live at https://tuchel.github.io/tuchel-general/drone/

## What is on the page

The 3D park fills the whole screen. Text floats on top in a frosted-glass panel: on the left on wide screens, and as a bottom sheet on phones held upright. Each chapter is a few short steps, one idea per screen; Next, Back, the arrow keys, or a sideways swipe on the panel move between them. The camera frames the drone in whatever part of the screen the panel leaves open.

| Chapter | Steps |
| --- | --- |
| Meet the quadcopter | One part per step, each doing its job with the rest faded to glass: the frame's lights, the motor's copper coils firing inside a see-through bell, props pushing air, energy leaving the battery, the speed controllers feeding each motor, the flight controller's sensor arrows as the drone rocks, radio waves reaching the receiver, and the camera's live view. Then all eight parts with callout labels. |
| Going up | Newton's third law; a power slider with thrust vs. gravity; a hover at 50% |
| The propeller's secret | Hand out a car window; a blade-tilt slider; reading a 5×4 prop |
| The twist problem | The swivel-chair test; all props the same way; the tail rotor |
| Steering | Pitch, roll, yaw; hold-to-fly buttons; tip the push |
| The brain | The broom; feel, compare, fix; gusts with the brain on and off |
| Follow the power | Battery, speed controllers, motors, receiver, flight controller, one per step |
| Take the controls | Mode 2 thumb sticks on the 3D view |
| Where to start | Three levels, one per step |
| What you need | Parts and tools; safety |
| Assembly | Eight steps; each part drops into place |
| Setup | The setup app; three settings; find the backwards motor |
| Takeoff | A ring course with the drone's camera view inset; checklist; drills |
| The rules | FAA rules; drone words; the end |

## The drone model

Modelled in code (`web/src/hardware.ts`, textures in `web/src/textures.ts`) on a typical 5-inch freestyle build, about 100 mm to a scene unit: a carbon-fiber X-frame with plates, hex standoffs and camera side plates; 2207-size brushless motors with a stator, twelve copper windings on three phases, fourteen magnets and a windowed bell; twisted, swept tri-blade props; a 4-in-1 ESC with MOSFETs, a capacitor and an XT60 lead; a flight controller with its processor, gyro, USB-C port and connectors; a receiver in heat-shrink with a dipole antenna; an FPV camera with a coated lens; a LiPo pack with strap, balance lead and plug; and copper motor leads in sleeves. Reflections come from the park's own sky.

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
