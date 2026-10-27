// Pure baseball rules and season state. Rendering and input live in app.js.
export const teams = [
  { id: 0, name: 'New York Knights', short: 'NYK', city: 'NEW YORK', mascot: 'KNIGHTS', color: '#55b5d0' },
  { id: 1, name: 'Boston Comets', short: 'BOS', city: 'BOSTON', mascot: 'COMETS', color: '#e96c5b' },
  { id: 2, name: 'Chicago Foxes', short: 'CHI', city: 'CHICAGO', mascot: 'FOXES', color: '#eeae54' },
  { id: 3, name: 'Los Angeles Stars', short: 'LAX', city: 'LOS ANGELES', mascot: 'STARS', color: '#a489db' },
];
const names = ['Alex Rivera', 'Sam Brooks', 'Jordan Hayes', 'Casey Morgan', 'Taylor Reed', 'Jamie Park', 'Drew Carter', 'Riley Stone', 'Chris Vega', 'Lee Walker', 'Max Quinn', 'Jesse Cole'];
const positions = ['CF', 'SS', '1B', 'RF', '3B', 'LF', '2B', 'C', 'DH', 'OF', 'IF', 'C'];
export const roster = names.map((name, id) => ({ id, name, pos: positions[id], contact: 65 + (id * 13) % 29, power: 60 + (id * 17) % 35, speed: 62 + (id * 11) % 30 }));
export const pitchers = [
  { id: 0, name: 'Nolan West', control: 82, velocity: 89 },
  { id: 1, name: 'Eli Turner', control: 88, velocity: 78 },
  { id: 2, name: 'Finn Ross', control: 74, velocity: 94 },
];
const visitorNames = [
  ['Ben Foster', 'Noah Price', 'Milo Green', 'Owen King', 'Evan Scott', 'Theo Ford', 'Luke Blair', 'Cole Nash', 'Ace Bell'],
  ['Luis Diaz', 'Nico Cruz', 'Jack Moore', 'Leo Young', 'Henry Fox', 'Miles Hart', 'Jude Lane', 'Ryan Lake', 'Kai Nash'],
  ['Zane Hill', 'Jett Adams', 'Cal Reed', 'Finn Ray', 'Eli Woods', 'Ari Stone', 'Beau Smith', 'Ian Chase', 'Dax Grey'],
];
const visitorPitchers = [
  { id: 0, name: 'Oscar Grant', control: 78, velocity: 86 },
  { id: 0, name: 'Marco Silva', control: 83, velocity: 90 },
  { id: 0, name: 'Dean Pierce', control: 81, velocity: 88 },
];
const visitorRosters = visitorNames.map((names, team) => names.map((name, id) => ({ id, name, pos: positions[id], contact: 63 + ((id + team) * 9) % 29, power: 62 + ((id + team) * 7) % 32, speed: 64 + (id * 7) % 28 })));
const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const validArray = (array, length, check) => Array.isArray(array) && array.length === length && array.every(check);
function newGame(game = 0, results = [], order = roster.slice(0, 9).map(p => p.id), innings = 3, leagueRecords = teams.map(() => ({ w: 0, l: 0 }))) {
  return { version: 2, game, results, order: [...order], innings, inning: 1, half: 0, outs: 0, balls: 0, strikes: 0, bases: [false, false, false], score: [0, 0], hits: [0, 0], lines: [Array(innings).fill(null), Array(innings).fill(null)], bats: [0, 0], pitches: [0, 0], pitchers: [0, 0], usedPitchers: [0], usedBatters: [...order], over: false, log: [], started: false, leagueRecords };
}
function validState(s) {
  if (!s || s.version !== 2 || ![3, 9].includes(s.innings)) return false;
  if (!integer(s.game, 0, 11) || !integer(s.inning, 1, 10000) || !integer(s.half, 0, 1) || !integer(s.outs, 0, 3) || !integer(s.balls, 0, 3) || !integer(s.strikes, 0, 2)) return false;
  if (!validArray(s.order, 9, n => integer(n, 0, 11)) || new Set(s.order).size !== 9 || !validArray(s.bases, 3, n => typeof n === 'boolean')) return false;
  for (const field of ['score', 'hits', 'bats', 'pitches']) if (!validArray(s[field], 2, n => integer(n, 0, 1000000))) return false;
  if (!validArray(s.pitchers, 2, n => integer(n, 0, 2)) || !Array.isArray(s.usedPitchers) || !s.usedPitchers.every(n => integer(n, 0, 2)) || !Array.isArray(s.usedBatters) || !s.usedBatters.every(n => integer(n, 0, 11))) return false;
  if (!validArray(s.lines, 2, a => Array.isArray(a) && a.length >= s.innings && a.every(n => n === null || integer(n, 0, 1000000)))) return false;
  if (!Array.isArray(s.results) || s.results.length !== s.game + (s.over ? 1 : 0) || !s.results.every(r => integer(r.opponent, 1, 3) && validArray(r.score, 2, n => integer(n, 0, 1000000)) && typeof r.win === 'boolean')) return false;
  if (!Array.isArray(s.log) || !s.log.every(l => typeof l.text === 'string' && typeof l.label === 'string' && typeof l.type === 'string')) return false;
  return typeof s.over === 'boolean' && typeof s.started === 'boolean' && validArray(s.leagueRecords, 4, r => integer(r.w, 0, 100) && integer(r.l, 0, 100));
}
export class BaseballGame {
  constructor(savedState = null, { rng = Math.random, innings = 3 } = {}) {
    this.rng = rng;
    this.state = validState(savedState) ? JSON.parse(JSON.stringify(savedState)) : newGame(0, [], undefined, innings === 9 ? 9 : 3);
  }
  get opponent() { return teams[1 + this.state.game % 3]; }
  get isBatting() { return this.state.half === 1; }
  get gameOver() { return this.state.over; }
  get batter() { const s = this.state; return this.isBatting ? roster[s.order[s.bats[1] % 9]] : visitorRosters[this.opponent.id - 1][s.bats[0] % 9]; }
  get pitcher() { return this.isBatting ? visitorPitchers[this.opponent.id - 1] : pitchers[this.state.pitchers[1]]; }
  get lineup() { return this.state.order.map(id => roster[id]); }
  get availableBench() { return roster.filter(p => !this.state.usedBatters.includes(p.id)); }
  get availablePitchers() { return pitchers.filter(p => !this.state.usedPitchers.includes(p.id)); }
  get standings() { return teams.map((t, i) => ({ ...t, ...this.state.leagueRecords[i] })).sort((a, b) => b.w - a.w || a.l - b.l || a.id - b.id); }
  serialize() { return JSON.stringify(this.state); }
  _random() { return clamp(this.rng()); }
  _ensureLine() { const s = this.state; while (s.lines[0].length < s.inning) { s.lines[0].push(null); s.lines[1].push(null); } if (s.lines[s.half][s.inning - 1] === null) s.lines[s.half][s.inning - 1] = 0; }
  _run() { this._ensureLine(); this.state.score[this.state.half]++; this.state.lines[this.state.half][this.state.inning - 1]++; }
  _advance(n) { const s = this.state; for (let i = 2; i >= 0; i--) if (s.bases[i]) { s.bases[i] = false; if (i + n >= 3) this._run(); else s.bases[i + n] = true; } if (n === 4) this._run(); else s.bases[n - 1] = true; }
  _walk() { const s = this.state; if (s.bases[0]) { if (s.bases[1]) { if (s.bases[2]) this._run(); s.bases[2] = true; } s.bases[1] = true; } s.bases[0] = true; }
  _finish() {
    const s = this.state; if (s.over) return;
    s.over = true;
    const win = s.score[1] > s.score[0], opponent = this.opponent.id;
    s.results.push({ opponent, score: [...s.score], win });
    s.leagueRecords[0][win ? 'w' : 'l']++;
    s.leagueRecords[opponent][win ? 'l' : 'w']++;
    // Every round also completes the match between the two other clubs.
    const others = teams.filter(t => t.id !== 0 && t.id !== opponent);
    const otherWinner = this._random() < .5 ? 0 : 1;
    s.leagueRecords[others[otherWinner].id].w++;
    s.leagueRecords[others[1 - otherWinner].id].l++;
  }
  _endHalf() {
    const s = this.state;
    if (s.inning >= s.innings && ((s.half === 0 && s.score[1] > s.score[0]) || (s.half === 1 && s.score[0] !== s.score[1]))) { this._finish(); return; }
    if (s.half === 1) s.inning++;
    s.half = 1 - s.half; s.outs = 0; s.balls = 0; s.strikes = 0; s.bases = [false, false, false];
  }
  _endAtBat() {
    const s = this.state; s.balls = 0; s.strikes = 0; s.bats[s.half]++;
    if (s.half === 1 && s.inning >= s.innings && s.score[1] > s.score[0]) this._finish();
    else if (s.outs === 3) this._endHalf();
  }
  _event(type, label, text, before, scoreBefore, extra = {}) {
    const s = this.state;
    const event = { type, label, text, quality: 0, bases: 0, scored: s.score[before.half] - scoreBefore, before, inningChanged: s.half !== before.half || s.inning !== before.inning, gameOver: s.over, ...extra };
    s.log.unshift({ ...event, message: text, tag: `${before.half ? 'BOT' : 'TOP'} ${before.inning}`, important: ['single','double','triple','homerun','walk','strikeout','stolen','caught'].includes(type) });
    s.log = s.log.slice(0, 60);
    return event;
  }
  _blocked(text) { return { type: 'blocked', label: 'NOT AVAILABLE', text, scored: 0, bases: 0, quality: 0, before: { half: this.state.half, inning: this.state.inning }, inningChanged: false, gameOver: this.state.over }; }
  resolvePitch({ swing = false, quality = 0, inZone = true, pitchQuality = .5, power = false } = {}) {
    const s = this.state; if (s.over) return this._blocked('This game is complete.');
    this._ensureLine(); s.started = true; s.pitches[1 - s.half]++;
    const before = { half: s.half, inning: s.inning }, scoreBefore = s.score[s.half], name = this.batter.name;
    let q = clamp(quality);
    if (!this.isBatting) {
      const fatigue = Math.max(0, s.pitches[1] - 50) * .003;
      const command = Math.max(0, clamp(pitchQuality) - fatigue);
      swing = this._random() < (inZone ? .76 : .29 - command * .18);
      q = this._random() * (.98 - command * .60);
      power = this._random() < .35;
    }
    if (!swing) {
      if (!inZone) {
        s.balls++;
        if (s.balls === 4) { this._walk(); this._endAtBat(); return this._event('walk', 'BALL FOUR', `${name} takes a walk.`, before, scoreBefore); }
        return this._event('ball', `BALL ${s.balls}`, 'Outside the zone. Ball.', before, scoreBefore);
      }
      return this._strike(name, before, scoreBefore, false);
    }
    if (!inZone) q = Math.max(0, q - .18);
    if (q < .22) return this._strike(name, before, scoreBefore, true, q);
    if (q < .40) { s.strikes = Math.min(2, s.strikes + 1); return this._event('foul', 'FOUL BALL', `${name} fouls it back.`, before, scoreBefore, { quality: q }); }
    let bases = 0;
    if (q >= .92) bases = power ? 4 : this._random() < .2 ? 3 : 2;
    else if (q >= .76) bases = power && q >= .85 && this._random() < .40 ? 4 : this._random() < .55 ? 2 : 1;
    else if (this._random() < (q >= .58 ? .50 + this.batter.contact * .002 : .24)) bases = 1;
    if (bases) {
      s.hits[s.half]++; this._advance(bases); this._endAtBat();
      const type = ['', 'single', 'double', 'triple', 'homerun'][bases], label = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'HOME RUN!'][bases];
      return this._event(type, label, `${name} connects — ${label.toLowerCase().replace('!', '')}!`, before, scoreBefore, { bases, quality: q });
    }
    s.outs++; this._endAtBat();
    return this._event('out', q >= .60 ? 'FLY OUT' : 'GROUND OUT', `${name} ${q >= .60 ? 'flies out to center' : 'grounds out to shortstop'}.`, before, scoreBefore, { quality: q });
  }
  _strike(name, before, scoreBefore, swinging, quality = 0) {
    const s = this.state; s.strikes++;
    if (s.strikes === 3) { s.outs++; this._endAtBat(); return this._event('strikeout', 'STRIKE THREE!', `${name} strikes out ${swinging ? 'swinging' : 'looking'}.`, before, scoreBefore, { quality }); }
    return this._event('strike', `STRIKE ${s.strikes}`, swinging ? 'Swing and a miss!' : 'Called strike.', before, scoreBefore, { quality });
  }
  simPitch() {
    const inZone = this._random() < .68;
    return this.resolvePitch({ inZone, swing: this._random() < (inZone ? .76 : .20), quality: this._random(), power: this._random() < .35, pitchQuality: this._random() * .7 });
  }
  simHalf() {
    const s = this.state, half = s.half, inning = s.inning; let event = null, count = 0;
    while (!s.over && s.half === half && s.inning === inning && count++ < 600) event = this.simPitch();
    return event;
  }
  steal() {
    const s = this.state; if (s.over || !this.isBatting || !s.bases[0] || s.bases[1]) return this._blocked('Steal with a runner on first and second base empty.');
    const before = { half: s.half, inning: s.inning }, scoreBefore = s.score[s.half]; s.bases[0] = false; s.started = true;
    if (this._random() < .68) { s.bases[1] = true; return this._event('stolen', 'STOLEN BASE!', 'The runner slides safely into second.', before, scoreBefore); }
    s.outs++; if (s.outs === 3) this._endHalf();
    return this._event('caught', 'CAUGHT STEALING', 'The catcher throws the runner out at second.', before, scoreBefore);
  }
  reorder(index, delta) {
    const s = this.state, target = index + delta;
    if (s.started || !integer(index, 0, 8) || ![-1, 1].includes(delta) || !integer(target, 0, 8)) return false;
    [s.order[index], s.order[target]] = [s.order[target], s.order[index]];
    return true;
  }
  substitutePitcher(id) {
    const s = this.state; if (s.over || !this.availablePitchers.some(p => p.id === id)) return false;
    s.pitchers[1] = id; s.usedPitchers.push(id); s.pitches[1] = 0; return true;
  }
  substituteBatter(id) {
    const s = this.state; if (s.over || !this.availableBench.some(p => p.id === id)) return false;
    s.order[s.bats[1] % 9] = id; s.usedBatters.push(id); return true;
  }
  nextGame() {
    const s = this.state; if (!s.over || s.game >= 11) return false;
    this.state = newGame(s.game + 1, s.results, s.order, s.innings, s.leagueRecords); return true;
  }
  reset(innings = this.state.innings) { this.state = newGame(0, [], undefined, innings === 9 ? 9 : 3); }
}
