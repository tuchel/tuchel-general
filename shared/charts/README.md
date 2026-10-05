# Chart kit

D3 math, React SVG marks, and a motion layer for the apps in this repo. A figure lays out at its container's real width, so type renders at its set size. Marks keep their identity across states, so a scenario change moves bars, slides axes, and counts numbers instead of redrawing. Every figure is keyboard-reachable and carries its numbers.

Apps import `src/` directly. D3 is vendored as one file (`vendor/d3.js`) and React comes from the app, so an app installs nothing extra. `package.json` here holds authoring tools only (checks, preview, capture, tests).

There is no standalone SVG export. Figures live in the apps.

## Use it in an app

1. **Vite.** Resolve React from the app, not from the kit, or the build either fails (no kit `node_modules`, as in the Pages deploy) or ships two Reacts:
   ```ts
   // vite.config.ts
   export default defineConfig({ plugins: [react()], resolve: { dedupe: ['react', 'react-dom'] } });
   ```
2. **Styles and face.** Import the kit's CSS and the chart face's CSS once, and set the face before the first render. The face's `.woff2` files are the ones its metrics come from, so measured and drawn text agree.
   ```ts
   import '../../../../shared/charts/charts.css';
   import '../../../../shared/charts/fonts/inter.css';
   import { setChartFace } from '../../../../shared/charts/src/index.ts';
   import { INTER } from '../../../../shared/charts/src/fonts/inter.generated.ts';
   setChartFace(INTER);
   ```
   An app whose body sans is not Inter adds its face (see Maintenance) and charts in that face.
3. **Palette.** Map the roles onto the app's palette by overriding `--chart-*` on `:root` in the app's CSS (`--chart-ground`, `--chart-ink`, `--chart-series-1`, …). Check the categorical set for colorblind separation against the app's ground before shipping; the defaults are the dataviz reference palette, which passes in this order.
4. **Registry.** List the app's figures in `src/figures.tsx`, so `npm run check` (and CI) gates them:
   ```ts
   export const figures = { 'tax-scatter': { component: TaxScatter, states: [{ metric: 'share' }] } };
   ```
   `states` are extra props (a scenario, a slider extreme) to check besides the default.

## A figure

```tsx
import { AxisY, Bars, Figure, c, d3, type RenderMode } from '../../../../shared/charts/src/index.ts';

export function CostFigure({ mode }: { mode?: RenderMode }) {
  return (
    <Figure id="cost" mode={mode} height={280}
      headline={['Unit 8 costs ', { value: 73, format: (v) => `$${Math.round(v)}` }, ' against $100 for unit 1']}
      dek="Unit cost by build number, dollars per unit."
      takeaways={{ look: '…', learn: '…', scrutinize: '…' }}
      label="Bar chart of unit cost for builds 1 through 8."
      data={{ columns: ['Unit', 'Cost ($)'], rows: [[1, 100], [8, 73]] }}>
      {({ width, height }) => { /* scales from d3, then <Bars>, <Line>, <Texts>, <AxisX> … */ }}
    </Figure>
  );
}
```

- **Marks.** `Bars`, `Dots`, `Texts`, `Rules`, `Line`, `AxisX`, `AxisY`. A mark's `id` is its identity across states. Give a mark `label` (and `tip`) to make it focusable, and `keys` so emphasis lights it with others.
- **Measurement.** `measure()` and `wrap()` use advances and kerning generated from the face's `.woff2` files, within 0.5% of shaped width. Size margins from the widest measured label; wrap row labels; switch layouts below a width.
- **Placement.** `src/placement.ts` places dense or data-driven label sets (1-D lanes, series ends, 2-D callouts with `seats` around a mark) and checks them (`laneIntegrity`, `planarIntegrity`, `overflowIntegrity`, `sharedScaleIntegrity`, `sequentialRampIntegrity`).
- **Options.** `instrument` marks a tool panel (no takeaways required). `hero` enlarges a page's lead headline. `breakout` widens a figure symmetrically up to 960 px. `tipPlacement="below"` centers the tooltip under the mark. `pinned` holds a mark active. `overlay` replaces the tooltip with any HTML.
- **Data first.** Headlines and takeaways are template strings over the data, and the component asserts the claim its sentence makes, so a data change fails the render instead of leaving a stale sentence.

## Rules

