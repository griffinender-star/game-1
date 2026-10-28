// Deterministic pictures of completed plays. The baseball engine remains the authority
// for outs, hits and runs; replaying a plan never changes game state.
export const BASE_POINTS = Object.freeze([
  Object.freeze({ x: 480, y: 421 }),
  Object.freeze({ x: 626, y: 304 }),
  Object.freeze({ x: 480, y: 190 }),
  Object.freeze({ x: 334, y: 304 }),
  Object.freeze({ x: 480, y: 421 }),
]);

const DEFENDERS = [
  { x: 480, y: 437, position: 'C' }, { x: 480, y: 304, position: 'P' },
  { x: 638, y: 315, position: '1B' }, { x: 552, y: 267, position: '2B' },
  { x: 407, y: 265, position: 'SS' }, { x: 320, y: 315, position: '3B' },
  { x: 285, y: 175, position: 'LF' }, { x: 480, y: 132, position: 'CF' },
  { x: 675, y: 175, position: 'RF' },
];
const HIT_BASES = { single: 1, double: 2, triple: 3, homerun: 4 };
const CONTACT = new Set([...Object.keys(HIT_BASES), 'flyout', 'groundout', 'foul']);
const DURATIONS = { single: 2600, double: 3200, triple: 3600, homerun: 4000, flyout: 2600, groundout: 2600, foul: 1600, walk: 2200, stolen: 2000, caught: 2000 };
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, Number.isFinite(n) ? n : low));
const occupancy = value => Array.from({ length: 3 }, (_, i) => Boolean(value?.[i]));
const copyPoint = point => ({ x: point.x, y: point.y });
const mix = (a, b, t) => a + (b - a) * t;
function snapshot(value = {}) {
  return { inning: Number.isInteger(value.inning) ? value.inning : 1, half: value.half === 1 ? 1 : 0,
    outs: clamp(value.outs, 0, 3), balls: clamp(value.balls, 0, 3), strikes: clamp(value.strikes, 0, 2),
    score: [Math.max(0, Number(value.score?.[0]) || 0), Math.max(0, Number(value.score?.[1]) || 0)],
    bases: occupancy(value.bases), over: Boolean(value.over) };
}
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
function playKind(event) {
  if (event.type === 'out') return /fly|line/i.test(`${event.label || ''} ${event.text || ''}`) ? 'flyout' : 'groundout';
  return typeof event.type === 'string' ? event.type : 'blocked';
}
function movingRunner(from, to, out = false) {
  return { id: from === 0 ? 'batter' : `runner-${from}`, from, to, scored: to === 4 && !out, out };
}
function destination(kind, seed, spray) {
  // Timing changes the picture of contact, never its already-resolved baseball outcome.
  // All fair-hit landing points remain between the foul lines; home runs clear the wall.
  if (Number.isFinite(spray) && CONTACT.has(kind) && kind !== 'foul') {
    const side = clamp(spray, -1, 1), width = Math.abs(side), variation = seed % 7;
    if (kind === 'single') return { x: 480 + side * 215, y: 225 + width * 13 + variation };
    if (kind === 'double') return { x: 480 + side * 235, y: 112 + width * 40 + variation };
    if (kind === 'triple') return { x: 480 + side * 278, y: 95 + width * 68 + variation };
    if (kind === 'homerun') return { x: 480 + side * 170, y: 25 + width * 29 + variation };
    if (kind === 'flyout') return { x: 480 + side * 175, y: 155 + width * 28 + variation };
    if (kind === 'groundout') return copyPoint(DEFENDERS[side < -.3 ? 4 : side > .3 ? 3 : 1]);
  }
  const left = seed % 2 === 0;
  const shift = (seed % 17) - 8;
  if (kind === 'single') return { x: (left ? 270 : 690) + shift * 2, y: 228 + seed % 18 };
  if (kind === 'double') return { x: (left ? 255 : 705) + shift, y: 140 + seed % 18 };
  if (kind === 'triple') return { x: (left ? 190 : 770) + shift, y: 163 + seed % 12 };
  if (kind === 'homerun') return { x: (left ? 320 : 640) + shift * 2, y: 50 + seed % 12 };
  if (kind === 'flyout') return { x: (left ? 310 : 650) + shift, y: 174 + seed % 22 };
  if (kind === 'groundout') return copyPoint(DEFENDERS[left ? 4 : 3]);
  if (kind === 'foul') return { x: left ? 90 : 870, y: 330 + seed % 25 };
  if (kind === 'stolen' || kind === 'caught') return copyPoint(BASE_POINTS[2]);
  return copyPoint(BASE_POINTS[0]);
}

