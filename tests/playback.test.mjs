import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_POINTS, planPlay, runnerPosition, sampleBall } from '../playback.js';
import { BaseballGame } from '../engine.js';
const state = bases => ({ bases, inning: 1, half: 1, score: [0, 0], outs: 0 });
const event = (type, extra = {}) => ({ type, label: type.toUpperCase(), text: `Test ${type}`, quality: .8, before: { inning: 1, half: 1 }, scored: 0, ...extra });

test('every hit advances the batter and occupied bases on the actual base paths', () => {
  for (const [type, n] of [['single', 1], ['double', 2], ['triple', 3], ['homerun', 4]]) {
    const p = planPlay(event(type, { bases: n }), state([true, true, true]), state([false, false, false]));
    assert.equal(p.camera, 'field'); assert.equal(p.contact, true);
    assert.equal(p.runners.length, 4);
    for (const runner of p.runners) { assert.equal(runner.to, Math.min(4, runner.from + n)); assert.equal(runner.scored, runner.to === 4); }
    assert.deepEqual(p.runners.find(r => r.id === 'batter'), { id: 'batter', from: 0, to: n, scored: n === 4, out: false });
    assert.equal(p.runners.filter(r => r.scored).length, n);
  }
});

test('runnerPosition visits each base instead of cutting across the diamond', () => {
  assert.deepEqual(runnerPosition(0, 4, 0), BASE_POINTS[0]);
  assert.deepEqual(runnerPosition(0, 4, .25), BASE_POINTS[1]);
  assert.deepEqual(runnerPosition(0, 4, .5), BASE_POINTS[2]);
  assert.deepEqual(runnerPosition(0, 4, .75), BASE_POINTS[3]);
  assert.deepEqual(runnerPosition(0, 4, 1), BASE_POINTS[4]);
  assert.deepEqual(runnerPosition(1, 3, .5), BASE_POINTS[2]);
  assert.deepEqual(runnerPosition(2, 2, .5), BASE_POINTS[2]);
  assert.deepEqual(runnerPosition(1, 2, -1), BASE_POINTS[1]);
  assert.deepEqual(runnerPosition(1, 2, 2), BASE_POINTS[2]);
});

test('walks force only a continuous chain beginning on first base', () => {
  for (let mask = 0; mask < 8; mask++) {
    const bases = [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)];
    const game = new BaseballGame(); game.state.half = 1; game.state.balls = 3; game.state.bases = [...bases];
    const before = JSON.parse(game.serialize()); const e = game.resolvePitch({ inZone: false, swing: false });
    const plan = planPlay(e, before, game.state);
    assert.deepEqual(plan.displayBases, game.state.bases, `occupancy ${mask}`);
    assert.equal(plan.runners.filter(r => r.scored).length, e.scored);
    assert.equal(plan.runners.length, bases.filter(Boolean).length + 1);
  }
});

test('third-out replay holds the old base picture without inventing an advancing safe runner', () => {
  const before = state([true, false, true]), after = { ...state([false, false, false]), half: 0, inning: 2 };
  const p = planPlay(event('out', { label: 'GROUND OUT', inningChanged: true }), before, after);
  assert.deepEqual(p.afterBases, [false, false, false]);
  assert.deepEqual(p.displayBases, before.bases);
  assert.deepEqual(p.runners.find(r => r.id === 'batter'), { id: 'batter', from: 0, to: 1, scored: false, out: true });
  assert.equal(p.runners.filter(r => r.scored).length, 0);
});

test('fly outs and ground outs have distinct ball routes and no safe batter', () => {
  const fly = planPlay(event('out', { label: 'FLY OUT' }), state([false, false, false]), state([false, false, false]));
  const ground = planPlay(event('out', { label: 'GROUND OUT' }), state([false, false, false]), state([false, false, false]));
  assert.equal(fly.kind, 'flyout'); assert.equal(ground.kind, 'groundout');
  assert.ok(sampleBall(fly, .2).z > 100); assert.ok(sampleBall(ground, .2).z <= 4);
  assert.equal(sampleBall(fly, .6).caught, true); assert.equal(sampleBall(ground, .6).segment, 'throw');
  assert.deepEqual(ground.throwTarget, BASE_POINTS[1]);
  assert.equal(fly.runners.length, 0); assert.equal(ground.runners[0].out, true);
});

