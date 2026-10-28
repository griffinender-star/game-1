import test from 'node:test';
import assert from 'node:assert/strict';
import { PITCH_GEOMETRY, PITCH_TYPES, DIFFICULTIES, normalizeLocation, locationToTarget, targetToLocation, pitchPoint, swingQuality, samplePitch } from '../pitch-model.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);
const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

test('side-panel strike boundaries map exactly to the visible strike zone and round-trip', () => {
  const z = PITCH_GEOMETRY.zone;
  assert.deepEqual(locationToTarget({ u: .18, v: .18 }), { x: z.x, y: z.y });
  near(locationToTarget({ u: .82, v: .82 }).x, z.x + z.w);
  near(locationToTarget({ u: .82, v: .82 }).y, z.y + z.h);
  for (const u of [0, .18, .5, .82, 1]) for (const v of [0, .18, .5, .82, 1]) {
    const result = targetToLocation(locationToTarget({ u, v })); near(result.u, u); near(result.v, v);
  }
});

test('invalid and out-of-range input produces finite, bounded locations', () => {
  assert.deepEqual(normalizeLocation(-5, 7), { u: 0, v: 1 });
  assert.deepEqual(normalizeLocation(NaN, Infinity), { u: .5, v: .5 });
  assert.deepEqual(normalizeLocation({ u: .7, v: .1 }), { u: .7, v: .1 });
  for (const p of [undefined, null, NaN, Infinity, -100, 5]) {
    const point = pitchPoint(p, { x: NaN, y: undefined });
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && point.size > 0);
    assert.ok(Number.isFinite(swingQuality(p).quality));
  }
});

test('every pitch visibly reaches its actual selected plate point at progress one', () => {
  for (const type of PITCH_TYPES) for (const location of [{ u: .2, v: .3 }, { u: .7, v: .8 }, { u: .99, v: .01 }]) {
    const target = locationToTarget(location), start = pitchPoint(0, target, type.id), end = pitchPoint(1, target, type.id);
    assert.equal(start.x, PITCH_GEOMETRY.release.x); assert.equal(start.y, PITCH_GEOMETRY.release.y);
    near(end.x, target.x); near(end.y, target.y); near(end.distanceToPlate, 0); assert.equal(end.atPlate, true);
    assert.ok(end.size > start.size, 'An approaching ball must become easier to see');
  }
});

test('breaking pitches visibly take different routes but share the same arrival point', () => {
  const target = locationToTarget({ u: .5, v: .5 });
  const points = PITCH_TYPES.map(type => pitchPoint(.5, target, type.id));
  assert.ok(points[1].y < points[0].y - 20); assert.ok(points[2].y > points[0].y + 10);
  const beyond = pitchPoint(1.12, target, 0); assert.equal(beyond.passedPlate, true); assert.ok(beyond.x < target.x);
});

test('swing quality peaks when the visible baseball reaches the plate, not at the old timer position', () => {
  assert.equal(swingQuality(1).quality, 1);
  assert.ok(swingQuality(.86).quality < .3, 'The old .86 timer point is early in the new pitch');
  near(swingQuality(.95).quality, swingQuality(1.05).quality);
  assert.ok(swingQuality(.95).quality > swingQuality(.88).quality);
  assert.equal(swingQuality(.6).quality, 0); assert.equal(swingQuality(1.5).quality, 0);
  assert.equal(swingQuality(.6).feedback, 'TOO EARLY'); assert.equal(swingQuality(1.5).feedback, 'TOO LATE');
  assert.equal(swingQuality(1).feedback, 'PERFECT CONTACT');
});

test('player contact modestly widens forgiveness without moving the physical contact point', () => {
  assert.equal(swingQuality(1, 37).quality, 1); assert.equal(swingQuality(1, 99).quality, 1);
  assert.ok(swingQuality(.9, 99).quality > swingQuality(.9, 37).quality);
  assert.ok(swingQuality(.7, 99).quality === 0, 'Contact rating cannot rescue a far-too-early swing');
});

test('standard timing has a stable sweet spot and smooth, useful contact around arrival', () => {
  for (const progress of [.978, .985, 1, 1.015, 1.022]) {
    near(swingQuality(progress).quality, 1);
    assert.equal(swingQuality(progress).feedback, 'PERFECT CONTACT');
  }
  assert.ok(swingQuality(.95).quality >= .7);
  assert.ok(swingQuality(.9).quality > .35 && swingQuality(.9).quality < .55);
  assert.ok(swingQuality(.86).quality < .3);
  assert.equal(swingQuality(.78).quality, 0);
  assert.ok(swingQuality(1.17).quality < .22);
  // Adjacent frames near the sweet spot should not cause an abrupt quality cliff.
  assert.ok(swingQuality(.977).quality > .999);
});