/** Build a replay without depending on animation timing or a random number generator. */
export function planPlay(event = {}, beforeSnapshot = {}, afterSnapshot = {}) {
  const safeEvent = JSON.parse(JSON.stringify(event || {}));
  const before = snapshot(beforeSnapshot), after = snapshot(afterSnapshot);
  const beforeBases = [...before.bases], afterBases = [...after.bases];
  const kind = playKind(safeEvent);
  const seed = hash(`${kind}|${safeEvent.label || ''}|${safeEvent.text || ''}|${before.inning}|${before.half}|${safeEvent.quality || 0}`);
  const target = destination(kind, seed, safeEvent.spray);
  const runners = [];
  const advance = HIT_BASES[kind] || 0;
  for (let i = 0; i < beforeBases.length; i++) {
    if (!beforeBases[i]) continue;
    const from = i + 1;
    let to = advance ? Math.min(4, from + advance) : from;
    let out = false;
    if (kind === 'walk') {
      const forced = beforeBases.slice(0, from).every(Boolean);
      if (forced) to = from + 1;
    } else if (kind === 'stolen' && from === 1) to = 2;
    else if (kind === 'caught' && from === 1) { to = 2; out = true; }
    runners.push(movingRunner(from, to, out));
  }
  if (advance) runners.push(movingRunner(0, advance));
  else if (kind === 'walk') runners.push(movingRunner(0, 1));
  else if (kind === 'groundout') runners.push(movingRunner(0, 1, true));
  // Keep the completed play visible until the player continues. An inning-ending
  // out can already have cleared the live engine's bases for the next half.
  const displayBases = [false, false, false];
  runners.forEach(r => { if (!r.out && r.to > 0 && r.to < 4) displayBases[r.to - 1] = true; });
  const defenders = CONTACT.has(kind) ? DEFENDERS.slice(1) : DEFENDERS;
  const nearest = defenders.reduce((best, candidate) => Math.hypot(candidate.x - target.x, candidate.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? candidate : best, defenders[0]);
  const fielder = { ...nearest };
  const throwTarget = kind === 'groundout' ? copyPoint(BASE_POINTS[1]) : kind === 'triple' ? copyPoint(BASE_POINTS[3]) : kind === 'flyout' ? { x: 480, y: 304 } : copyPoint(BASE_POINTS[2]);
  const camera = CONTACT.has(kind) || ['walk', 'stolen', 'caught'].includes(kind) ? 'field' : 'pitch';
  return {
    event: safeEvent, kind, camera, duration: DURATIONS[kind] || 1000,
    before, after, beforeBases, afterBases, displayBases, runners,
    target, fielder, throwTarget, seed,
    direction: kind === 'groundout' && Number.isFinite(safeEvent.spray)
      ? (fielder.position === 'P' ? 'BACK TO THE MOUND' : fielder.position === 'SS' ? 'SHORTSTOP' : 'SECOND BASE')
      : target.x < 430 ? 'LEFT FIELD' : target.x > 530 ? 'RIGHT FIELD' : 'CENTER FIELD',
    contact: CONTACT.has(kind), scored: Number.isInteger(safeEvent.scored) ? safeEvent.scored : runners.filter(r => r.scored).length,
    phases: { flightEnd: kind === 'groundout' ? .35 : kind === 'homerun' ? .82 : .52, fieldEnd: .72, runnersEnd: .94 },
  };
}

/** Run the base path in order; a home run visits all four bases. */
export function runnerPosition(from, to, progress) {
  const start = Math.round(clamp(from, 0, 4)), end = Math.max(start, Math.round(clamp(to, 0, 4)));
  const t = clamp(progress);
  if (start === end || t === 0) return copyPoint(BASE_POINTS[start]);
  if (t === 1) return copyPoint(BASE_POINTS[end]);
  const distance = (end - start) * t, leg = Math.floor(distance), fraction = distance - leg;
  const a = BASE_POINTS[start + leg], b = BASE_POINTS[Math.min(end, start + leg + 1)];
  return { x: mix(a.x, b.x, fraction), y: mix(a.y, b.y, fraction) };
}

function ballSegment(a, b, t, height, segment, { startZ = 0, endZ = 0, caught = false, visible = true } = {}) {
  t = clamp(t);
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: Math.sin(t * Math.PI) * height + mix(startZ, endZ, t), visible, segment, caught };
}
function held(point, options = {}) { return { ...copyPoint(point), z: 13, visible: true, segment: 'held', caught: false, ...options }; }