test('a home run crosses the wall and the entire base circuit remains visible', () => {
  const p = planPlay(event('homerun', { scored: 4 }), state([true, true, true]), state([false, false, false]));
  assert.equal(p.duration, 4000); assert.ok(p.target.y < 65);
  assert.equal(sampleBall(p, .95).segment, 'overfence'); assert.equal(sampleBall(p, .95).visible, false);
  assert.deepEqual(p.displayBases, [false, false, false]); assert.equal(p.runners.filter(r => r.scored).length, 4);
});

test('steal success and a caught runner preserve the other occupied bases', () => {
  const before = state([true, false, true]);
  const safe = planPlay(event('stolen'), before, state([false, true, true]));
  const caught = planPlay(event('caught'), before, state([false, false, true]));
  assert.deepEqual(safe.displayBases, [false, true, true]); assert.deepEqual(caught.displayBases, [false, false, true]);
  assert.equal(safe.runners[0].out, false); assert.equal(caught.runners[0].out, true);
  assert.equal(sampleBall(caught, .4).segment, 'throw');
});

test('ordinary balls and strikes have no invented contact, movement or runs', () => {
  for (const type of ['ball', 'strike', 'strikeout', 'blocked']) {
    const p = planPlay(event(type), state([true, false, true]), state([true, false, true]));
    assert.equal(p.camera, 'pitch'); assert.equal(p.contact, false); assert.equal(p.scored, 0);
    assert.deepEqual(p.runners.map(r => [r.from, r.to]), [[1, 1], [3, 3]]);
    assert.equal(sampleBall(p, .5).visible, false);
  }
});

test('plans and sampled trajectories are deterministic and do not mutate their inputs', () => {
  const before = state([true, false, true]), after = state([false, true, false]), e = event('double', { bases: 2, scored: 1 });
  const originals = JSON.stringify({ before, after, e });
  const a = planPlay(e, before, after), b = planPlay(e, before, after);
  assert.deepEqual(a, b); assert.equal(JSON.stringify({ before, after, e }), originals);
  for (let i = 0; i <= 20; i++) assert.deepEqual(sampleBall(a, i / 20), sampleBall(b, i / 20));
  a.beforeBases[0] = false; a.event.before.half = 0;
  assert.equal(before.bases[0], true); assert.equal(e.before.half, 1);
});

test('swing timing sends fair contact left, through center, or to the opposite field', () => {
  for (const kind of ['single', 'double', 'triple', 'homerun', 'flyout']) {
    const left = planPlay(event(kind, { spray: -1 }));
    const middle = planPlay(event(kind, { spray: 0 }));
    const right = planPlay(event(kind, { spray: 1 }));
    assert.ok(left.target.x < 430, kind);
    assert.equal(middle.target.x, 480, kind);
    assert.ok(right.target.x > 530, kind);
    assert.equal(left.direction, 'LEFT FIELD');
    assert.equal(middle.direction, 'CENTER FIELD');
    assert.equal(right.direction, 'RIGHT FIELD');
    assert.equal(left.target.y, right.target.y);
    const slightEarly = planPlay(event(kind, { spray: -.1 }));
    const slightLate = planPlay(event(kind, { spray: .1 }));
    assert.equal(slightEarly.direction, 'CENTER FIELD');
    assert.equal(slightLate.direction, 'CENTER FIELD');
  }
  for (const [spray, position, direction] of [[-1, 'SS', 'SHORTSTOP'], [0, 'P', 'BACK TO THE MOUND'], [1, '2B', 'SECOND BASE']]) {
    const ground = planPlay(event('out', { label: 'GROUND OUT', spray }));
    assert.equal(ground.fielder.position, position);
    assert.deepEqual(ground.target, { x: ground.fielder.x, y: ground.fielder.y });
    assert.equal(ground.direction, direction);
    assert.deepEqual(ground.throwTarget, BASE_POINTS[1]);
  }
});