test('all timing settings fall monotonically away from the same visible plate crossing', () => {
  for (const { key } of DIFFICULTIES) for (const contact of [0, 37, 65, 99]) {
    let previous = 1;
    for (let step = 0; step <= 30; step++) {
      const distance = step / 100;
      const early = swingQuality(1 - distance, contact, key);
      const late = swingQuality(1 + distance, contact, key);
      near(early.quality, late.quality);
      assert.ok(early.quality <= previous + 1e-12);
      previous = early.quality;
      if (distance >= .25) assert.equal(early.quality, 0);
      if (early.feedback.includes('EARLY')) assert.equal(early.passedPlate, false);
      if (late.feedback.includes('LATE')) assert.equal(late.passedPlate, true);
    }
  }
});

test('difficulty widens forgiveness without moving arrival or concealing early and late misses', () => {
  assert.ok(Object.isFrozen(DIFFICULTIES) && DIFFICULTIES.every(Object.isFrozen));
  assert.deepEqual(DIFFICULTIES.map(option => option.key), ['relaxed', 'standard', 'allstar']);
  for (const progress of [.9, 1.1]) {
    const relaxed = swingQuality(progress, 65, 'relaxed').quality;
    const standard = swingQuality(progress, 65, 'standard').quality;
    const allstar = swingQuality(progress, 65, 'allstar').quality;
    assert.ok(relaxed > standard && standard > allstar);
  }
  for (const { key } of DIFFICULTIES) {
    assert.equal(swingQuality(1, 37, key).quality, 1);
    assert.equal(swingQuality(1, 99, key).quality, 1);
    assert.equal(swingQuality(.6, 65, key).feedback, 'TOO EARLY');
    assert.equal(swingQuality(1.4, 65, key).feedback, 'TOO LATE');
  }
  assert.deepEqual(swingQuality(.9, 65, 'invalid'), swingQuality(.9, 65, 'standard'));
});

test('a sampled pitch records intended and actual locations consistently without mutating aim', () => {
  const aim = { u: .2, v: .3 }, copy = { ...aim };
  const p = samplePitch({ aim, pitcher: { control: 40, velocity: 60 }, rng: seeded(6) });
  assert.deepEqual(aim, copy); assert.deepEqual(p.intended, aim); assert.notDeepEqual(p.actual, aim);
  const inverse = targetToLocation(p.target); near(inverse.u, p.actual.u); near(inverse.v, p.actual.v);
  const end = pitchPoint(1, p.target, p.pitchType); near(end.x, p.target.x); near(end.y, p.target.y);
});

test('high-control pitchers miss their intended location much less than weak-control pitchers', () => {
  function meanError(control) {
    const rng = seeded(122); let total = 0;
    for (let i = 0; i < 1000; i++) {
      const p = samplePitch({ aim: { u: .5, v: .5 }, pitcher: { control, velocity: 80 }, rng });
      total += Math.hypot(p.actual.u - .5, p.actual.v - .5);
    }
    return total / 1000;
  }
  assert.ok(meanError(99) < meanError(37) * .2);
});

test('actual pitch location determines ball versus strike for every pitch type', () => {
  const z = PITCH_GEOMETRY.zone;
  for (const pitchType of [0, 1, 2]) for (const aim of [{ u: .05, v: .05 }, { u: .5, v: .5 }, { u: .97, v: .5 }]) {
    const p = samplePitch({ aim, pitchType, pitcher: { control: 99, velocity: 89 }, rng: () => .5 });
    assert.equal(p.inZone, p.target.x >= z.x && p.target.x <= z.x + z.w && p.target.y >= z.y && p.target.y <= z.y + z.h);
    assert.equal(p.inZone, aim.u === .5);
    assert.ok(p.duration >= 1250 && p.duration <= 1700); assert.ok(p.velocity > 60); assert.ok(p.command >= .3 && p.command <= 1);
  }
});

test('pitch sampling is deterministic for a supplied random source and meaningful across types', () => {
  const input = { aim: { u: .6, v: .4 }, pitcher: { control: 75, velocity: 88 }, pitchType: 'slider' };
  assert.deepEqual(samplePitch({ ...input, rng: seeded(97) }), samplePitch({ ...input, rng: seeded(97) }));
  const fast = samplePitch({ ...input, pitchType: 0, rng: () => .5 }), curve = samplePitch({ ...input, pitchType: 1, rng: () => .5 });
  assert.ok(fast.velocity > curve.velocity); assert.ok(fast.duration < curve.duration);
});