/** Sample a ball in ground coordinates; draw at y-z and its shadow at ground y. */
export function sampleBall(plan, progress) {
  const p = clamp(progress), home = BASE_POINTS[0], target = plan?.target || home;
  const kind = plan?.kind || 'blocked';
  if (kind === 'groundout') {
    if (p < .35) return ballSegment(home, target, p / .35, 3, 'bounce');
    if (p < .52) return held(target);
    if (p < .78) return ballSegment(target, plan.throwTarget || BASE_POINTS[1], (p - .52) / .26, 22, 'throw', { startZ: 13, endZ: 13 });
    return held(plan.throwTarget || BASE_POINTS[1], { caught: true });
  }
  if (kind === 'flyout') {
    if (p < .52) return ballSegment(home, target, p / .52, 152, 'flight', { endZ: 13 });
    if (p < .72) return held(target, { caught: true });
    if (p < .92) return ballSegment(target, plan.throwTarget || { x: 480, y: 304 }, (p - .72) / .20, 28, 'throw', { startZ: 13, endZ: 13, caught: true });
    return held(plan.throwTarget || { x: 480, y: 304 }, { caught: true });
  }
  if (kind === 'homerun') {
    if (p < .82) return ballSegment(home, target, p / .82, 215, 'flight');
    return held(target, { z: 0, visible: false, segment: 'overfence' });
  }
  if (kind === 'foul') {
    if (p < .70) return ballSegment(home, target, p / .70, 80, 'flight');
    return held(target, { z: 0, visible: false, segment: 'foul' });
  }
  if (HIT_BASES[kind]) {
    if (p < .52) return ballSegment(home, target, p / .52, kind === 'single' ? 66 : kind === 'double' ? 112 : 124, 'flight');
    if (p < .64) return { ...held(target), z: Math.sin((p - .52) / .12 * Math.PI) * 19, segment: 'bounce' };
    if (p < .72) return held(target);
    if (p < .92) return ballSegment(target, plan.throwTarget || BASE_POINTS[2], (p - .72) / .20, 36, 'throw', { startZ: 13, endZ: 13 });
    return held(plan.throwTarget || BASE_POINTS[2], { caught: true });
  }
  if (kind === 'stolen' || kind === 'caught') {
    const catcher = { x: 480, y: 438 };
    if (p < .20) return held(catcher);
    if (p < .72) return ballSegment(catcher, BASE_POINTS[2], (p - .20) / .52, 36, 'throw', { startZ: 13, endZ: 13 });
    return held(BASE_POINTS[2], { caught: kind === 'caught' });
  }
  return held({ x: 480, y: 304 }, { visible: false, segment: 'none' });
}
