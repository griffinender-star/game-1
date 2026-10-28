/** Shared pitch geometry: the visible ball reaches the selected plate location at progress 1. */
export const PITCH_GEOMETRY = Object.freeze({
  release: Object.freeze({ x: 662, y: 302 }),
  plate: Object.freeze({ x: 182, y: 336 }),
  zone: Object.freeze({ x: 151, y: 275, w: 62, h: 77 }),
  locationZone: Object.freeze({ min: .18, max: .82 }),
});

export const PITCH_TYPES = Object.freeze([
  Object.freeze({ id: 0, key: 'fastball', name: 'FASTBALL', speed: 93, duration: 1420, breakX: 0, breakY: 0 }),
  Object.freeze({ id: 1, key: 'curveball', name: 'CURVEBALL', speed: 78, duration: 1640, breakX: -5, breakY: -34 }),
  Object.freeze({ id: 2, key: 'slider', name: 'SLIDER', speed: 85, duration: 1530, breakX: 6, breakY: 16 }),
]);

/** Timing changes forgiveness, never the location or speed of the visible pitch. */
export const DIFFICULTIES = Object.freeze([
  Object.freeze({ key: 'relaxed', label: 'Relaxed', description: 'A wider contact window while you learn to read pitches.', width: 1.25 }),
  Object.freeze({ key: 'standard', label: 'Standard', description: 'Balanced timing with room for a natural touch response.', width: 1 }),
  Object.freeze({ key: 'allstar', label: 'All-Star', description: 'A tighter contact window for a tougher challenge.', width: .8 }),
]);

const bounded = (n, min, max) => Math.max(min, Math.min(max, n));
const number = (n, fallback) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const unit = (n, fallback = .5) => bounded(number(n, fallback), 0, 1);
const typeFor = value => {
  if (Number.isInteger(value)) return PITCH_TYPES[value] || PITCH_TYPES[0];
  if (typeof value === 'string') return PITCH_TYPES.find(p => p.key === value.toLowerCase() || p.name === value.toUpperCase()) || PITCH_TYPES[0];
  return PITCH_TYPES[0];
};

/** The side panel includes ball territory outside its inner strike-zone square. */
export function normalizeLocation(u = .5, v = .5) {
  if (u && typeof u === 'object') { v = u.v; u = u.u; }
  return { u: unit(u), v: unit(v) };
}

export function locationToTarget(location = {}) {
  const { u, v } = normalizeLocation(location.u, location.v);
  const { zone, locationZone } = PITCH_GEOMETRY;
  const span = locationZone.max - locationZone.min;
  return {
    x: zone.x + (u - locationZone.min) / span * zone.w,
    y: zone.y + (v - locationZone.min) / span * zone.h,
  };
}

export function targetToLocation(target = {}) {
  const { zone, locationZone } = PITCH_GEOMETRY;
  const span = locationZone.max - locationZone.min;
  return normalizeLocation(
    locationZone.min + (number(target.x, zone.x + zone.w / 2) - zone.x) / zone.w * span,
    locationZone.min + (number(target.y, zone.y + zone.h / 2) - zone.y) / zone.h * span,
  );
}

/**
 * Position and apparent size of the actual ball, not a separate timing indicator.
 * Progress may extend slightly beyond 1 so a late swing sees the ball pass the plate.
 */
export function pitchPoint(progress = 0, target = PITCH_GEOMETRY.plate, pitchType = 0) {
  const p = bounded(number(progress, 0), 0, 1.25);
  const near = bounded(p, 0, 1);
  const type = typeFor(pitchType);
  const release = PITCH_GEOMETRY.release;
  const end = { x: number(target?.x, PITCH_GEOMETRY.plate.x), y: number(target?.y, PITCH_GEOMETRY.plate.y) };
  // Break is zero at release and at arrival, so aiming and the recorded location agree.
  const breakAmount = p < 1 ? Math.sin(p * Math.PI) : 0;
  const x = release.x + (end.x - release.x) * p + type.breakX * breakAmount;
  const y = release.y + (end.y - release.y) * p + type.breakY * breakAmount;
  const size = 5 + 6 * Math.pow(near, 1.25);
  return {
    x, y, size, radius: size / 2,
    progress: p,
    distanceToPlate: Math.hypot(end.x - x, end.y - y),
    atPlate: Math.abs(p - 1) <= .015,
    passedPlate: p > 1,
  };
}

/** A small sweet spot absorbs input jitter; forgiveness falls smoothly on either side. */
export function swingQuality(progress = 0, contact = 65, difficulty = 'standard') {
  const p = bounded(number(progress, 0), 0, 2);
  const skill = bounded(number(contact, 65), 0, 99);
  const setting = DIFFICULTIES.find(option => option.key === difficulty) || DIFFICULTIES[1];
  // Progress one is the actual plate crossing for every pitch type and location.
  // Using its unclipped distance also keeps very late swings from becoming valid again.
  const distance = Math.abs(p - 1);
  const sweetSpot = .022 * setting.width;
  const window = (.17 + (skill - 65) * .00035) * setting.width;
  const falloff = bounded((distance - sweetSpot) / (window - sweetSpot), 0, 1);
  const quality = 1 - falloff * falloff * (3 - 2 * falloff);
  const feedback = distance <= sweetSpot + Number.EPSILON ? 'PERFECT CONTACT'
    : quality >= .7 ? 'GOOD CONTACT'
    : quality >= .22 ? (p < 1 ? 'EARLY CONTACT' : 'LATE CONTACT')
    : p < 1 ? 'TOO EARLY' : 'TOO LATE';
  return { quality, feedback, distance, passedPlate: p > 1 };
}

/** Sample once at release and retain the result for the pitch trace and replay. */
export function samplePitch({ aim = { u: .5, v: .5 }, pitcher = {}, pitchType = 0, rng = Math.random } = {}) {
  const type = typeFor(pitchType);
  const intended = normalizeLocation(aim?.u, aim?.v);
  const control = bounded(number(pitcher?.control, 65), 0, 99);
  const velocityRating = bounded(number(pitcher?.velocity, 80), 0, 99);
  const random = () => unit(typeof rng === 'function' ? rng() : .5);
  // Low-control arms can miss by ~20% of the panel; elite control stays within ~3%.
  const spread = .026 + (1 - control / 100) * .28;
  const actual = normalizeLocation(
    intended.u + (random() - random()) * spread,
    intended.v + (random() - random()) * spread,
  );
  const target = locationToTarget(actual);
  const error = Math.hypot(actual.u - intended.u, actual.v - intended.v);
  const command = bounded(.30 + control / 100 * .70 - error * .65, .30, 1);
  const velocity = Math.round((type.speed + (velocityRating - 80) * .15) * 10) / 10;
  const duration = Math.round(bounded(type.duration * type.speed / velocity, 1250, 1700));
  const { zone } = PITCH_GEOMETRY;
  const inZone = target.x >= zone.x && target.x <= zone.x + zone.w && target.y >= zone.y && target.y <= zone.y + zone.h;
  return { target, actual, intended, inZone, command, velocity, duration, pitchType: type.id, type: type.key };
}