- **Size.** Lay out at the container's width; never draw wide and let the image shrink. Nothing under 11 px as rendered.
- **Edges.** A figure's headline, key, plot, and note start where the body text starts. `breakout` is the one exception. At most one `hero` per page.
- **A figure states its finding.** Sentence-case headline with numbers and units; a dek with the measure, units, and scale (name log scales).
- **Takeaways** on every explanatory figure: *Look at* names the one mark or comparison to find first; *Learn* states what it shows and the condition it holds on; *Scrutinize* names the assumption or number that deserves the most doubt. One sentence each, at most 34 words, every number computed from the data, no verdicts. Tool panels set `instrument` instead.
- **Axes.** 1 px, muted; major hairline gridlines only; nice-number ticks, four to six labels; y from zero for magnitudes (truncate only ratios or time series, with a break mark). One baseline per scale.
- **Labels.** Direct labels beat a legend; a key sits above the plot, never over data. Print values only on the marks that carry the argument; the tooltip and numbers table carry the rest. Type never shares ink at rest (default, every scenario, slider extremes). Type crossing a line carries a halo in the ground color (inside a bar, the bar's color). A label that cannot seat is omitted.
- **Color.** Tokens only (`c('series1')`), never hex in figure code. One series in ink; one accent for the argument; at most five categorical families, and only the first three in a scatter or map; a status color for a threshold under test; sequential variables on one hue.
- **Motion** shows a change of state or draws the eye to one. Nothing bounces, springs, loops, or autoplays. Identity is kept; changing numbers count; reduced motion zeroes every duration; print lands every figure on its final frame.
- **Interaction.** Hover or focus dims everything not sharing the mark's keys and opens a tooltip with a title, raw values, and derived context, never covering the active mark's own labels. Keyboard and screen-reader parity. Figures with more than a handful of values carry the numbers table. Scenario controls are `Segmented` radio groups.
- **Uncertainty** is shown (bands, error bars) and the interval is named.
- **Small multiples** share one axis range.
- **Formats.** SVG up to about 5,000 marks; above that, Canvas or WebGL with axes and labels in SVG on top.
- **Done** means `npm run check` passes, the placement checks are empty at every resting state, headless shots at 1280, 768, and 390 px show every label readable, and the reveal, each state change, hover, keyboard, and reduced motion have been exercised in a headless browser.

## Motion

Durations and curves are tokens (`MOTION` in `src/tokens.ts`, `--motion-*` in `charts.css`; the tests keep them equal):

| Token | Duration | Used for |
|---|---|---|
| `fast` | 140 ms | hover and focus emphasis, pressed states |
| `base` | 240 ms | tooltips, toggles, exits |
| `slow` | 420 ms | scenario changes: bars, lines, axes, labels, path morphs |
| `reveal` | 640 ms, 36 ms stagger capped at 360 ms | a figure's one-time entrance |
| `crossfade` | 320 ms | one view replacing another |

- **Reveal.** A figure below the fold parks at its enter state and plays once when it scrolls in. A figure already on screen never replays.
- **State changes.** Every mark tweens from where it is, so an interrupted change retargets smoothly. Axes slide surviving ticks and bring new ones in from the old scale; ticks are keyed by unit and value, so a `$40` tick never morphs into `40%`. `Line` resamples both states to one point count and morphs. Resizes are instant.
- **Tickers.** Headline parts `{ value, format }` and `Texts` items with `value` count between states. Screen readers get the final value.
- **Crossfade.** `<Crossfade view={key}>` swaps views.

## Accessibility

The plot is one tab stop; the arrow keys, Home, and End move between marks, and Escape leaves. Each mark is a labeled image; focus and hover share one emphasis and tooltip. `Segmented` is a radio group with arrow keys and 44 px targets on coarse pointers.

## Checks

```sh
cd shared/charts && npm ci     # once
npm test                       # kit tests: measurement, tokens, motion, placement, the gate itself
npm run check                  # the gate, for the sampler and every tracked src/figures.tsx
npm run typecheck
node bin/preview.mjs examples/registry.tsx --out /tmp/preview
node bin/capture.mjs /tmp/preview/kit-sampler.html out.png [--dark] [--reduced] [--width 390] [--hover '<sel>'] [--focus-tab 2]
```

`check-figures` renders each figure in memory at 358, 640, and 1100 px in every listed state and fails on label overlaps at rest, text under 11 px, or a missing takeaway. CI runs the tests and the gate on every pull request that touches the kit or a figures registry.

## Maintenance

- **Add a face.** Put its `.woff2` files and a `.css` with matching `@font-face` rules in `fonts/` (with the font's license), add an entry to `FACES` in `bin/build-metrics.mjs`, and run `npm run metrics`. It writes `src/fonts/<id>.generated.ts`.
- `npm run vendor` rebuilds `vendor/d3.js` (d3-array 3.2.4, d3-format 3.1.0, d3-interpolate 3.0.1, d3-scale 4.0.2, d3-shape 3.2.0).
- Inter is © The Inter Project Authors, under the SIL Open Font License (`fonts/Inter-OFL.txt`). D3 is © Mike Bostock, ISC License.
