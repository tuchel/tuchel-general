import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hexToHsl,
  placeRangeFrameTicks,
  sequentialRampIntegrity,
  sharedScaleIntegrity,
  stackBands,
} from '../src/layout/chartFidelity.ts';
import { laneIntegrity } from '../src/layout/labelPlacement.ts';

describe('placeRangeFrameTicks', () => {
  it('keeps data-extent min/max and drops a nice tick that sits on them', () => {
    // Probe case: domain 2016.15–2026.40. Nice 2016 and 2026 share ink with
    // the extent labels if both are printed on one baseline.
    const domain: [number, number] = [2016.15, 2026.40];
    const toPx = (v: number) => ((v - domain[0]) / (domain[1] - domain[0])) * 700;
    const placed = placeRangeFrameTicks({
      domain,
      toPx,
      format: (v) => v.toFixed(v % 1 === 0 ? 0 : 2),
      bounds: [0, 700],
      candidates: [2016, 2018, 2020, 2022, 2024, 2026],
      fontSize: 10,
      minGap: 10,
    });
    const visible = placed.filter((p) => !p.hidden);
    const texts = visible.map((p) => p.text);
    assert.ok(texts.includes('2016.15'));
    assert.ok(texts.includes('2026.40'));
    assert.ok(!texts.includes('2016'), 'nice 2016 collides with 2016.15');
    assert.ok(!texts.includes('2026'), 'nice 2026 collides with 2026.40');
    assert.ok(texts.includes('2018'));
    assert.deepEqual(laneIntegrity(placed, 10), []);
  });

  it('uses cap-height, not string width, on a vertical axis', () => {
    const toPx = (v: number) => 200 - v;
    const placed = placeRangeFrameTicks({
      domain: [0, 154],
      toPx,
      format: (v) => String(v),
      bounds: [46, 200],
      candidates: [0, 40, 80, 120, 160],
      along: 'y',
      fontSize: 10,
      minGap: 8,
    });
    const visible = placed.filter((p) => !p.hidden);
    assert.ok(visible.some((p) => p.id === 'min' && p.text === '0'));
    assert.ok(visible.some((p) => p.id === 'max' && p.text === '154'));
    assert.ok(visible.some((p) => p.text === '80'));
    assert.deepEqual(laneIntegrity(placed, 8), []);
  });
});

describe('stackBands', () => {
  it('assigns exclusive strips that never share a baseline', () => {
    const bands = stackBands(300, 1, [
      { id: 'ticks', size: 16 },
      { id: 'refs', size: 13 },
    ]);
    assert.equal(bands[0].start, 300);
    assert.equal(bands[0].end, 316);
    assert.equal(bands[1].start, 316);
    assert.ok(bands[0].end <= bands[1].start);
  });
});

describe('sharedScaleIntegrity', () => {
  it('is empty when every panel shares domains', () => {
    assert.deepEqual(sharedScaleIntegrity([
      { id: 'a', x: [1, 154], y: [0, 12000] },
      { id: 'b', x: [1, 154], y: [0, 12000] },
    ]), []);
  });

  it('flags an autoscaled panel against its neighbor', () => {
    const errors = sharedScaleIntegrity([
      { id: 'kestrel', x: [1, 154], y: [0, 12000] },
      { id: 'osprey', x: [1, 154], y: [4410, 9345] },
    ]);
    assert.ok(errors.some((e) => e.includes('osprey')));
  });
});

describe('sequentialRampIntegrity', () => {
  it('accepts a single-hue ink ramp', () => {
    assert.deepEqual(
      sequentialRampIntegrity(['#DDE2EC', '#7B879E', '#2C3750', '#0F1A33']),
      [],
    );
  });

  it('rejects a blue-yellow-red rainbow', () => {
    const errors = sequentialRampIntegrity(['#3E6CC9', '#E8B94A', '#B8535A']);
    assert.ok(errors.some((e) => e.includes('hue span')));
  });

  it('parses hex into HSL', () => {
    const ink = hexToHsl('#0F1A33');
    assert.ok(ink.l < 0.2);
    assert.ok(ink.s > 0);
  });
});
