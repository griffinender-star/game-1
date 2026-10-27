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
function playerOverall(p) {
  return Math.round(p.type === 'pitcher' ? (p.control + p.velocity) / 2 : (p.contact + p.power + p.speed) / 3);
}
const playerStats = type => type === 'pitcher' ? ['control', 'velocity'] : ['contact', 'power', 'speed'];
const makePlayer = p => ({ ...p, overall: playerOverall(p) });
function careerRecruit(index, season, type, veteran = false) {
  const first = ['Mateo','Kai','Noah','Jules','Ezra','Owen','Leo','Nico','Milo','Rory','Eli','Theo'];
  const last = ['Santos','Mercer','Dawson','Nakamura','Bennett','Cruz','Walker','Ramirez','Park','Hayes','Ellis','Reyes'];
  const seed = index + season * 5, base = veteran ? 75 : 67;
  const common = { type, name: `${first[seed % first.length]} ${last[(seed * 5 + index + (veteran ? 3 : 0)) % last.length]}`, pos: type === 'pitcher' ? 'P' : positions[index % 9], age: veteran ? 26 + index % 5 : 18 + index % 5, potential: 90 + seed % 10 };
  if (type === 'pitcher') return makePlayer({ ...common, control: base + (seed * 7) % 13, velocity: base + (seed * 11) % 15 });
  return makePlayer({ ...common, contact: base + (seed * 7) % 15, power: base - 2 + (seed * 11) % 17, speed: base + (seed * 3) % 13 });
}
function recruitment(season) {
  return {
    prospects: Array.from({ length: 8 }, (_, i) => ({ id: `s${season}-draft-${i}`, player: careerRecruit(i, season, i % 4 === 2 ? 'pitcher' : 'batter'), taken: false })),
    tradeOffers: Array.from({ length: 6 }, (_, i) => ({ id: `s${season}-trade-${i}`, player: careerRecruit(i + 8, season, i % 3 === 1 ? 'pitcher' : 'batter', true), team: { ...teams[1 + i % 3] }, taken: false })),
  };
}
function newCareer(name, appearance, style) {
  return {
    manager: { name, appearance, style }, season: 1, credits: style === 'tactician' ? 20 : 14, picks: style === 'scout' ? 3 : 2,
    batters: roster.map(p => makePlayer({ ...p, type: 'batter', contact: 37 + (p.id * 7) % 20, power: 35 + (p.id * 11) % 19, speed: 40 + (p.id * 5) % 20, age: 28 + p.id % 7, potential: 65 + p.id % 16 })),
    pitchers: pitchers.map(p => makePlayer({ ...p, type: 'pitcher', pos: 'P', control: [43,49,39][p.id], velocity: [58,49,63][p.id], age: 30 + p.id, potential: 72 + p.id * 3 })),
    ...recruitment(1), history: [], transactions: [], previousRecord: { wins: 2, losses: 10 },
    goals: [
      { id:'first-win', label:'Get your first win', target:1, progress:0, complete:false, reward:3, claimed:false },
      { id:'club-60', label:'Build a 60 OVR club', target:60, progress:0, complete:false, reward:6, claimed:false },
      { id:'five-wins', label:'Win five games in a season', target:5, progress:0, complete:false, reward:8, claimed:false },
    ],
  };
}
function validPlayer(p, type, id = null) {
  return p && p.type === type && (id === null || p.id === id) && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 60 && typeof p.pos === 'string' && p.pos.length <= 5 && playerStats(type).every(n => integer(p[n], 0, 99)) && integer(p.overall, 0, 99) && p.overall === playerOverall(p) && integer(p.age, 16, 90) && integer(p.potential, 0, 99);
}
function validRecruit(r) {
  return r && typeof r.id === 'string' && r.id.length < 50 && typeof r.taken === 'boolean' && ['batter','pitcher'].includes(r.player?.type) && validPlayer(r.player, r.player.type);
}
function validCareer(c) {
  if (!c || !c.manager || typeof c.manager.name !== 'string' || !c.manager.name.trim() || c.manager.name.length > 24 || !integer(c.manager.appearance, 0, 3) || !['scout','developer','tactician'].includes(c.manager.style)) return false;
  if (!integer(c.season,1,10000) || !integer(c.credits,0,1000000) || !integer(c.picks,0,3) || !validArray(c.batters,12,(p)=>validPlayer(p,'batter',p?.id)) || !c.batters.every((p,i)=>p.id===i) || !validArray(c.pitchers,3,(p)=>validPlayer(p,'pitcher',p?.id)) || !c.pitchers.every((p,i)=>p.id===i)) return false;
  if (!validArray(c.prospects,8,validRecruit) || !validArray(c.tradeOffers,6,r=>validRecruit(r)&&r.team&&integer(r.team.id,1,3))) return false;
  if (new Set([...c.prospects,...c.tradeOffers].map(r=>r.id)).size !== 14) return false;
  if (!Array.isArray(c.history) || !c.history.every(h=>integer(h.season,1,10000)&&integer(h.wins,0,12)&&integer(h.losses,0,12)&&h.wins+h.losses===12&&integer(h.rank,1,4)&&integer(h.overall,0,99))) return false;
  if (!Array.isArray(c.transactions) || c.transactions.length>100 || !c.transactions.every(t=>t&&integer(t.season,1,10000)&&typeof t.text==='string'&&typeof t.kind==='string'&&integer(t.game,0,11))) return false;
  return validArray(c.goals,3,g=>g&&typeof g.id==='string'&&typeof g.label==='string'&&integer(g.target,1,100)&&integer(g.progress,0,100)&&typeof g.complete==='boolean'&&integer(g.reward,0,100)&&typeof g.claimed==='boolean');
}
function validState(s) {
  if (!s || s.version !== 2 || ![3, 9].includes(s.innings)) return false;
  if (s.career != null && !validCareer(s.career)) return false;
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
  get career() { return this.state.career || null; }
  get homeRoster() { return this.career?.batters || roster; }
  get homePitchers() { return this.career?.pitchers || pitchers; }
  get canManage() { return Boolean(this.career && (!this.state.started || this.state.over) && !(this.state.over && this.state.game === 11)); }
  get teamRating() {
    const batting = Math.round(this.homeRoster.reduce((n,p)=>n+(p.type?playerOverall(p):(p.contact+p.power+p.speed)/3),0)/12);
    const pitching = Math.round(this.homePitchers.reduce((n,p)=>n+(p.control+p.velocity)/2,0)/3);
    return {batting,pitching,overall:Math.round((batting*2+pitching)/3)};
  }
  get opponent() { return teams[1 + this.state.game % 3]; }
  get isBatting() { return this.state.half === 1; }
  get gameOver() { return this.state.over; }
  get batter() { const s = this.state; return this.isBatting ? this.homeRoster[s.order[s.bats[1] % 9]] : visitorRosters[this.opponent.id - 1][s.bats[0] % 9]; }
  get pitcher() { return this.isBatting ? visitorPitchers[this.opponent.id - 1] : this.homePitchers[this.state.pitchers[1]]; }
  get lineup() { return this.state.order.map(id => this.homeRoster[id]); }
  get availableBench() { return this.homeRoster.filter(p => !this.state.usedBatters.includes(p.id)); }
  get availablePitchers() { return this.homePitchers.filter(p => !this.state.usedPitchers.includes(p.id)); }
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
    if (this.career) {
      const earned=2+(win?2:0)+(s.game===11?5:0);
      this.career.credits+=earned;
      this._transaction('reward',`${win?'Win':'Game complete'}: +${earned} club credits.`);
      this._updateGoals();
    }
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
    if (this.career && this.isBatting && q > .1 && q < .985) q=clamp(q+(this.batter.contact-65)*.0025);
    if (!this.isBatting) {
      const fatigue = Math.max(0, s.pitches[1] - 50) * .003;
      const ability=this.career?(this.pitcher.control+this.pitcher.velocity)/200:1;
      const command = Math.max(0, (this.career ? clamp(pitchQuality)*.65+ability*.35 : clamp(pitchQuality)) - fatigue);
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
    if (this.career && this.isBatting && bases===4 && quality<.985 && this._random()>this.batter.power/100) bases=2;
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
    const stealChance=this.career ? .35+this.homeRoster.reduce((n,p)=>n+p.speed,0)/1200*.45 : .68;
    if (this._random() < stealChance) { s.bases[1] = true; return this._event('stolen', 'STOLEN BASE!', 'The runner slides safely into second.', before, scoreBefore); }
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
    this.state = newGame(s.game + 1, s.results, s.order, s.innings, s.leagueRecords);
    if(s.career)this.state.career=s.career;
    return true;
  }
  createCareer({ name, appearance = 0, style = 'scout', innings = 3 } = {}) {
    const clean = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().replace(/\s+/g,' ').slice(0,24) : '';
    if (!clean || !integer(appearance,0,3) || !['scout','developer','tactician'].includes(style)) return false;
    this.state = newGame(0,[],undefined,innings===9?9:3);
    this.state.career = newCareer(clean,appearance,style);
    this._updateGoals();
    this._transaction('hired',`${clean} takes over the Knights after a 2–10 season.`);
    return true;
  }
  _transaction(kind,text) {
    if(!this.career)return;
    this.career.transactions.unshift({season:this.career.season,game:this.state.game,kind,text});
    this.career.transactions=this.career.transactions.slice(0,100);
  }
  _updateGoals() {
    if(!this.career)return;
    const wins=this.state.results.filter(r=>r.win).length;
    for(const goal of this.career.goals) {
      const current=goal.id==='club-60'?this.teamRating.overall:goal.id==='first-win'?Math.min(1,wins):wins;
      goal.progress=Math.min(goal.target,Math.max(goal.progress,current));
      goal.complete=goal.progress>=goal.target;
      if(goal.complete&&!goal.claimed) {
        goal.claimed=true;this.career.credits+=goal.reward;
        this._transaction('reward',`${goal.label}: +${goal.reward} club credits.`);
      }
    }
  }
  _signPlayer(player,slot) {
    const list=player.type==='pitcher'?this.career.pitchers:this.career.batters;
    const signed=makePlayer({...player,id:slot});list[slot]=signed;
    this._updateGoals();return signed;
  }
  draftPlayer(prospectId,replacementId) {
    if(!this.canManage)return {ok:false,message:'Make roster moves between games. Start the next season after the finale.'};
    const c=this.career,p=c.prospects.find(p=>p.id===prospectId);
    if(!p||p.taken)return {ok:false,message:'That prospect is no longer on the board.'};
    if(c.picks<1)return {ok:false,message:'You have used this season’s draft picks.'};
    const limit=p.player.type==='pitcher'?2:11;
    if(!integer(replacementId,0,limit))return {ok:false,message:'Choose a valid roster player to replace.'};
    const list=p.player.type==='pitcher'?c.pitchers:c.batters;
    const outgoing=list[replacementId].name;
    p.taken=true;c.picks--;
    const player=this._signPlayer(p.player,replacementId);
    const message=`Drafted ${player.name}. ${outgoing} leaves the club.`;
    this._transaction('draft',message);
    return {ok:true,message,player};
  }
  tradePrice(offerId,outgoingId) {
    if(!this.career)return null;
    const offer=this.career.tradeOffers.find(o=>o.id===offerId);
    if(!offer||offer.taken)return null;
    const list=offer.player.type==='pitcher'?this.career.pitchers:this.career.batters;
    if(!integer(outgoingId,0,list.length-1))return null;
    return Math.max(2,Math.ceil((playerOverall(offer.player)-playerOverall(list[outgoingId]))*.38)+3);
  }
  tradePlayer(offerId,outgoingId) {
    if(!this.canManage)return {ok:false,message:'Make roster moves between games. Start the next season after the finale.'};
    const c=this.career,offer=c.tradeOffers.find(o=>o.id===offerId),cost=this.tradePrice(offerId,outgoingId);
    if(!offer||offer.taken||cost===null)return {ok:false,message:'That trade is no longer available.'};
    if(c.credits<cost)return {ok:false,message:`This deal needs ${cost} credits. Play games to earn more.`};
    const list=offer.player.type==='pitcher'?c.pitchers:c.batters,outgoing=list[outgoingId].name;
    c.credits-=cost;offer.taken=true;
    const player=this._signPlayer(offer.player,outgoingId);
    const message=`Traded ${outgoing} and ${cost} credits to ${offer.team.name} for ${player.name}.`;
    this._transaction('trade',message);
    return {ok:true,message,player,cost};
  }
  beginNextSeason() {
    const s=this.state,c=this.career;
    if(!c||!s.over||s.game!==11)return {ok:false,message:'Finish all twelve games before the offseason.'};
    const wins=s.results.filter(r=>r.win).length;
    c.history.push({season:c.season,wins,losses:12-wins,rank:this.standings.findIndex(t=>t.id===0)+1,overall:this.teamRating.overall});
    const growth=c.manager.style==='developer'?4:2;
    for(const player of [...c.batters,...c.pitchers]) {
      for(const stat of playerStats(player.type))player[stat]=Math.min(99,Math.max(player[stat],Math.min(player.potential,player[stat]+growth)));
      player.age=Math.min(90,player.age+1);player.overall=playerOverall(player);
    }
    c.season++;c.picks=2;Object.assign(c,recruitment(c.season));
    this.state=newGame(0,[],s.order,s.innings);this.state.career=c;
    this._updateGoals();
    const message=`Season ${c.season}: your players trained (+${growth} ratings up to potential). Two new draft picks are ready.`;
    this._transaction('training',message);
    return {ok:true,message};
  }
  reset(innings = this.state.innings) { this.state = newGame(0, [], undefined, innings === 9 ? 9 : 3); }
}