test('spray destinations stay fair and home runs land beyond the curved outfield wall', () => {
  for (const kind of ['single', 'double', 'triple', 'homerun', 'flyout', 'groundout']) {
    for (let step = -25; step <= 25; step++) {
      const plan = planPlay(event(kind, { spray: step / 20 })), { x, y } = plan.target;
      // Foul lines run from home (480,421) through (120,177) and (840,177).
      assert.ok(Math.abs(x - 480) * 244 / 360 <= 421 - y, `${kind} at ${step / 20}`);
      assert.ok(x > 0 && x < 960 && y > 0 && y < 421);
      // Fence: quadratic from (127,192) via (480,-106) to (833,192).
      const t = (x - 127) / 706;
      const fenceY = 192 - 596 * t * (1 - t);
      if (kind === 'homerun') assert.ok(y < fenceY, `Home run must clear fence at ${step / 20}`);
      else assert.ok(y > fenceY, `Fair hit must land inside the fence at ${step / 20}`);
    }
  }
});

test('spray changes neither scoring nor runners and remains deterministic without mutating inputs', () => {
  const before = state([true, true, true]), after = { ...state([false, true, true]), score: [0, 2] };
  const hit = event('double', { bases: 2, scored: 2, spray: -.7 });
  const original = JSON.stringify({ hit, before, after });
  const first = planPlay(hit, before, after), replay = planPlay(hit, before, after);
  const right = planPlay({ ...hit, spray: .7 }, before, after);
  assert.deepEqual(first, replay);
  assert.equal(JSON.stringify({ hit, before, after }), original);
  for (const key of ['runners', 'displayBases', 'afterBases', 'scored', 'before', 'after', 'duration']) assert.deepEqual(first[key], right[key]);
  for (let sample = 0; sample <= 20; sample++) assert.deepEqual(sampleBall(first, sample / 20), sampleBall(replay, sample / 20));
  assert.deepEqual(planPlay(event('foul', { spray: -1 })).target, planPlay(event('foul', { spray: 1 })).target);
  assert.deepEqual(planPlay(event('walk', { spray: -1 })).target, planPlay(event('walk', { spray: 1 })).target);
});

test('events without spray keep their established deterministic destinations', () => {
  const targets = {
    single: { x: 690, y: 237 }, double: { x: 258, y: 154 }, triple: { x: 775, y: 168 },
    homerun: { x: 628, y: 61 }, flyout: { x: 312, y: 188 }, groundout: { x: 407, y: 265 }, foul: { x: 870, y: 335 },
  };
  for (const [kind, target] of Object.entries(targets)) {
    assert.deepEqual(planPlay(event(kind), state([])).target, target);
    assert.deepEqual(planPlay(event(kind, { spray: 'left' }), state([])).target, target);
  }
});

test('replay runner endpoints agree with real engine outcomes for each hit and each occupancy', () => {
  for (let mask = 0; mask < 8; mask++) for (const quality of [.5, .8, 1]) for (const power of [false, true]) {
    const game = new BaseballGame(null, { rng: () => .1 });
    game.state.half = 1; game.state.bases = [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)];
    const before = JSON.parse(game.serialize()); const e = game.resolvePitch({ swing: true, inZone: true, quality, power });
    const p = planPlay(e, before, game.state);
    assert.deepEqual(p.displayBases, game.state.bases);
    assert.equal(p.runners.filter(r => r.scored).length, e.scored);
  }
});

test('a real walk-off grand slam keeps all four scoring paths after the engine ends the game', () => {
  const game = new BaseballGame(null, { rng: () => .1 });
  Object.assign(game.state, { inning: 3, half: 1, bases: [true, true, true], score: [0, 0] });
  const before = JSON.parse(game.serialize());
  const e = game.resolvePitch({ swing: true, quality: 1, power: true, inZone: true });
  assert.equal(game.state.over, true); assert.equal(e.scored, 4);
  const plan = planPlay(e, before, game.state);
  assert.equal(plan.runners.filter(r => r.scored).length, 4);
  assert.equal(plan.event.gameOver, true);
  for (const runner of plan.runners) assert.deepEqual(runnerPosition(runner.from, runner.to, 1), BASE_POINTS[4]);
});
