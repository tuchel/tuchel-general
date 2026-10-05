import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateSansWidth,
  estimateTextWidth,
  overflowIntegrity,
  placePlanarLabels,
  planarIntegrity,
  seatsAroundMark,
} from '../src/layout/labelPlacement.ts';
import {
  layoutTufteProbe,
  probeIntegrityErrors,
} from '../src/layout/tufteProbe.ts';

describe('estimateSansWidth', () => {
  it('is narrower than mono for a string of i/l and wider for William', () => {
    const ill = estimateSansWidth('illicit', 12);
    const monoIll = estimateTextWidth('illicit', 12, 'mono');
    const william = estimateSansWidth('William', 12);
    const lllllll = estimateSansWidth('lllllll', 12);
    assert.ok(ill < monoIll, 'Inter i/l run is narrower than tabular mono');
    assert.ok(william > lllllll, 'William is wider than lllllll at the same count');
  });
});

describe('seatsAroundMark', () => {
  it('clears a 4 px mark so the first seat is not its own obstacle', () => {
    const seats = seatsAroundMark(100, 80, 4, 6);
    assert.equal(seats[0].x, 110);
    assert.equal(seats[0].anchor, 'start');
    const placed = placePlanarLabels([
      {
        id: 'kestrel',
        text: 'Kestrel',
        width: 40,
        height: 10,
        priority: 1,
        seats,
      },
    ], {
      bounds: { x: 0, y: 0, w: 200, h: 160 },
      obstacles: [{ x: 96, y: 76, w: 8, h: 8 }],
      minGap: 3,
    });
    assert.equal(placed[0].hidden, false);
    assert.equal(placed[0].seat?.x, 110);
  });
});

describe('placePlanarLabels', () => {
  it('flips a callout off a neighbor and off the mark', () => {
    const items = [
      {
        id: 'swift',
        text: 'Swift',
        width: 32,
        height: 10,
        priority: 2,
        seats: [
          { x: 80, y: 50, anchor: 'start' as const },
          { x: 60, y: 50, anchor: 'end' as const },
        ],
      },
      {
        id: 'lark',
        text: 'Lark',
        width: 28,
        height: 10,
        priority: 1,
        seats: [
          { x: 80, y: 50, anchor: 'start' as const },
          { x: 60, y: 34, anchor: 'end' as const },
        ],
      },
    ];
    const placed = placePlanarLabels(items, {
      bounds: { x: 0, y: 0, w: 200, h: 120 },
      obstacles: [{ x: 68, y: 42, w: 10, h: 10 }],
      minGap: 3,
    });
    const swift = placed.find((p) => p.id === 'swift');
    const lark = placed.find((p) => p.id === 'lark');
    assert.ok(swift && !swift.hidden);
    assert.ok(lark && !lark.hidden);
    assert.ok(
      swift.seat?.x !== lark.seat?.x || swift.seat?.y !== lark.seat?.y,
      'the two callouts take different seats',
    );
    assert.deepEqual(planarIntegrity(placed, 3), []);
  });

  it('omits the leftover when every seat is taken', () => {
    const placed = placePlanarLabels([
      {
        id: 'keep',
        text: 'Keep',
        width: 80,
        height: 12,
        priority: 2,
        seats: [{ x: 10, y: 20, anchor: 'start' }],
      },
      {
        id: 'drop',
        text: 'Drop',
        width: 80,
        height: 12,
        priority: 1,
        seats: [{ x: 10, y: 20, anchor: 'start' }],
      },
    ], { bounds: { x: 0, y: 0, w: 120, h: 40 }, minGap: 2 });
    assert.equal(placed.find((p) => p.id === 'keep')?.hidden, false);
    assert.equal(placed.find((p) => p.id === 'drop')?.hidden, true);
  });
});

describe('overflowIntegrity', () => {
  it('flags a box that runs past the canvas', () => {
    const errors = overflowIntegrity(
      [{ x: 790, y: 10, w: 40, h: 10 }],
      { x: 0, y: 0, w: 800, h: 200 },
    );
    assert.ok(errors.length > 0);
  });
});

describe('tufte probe', () => {
  it('naive layout fails every integrity class the skill used to checkbox', () => {
    const naive = layoutTufteProbe('naive');
    assert.ok(naive.integrity.lanes.length > 0, 'ticks/refs/ends collide');
    assert.ok(naive.integrity.planar.length > 0, 'scatter callouts collide');
    assert.ok(naive.integrity.scales.length > 0, 'small multiples autoscale');
    assert.ok(naive.integrity.ramp.length > 0, 'rainbow sequential ramp');
    assert.ok(probeIntegrityErrors(naive).length >= 4);
  });

  it('placed layout has empty integrity', () => {
    const placed = layoutTufteProbe('placed');
    assert.deepEqual(placed.integrity.lanes, []);
    assert.deepEqual(placed.integrity.planar, []);
    assert.deepEqual(placed.integrity.overflow, []);
    assert.deepEqual(placed.integrity.scales, []);
    assert.deepEqual(placed.integrity.ramp, []);
    assert.deepEqual(probeIntegrityErrors(placed), []);
    const scatterVisible = placed.scatterLabels.filter((p) => !p.hidden);
    assert.ok(scatterVisible.some((p) => p.id === 'kestrel'), 'isolated Kestrel is labeled');
    assert.ok(
      scatterVisible.length >= 3,
      'seatsAroundMark labels the isolated mark and two of the cluster',
    );
    assert.ok(placed.endLabels.filter((p) => !p.hidden).some((p) => p.id === 'tern'));
  });
});
