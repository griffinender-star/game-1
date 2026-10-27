import test from 'node:test';
import assert from 'node:assert/strict';
// Load browser-native ES module without requiring a package.json build tool.
import { readFile } from 'node:fs/promises';
const { BaseballGame, roster } = await import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL('../engine.js', import.meta.url), 'utf8')).toString('base64')}`);
const seeded = (seed = 14) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
function batting(overrides = {}, rng = () => .5) { const g = new BaseballGame(null, { rng }); Object.assign(g.state, { half: 1, ...overrides }); return g; }
test('a bases-loaded walk forces exactly one run and resets the count', () => {
  const g = batting({ balls: 3, bases: [true, true, true] }); const e = g.resolvePitch({ swing: false, inZone: false });
  assert.equal(e.type, 'walk'); assert.equal(e.scored, 1); assert.deepEqual(g.state.bases, [true, true, true]); assert.deepEqual(g.state.score, [0, 1]); assert.equal(g.state.balls, 0);
});
test('taking a strike with two strikes retires the batter; third out clears bases', () => {
  const g = batting({ strikes: 2, outs: 2, bases: [true, false, false] }); const e = g.resolvePitch({ swing: false, inZone: true });
  assert.equal(e.type, 'strikeout'); assert.equal(e.inningChanged, true); assert.equal(g.state.inning, 2); assert.equal(g.state.half, 0); assert.deepEqual(g.state.bases, [false, false, false]); assert.equal(g.state.outs, 0);
});
test('fouls cannot cause a third strike', () => { const g = batting({ strikes: 2 }); assert.equal(g.resolvePitch({ swing: true, quality: .3, inZone: true }).type, 'foul'); assert.equal(g.state.strikes, 2); assert.equal(g.state.outs, 0); });
test('direct swing timing and power determine contact', () => {
  const miss = batting(), perfect = batting();
  assert.equal(miss.resolvePitch({ swing: true, quality: 0, inZone: true }).type, 'strike');
  assert.equal(perfect.resolvePitch({ swing: true, quality: 1, inZone: true, power: true }).type, 'homerun');
  assert.deepEqual(perfect.state.score, [0, 1]);
});
test('walk-off grand slam records all four runs and finishes only once', () => {
  const g = batting({ inning: 3, bases: [true, true, true] });
  const e = g.resolvePitch({ swing: true, quality: 1, inZone: true, power: true });
  assert.equal(e.scored, 4); assert.equal(e.gameOver, true); assert.equal(g.state.results.length, 1); assert.equal(g.state.results[0].win, true); assert.deepEqual(g.state.score, [0, 4]);
  assert.equal(g.resolvePitch({ swing: true, quality: 1 }).type, 'blocked'); assert.equal(g.state.results.length, 1);
});
test('ties enter extra innings, a home lead skips the last bottom half', () => {
  const tie = batting({ inning: 3, outs: 2, strikes: 2, score: [2, 2] });
  tie.resolvePitch({ swing: false, inZone: true }); assert.equal(tie.state.inning, 4); assert.equal(tie.state.over, false);
  const lead = new BaseballGame(null, { rng: () => .99 }); Object.assign(lead.state, { inning: 3, outs: 2, strikes: 2, score: [0, 1] });
  lead.resolvePitch({ inZone: true, pitchQuality: 1 }); assert.equal(lead.state.over, true); assert.equal(lead.state.half, 0);
});
test('caught stealing on third out preserves batting-order position', () => {
  const g = batting({ outs: 2, bats: [0, 4], bases: [true, false, false] }, () => .99); assert.equal(g.steal().type, 'caught'); assert.equal(g.state.half, 0); assert.equal(g.state.bats[1], 4); assert.equal(g.state.inning, 2);
});
test('successful stealing and illegal stealing do not change the count', () => {
  const g = batting({ balls: 2, strikes: 1, bases: [true, false, false] }, () => .1); assert.equal(g.steal().type, 'stolen'); assert.deepEqual(g.state.bases, [false, true, false]); assert.equal(g.state.balls, 2); assert.equal(g.steal().type, 'blocked');
});
test('substitutes cannot re-enter, batting order locks after play starts', () => {
  const g = batting(); assert.equal(g.reorder(0, 1), true); assert.equal(g.state.order[0], 1); g.resolvePitch({ swing: false, inZone: false }); assert.equal(g.reorder(0, 1), false);
  assert.equal(g.substitutePitcher(1), true); assert.equal(g.substitutePitcher(0), false); assert.equal(g.substitutePitcher(1), false);
  const replaced = g.state.order[0]; assert.equal(g.substituteBatter(9), true); assert.equal(g.substituteBatter(replaced), false); assert.equal(g.state.order[0], 9);
});
test('twelve-game season completes, standings account for every club, and saves restore', () => {
  const g = new BaseballGame(null, { rng: seeded(24) });
  for (let game = 0; game < 12; game++) { let halves = 0; while (!g.gameOver && halves++ < 100) g.simHalf(); assert.equal(g.gameOver, true); assert.ok(halves < 100); assert.notEqual(g.state.score[0], g.state.score[1]); assert.equal(g.state.results.length, game + 1); if (game < 11) assert.equal(g.nextGame(), true); }
  assert.equal(g.nextGame(), false); assert.equal(g.standings.reduce((sum, t) => sum + t.w, 0), 24); for (const t of g.standings) assert.equal(t.w + t.l, 12);
  const restored = new BaseballGame(JSON.parse(g.serialize())); assert.deepEqual(restored.state, g.state); assert.notEqual(restored.batter.name, undefined);
});
test('nine-inning option and corrupt saves are handled', () => { const g = new BaseballGame(null, { innings: 9 }); assert.equal(g.state.innings, 9); const bad = { ...g.state, order: [999] }; const restored = new BaseballGame(bad); assert.equal(restored.state.innings, 3); assert.equal(restored.state.order.length, 9); assert.equal(roster.length, 12); });
test('high command suppresses AI offense compared with poor command', () => {
  function runs(command) { const g = new BaseballGame(null, { rng: seeded(77) }); let total = 0; for (let i = 0; i < 1000; i++) { if (g.state.over) g.reset(); g.state.half = 0; const scoreBefore = g.state.score[0]; g.resolvePitch({ inZone: true, pitchQuality: command }); total += g.state.score[0] - scoreBefore; } return total; }
  assert.ok(runs(0) > runs(1));
});
test('nine-inning games complete and fifty seeded seasons preserve baseball invariants', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = new BaseballGame(null, { rng: seeded(seed), innings: seed === 1 ? 9 : 3 });
    for (let game = 0; game < 12; game++) {
      let halves = 0;
      while (!g.gameOver && halves++ < 100) {
        g.simHalf();
        assert.ok(g.state.outs >= 0 && g.state.outs <= 3);
        assert.ok(g.state.strikes <= 2 && g.state.balls <= 3);
        for (let team = 0; team < 2; team++) assert.equal(g.state.lines[team].reduce((sum, n) => sum + (n || 0), 0), g.state.score[team]);
      }
      assert.ok(g.gameOver, `seed ${seed}, game ${game} did not finish`);
      assert.notEqual(g.state.score[0], g.state.score[1]);
      assert.deepEqual(new BaseballGame(JSON.parse(g.serialize())).state, g.state);
      if (game < 11) g.nextGame();
    }
  }
});
