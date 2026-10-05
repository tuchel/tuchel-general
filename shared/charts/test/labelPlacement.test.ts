import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateMonoWidth,
  laneIntegrity,
  lanesUsed,
  placeLinearLabels,
  type LabelItem,
} from '../src/layout/labelPlacement.ts';

function item(
  id: string,
  position: number,
  text: string,
  priority: number,
  extra: Partial<LabelItem> = {},
): LabelItem {
  return {
    id,
    position,
    text,
    width: estimateMonoWidth(text, 8.5),
    priority,
    ...extra,
  };
}

describe('estimateMonoWidth', () => {
  it('scales with glyph count and font size', () => {
    assert.equal(estimateMonoWidth('', 8.5), 0);
    assert.ok(estimateMonoWidth('quote $121', 8.5) > 40);
    assert.ok(estimateMonoWidth('aaaa', 16) > estimateMonoWidth('aa', 16));
    assert.ok(estimateMonoWidth('abc', 12) > estimateMonoWidth('abc', 8));
  });
});

describe('placeLinearLabels', () => {
  it('keeps far-apart captions on lane 0', () => {
    const placed = placeLinearLabels([
      item('a', 100, 'left', 1),
      item('b', 400, 'right', 1),
    ], { bounds: [0, 800] });
    const visible = placed.filter((p) => !p.hidden);
    assert.equal(visible.length, 2);
    assert.equal(lanesUsed(placed), 1);
    assert.deepEqual(laneIntegrity(placed, 6), []);
  });

  it('merges mergeable marks whose anchors sit inside mergeDistance', () => {
    // Two references a dollar apart ($120 and $121) on a $0–$850 plot: a dollar
    // is under 1 px there, so one baseline would print the two captions on top
    // of each other.
    const plotW = 682;
    const x = (v: number) => 168 + (v / 850) * plotW;
    const placed = placeLinearLabels([
      item('list', x(120) + 3, 'list $120.00', 4, { mergeable: true }),
      item('quote', x(121) + 3, 'quote $121', 3, { mergeable: true }),
      item('week1', x(150.95) + 3, 'week-1 $150.95', 2, { mergeable: true }),
      item('median', x(210) + 3, 'median $210', 1, { mergeable: true }),
    ], { bounds: [168, 874], maxLanes: 3, minGap: 8, mergeDistance: 14 });

    const visible = placed.filter((p) => !p.hidden);
    const list = visible.find((p) => p.id === 'list');
    const quote = placed.find((p) => p.id === 'quote');
    assert.ok(list);
    assert.ok(list.text.includes('list $120.00'));
    assert.ok(list.text.includes('quote $121'));
    assert.ok(quote?.hidden);
    assert.ok(list.mergedIds.includes('quote'));
    assert.ok(visible.some((p) => p.id === 'week1'));
    assert.ok(visible.some((p) => p.id === 'median'));
    assert.deepEqual(laneIntegrity(placed, 8), []);
  });

  it('staggers distinct-but-wide captions onto a second lane', () => {
    const placed = placeLinearLabels([
      item('a', 200, 'a long left-hand caption', 2, { mergeable: false }),
      item('b', 260, 'a long right-hand caption', 1, { mergeable: false }),
    ], { bounds: [0, 800], maxLanes: 2, minGap: 6, mergeDistance: 14 });

    const visible = placed.filter((p) => !p.hidden);
    assert.equal(visible.length, 2);
    assert.equal(lanesUsed(placed), 2);
    const lanes = new Set(visible.map((p) => p.lane));
    assert.equal(lanes.size, 2);
    assert.deepEqual(laneIntegrity(placed, 6), []);
  });

  it('hides the lower-priority leftover when lanes are exhausted', () => {
    const placed = placeLinearLabels([
      item('keep', 200, 'priority caption that owns the lane', 3, { mergeable: false }),
      item('mid', 230, 'second caption also wide enough to collide', 2, { mergeable: false }),
      item('drop', 250, 'third caption with no lane left', 1, { mergeable: false }),
    ], { bounds: [0, 800], maxLanes: 2, minGap: 6 });

    const drop = placed.find((p) => p.id === 'drop');
    assert.ok(drop?.hidden);
    assert.ok(placed.filter((p) => !p.hidden).length >= 2);
    assert.deepEqual(laneIntegrity(placed, 6), []);
  });

  it('clamps a start-anchored caption that would run past the right bound', () => {
    const placed = placeLinearLabels([
      item('edge', 760, 'a caption that is too long for the remaining plot', 1),
    ], { bounds: [0, 800] });
    const edge = placed.find((p) => p.id === 'edge');
    assert.ok(edge);
    assert.equal(edge.hidden, false);
    assert.ok(edge.position + edge.width <= 800 + 1e-6);
    assert.deepEqual(laneIntegrity(placed), []);
  });

  it('returns an empty list for no items', () => {
    assert.deepEqual(placeLinearLabels([], { bounds: [0, 100] }), []);
    assert.equal(lanesUsed([]), 0);
  });

  it('keeps overlay dates from stacking when two marks sit on one row', () => {
    const placed = placeLinearLabels([
      item('latest', 400, '8/21', 2, { mergeable: false, anchor: 'middle' }),
      item('prior', 408, '8/5', 1, { mergeable: false, anchor: 'middle' }),
    ], { bounds: [168, 850], maxLanes: 2, minGap: 4 });

    const visible = placed.filter((p) => !p.hidden);
    assert.ok(visible.length >= 1);
    if (visible.length === 2) {
      assert.equal(lanesUsed(placed), 2);
    }
    assert.deepEqual(laneIntegrity(placed, 4), []);
  });
});
