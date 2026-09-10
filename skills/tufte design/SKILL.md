---
name: tufte-viz
description: |
  Ideate and critique data visualizations using Edward Tufte's principles from "The Visual Display of Quantitative Information."   Use this skill when:
  (1) Designing new data visualizations or charts
  (2) Critiquing or refactoring existing visualizations
  (3) Reviewing dashboards or reports for graphical integrity
  (4) Deciding between visualization approaches
  (5) Reducing chartjunk or improving data-ink ratio
  (6) Planning small multiples or high-density displays
  Do not load this skill for tooltip copy, slider captions, or other chart-adjacent chrome.
  Applies principles: data-ink ratio, chartjunk elimination, graphical integrity, lie factor, small multiples, and data density.
---

# Tufte Visualization Ideation

Apply Edward Tufte's principles to design clear, honest, high-density data visualizations.

## Workflow

### For new visualizations:

1. **Clarify the data story**
   - What comparisons matter?
   - What's the key insight to communicate?
   - Who's the audience?

2. **Select approach** using Tufte principles:
   - High comparison need → Small multiples
   - Dense data → Consider data tables, sparklines
   - Time-series → Line charts with minimal grid
   - Part-to-whole → Avoid pie charts; prefer bar/table

3. **Design with data-ink in mind**
   - Start minimal, add only what's necessary
   - Every element must earn its ink
   - Default to grayscale; use color purposefully

4. **Apply the 7-question Tufte test** (below). Open `references__tufte-principles.md` and `references__analytical-design.md` only for a new dense display — not for chrome.

### For critiquing visualizations:

1. **Check graphical integrity**
   - Calculate lie factor if proportions seem off
   - Verify baselines and scales
   - Look for 3D distortion

2. **Identify chartjunk**
   - Decorative elements
   - Heavy grids
   - Unnecessary 3D effects
   - Moiré patterns

3. **Evaluate data-ink ratio**
   - What can be erased?
   - What's redundant?

4. **Suggest improvements** with specific before/after recommendations

## Key Principles Reference

- `references/tufte-principles.md` — core principles from *Visual Display of Quantitative Information*: lie factor, data-ink, chartjunk, small multiples, integrity.
- `references/analytical-design.md` — extensions from *Envisioning Information*, *Visual Explanations*, and *Beautiful Evidence*: the 6 principles of analytical design, sparklines, layering & separation, micro/macro, range-frames, causality, confections. Load when designing dashboards, dense displays, sparklines, or explanatory graphics.

## 7-question Tufte test (gate)

Do not ship a viz until it passes:

1. **Data-ink:** Can I erase any element without losing data? (Erase it.)
2. **Integrity:** Does the visual effect match the data effect? (Lie factor ≈ 1.)
3. **Chartjunk:** Does any element exist for decoration only? (Remove it.)
4. **Excellence:** Does the chart reveal data at multiple levels? (Macro + micro.)
5. **Comparison:** Can the reader easily compare elements? ("Compared to what?")
6. **Density:** Could the chart show more data in the same space? (Condense.)
7. **Context:** Labels, sources, scales, units present?

## Interactive chart standards

- **Hover tooltips** on every data element (rich tooltip, not a bare browser `title`), with at least three of: title, key-values, source, contextual note. Invisible hit target ≥ 12 px.
- **Bound-grounded sliders** on live simulators: each range input states what the lower bound, upper bound, and current value mean physically. Numeric-only sliders are forbidden.
- **Default to live simulator over static SVG** when the curve comes from an equation — expose parameters. Static charts are the exception.

Patterns that usually win: range-frame axes, single-hue sequential ramps (not rainbow for sequential data), dense tables over card grids when the unit of analysis repeats, legends that are data (strips/eyebrows) rather than boxed chrome.

**Quick checklist:**
- [ ] Lie Factor ≈ 1.0 (no visual distortion)
- [ ] Maximum data-ink ratio
- [ ] Zero chartjunk
- [ ] Clear labeling
- [ ] Answers "compared to what?"
- [ ] Shows causality or mechanism where relevant
- [ ] Multivariate (not over-reduced)
- [ ] Words, numbers, images integrated — not segregated
- [ ] Reveals multiple levels of detail (micro + macro)
- [ ] Layering: primary data dominates, secondary recedes
- [ ] Appropriate data density
