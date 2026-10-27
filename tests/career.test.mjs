import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseballGame, roster, pitchers } from '../engine.js';

const seeded = (seed = 42) => () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296);
function career(style='scout',seed=42) {
  const game=new BaseballGame(null,{rng:seeded(seed)});
  assert.equal(game.createCareer({name:'Coach Jordan',appearance:2,style}),true);
  return game;
}
function completeGame(g) {
  let halves=0;
  while(!g.gameOver&&halves++<100)g.simHalf();
  assert.ok(g.gameOver,'a career game must finish');
  assert.ok(halves<100);
}
function completeSeason(g) {
  for(let i=0;i<12;i++) {
    completeGame(g);
    assert.deepEqual(new BaseballGame(JSON.parse(g.serialize())).state,g.state);
    if(i<11)assert.equal(g.nextGame(),true);
  }
}
function walkOff(g) {
  Object.assign(g.state,{inning:g.state.innings,half:1,score:[0,0],bases:[false,false,false],balls:0,strikes:0});
  return g.resolvePitch({swing:true,quality:1,inZone:true,power:true});
}

test('career creation saves the manager and starts a genuinely weak roster',()=>{
  const g=career();
  assert.equal(g.career.manager.name,'Coach Jordan');
  assert.equal(g.career.manager.appearance,2);
  assert.equal(g.career.season,1);
  assert.deepEqual(g.career.previousRecord,{wins:2,losses:10});
  assert.equal(g.homeRoster.length,12);
  assert.equal(g.homePitchers.length,3);
  assert.ok(g.teamRating.overall<55);
  assert.ok(g.homeRoster.every((p,i)=>p.contact<roster[i].contact&&p.power<roster[i].power));
  assert.ok(g.homePitchers.every((p,i)=>p.control<pitchers[i].control));
  assert.equal(g.career.picks,3);
  const recruits=[...g.career.prospects,...g.career.tradeOffers];
  assert.equal(new Set(recruits.map(r=>r.player.name)).size,recruits.length);
  assert.equal(g.canManage,true);
});

test('manager styles provide their stated distinct benefits',()=>{
  const scout=career('scout'),dev=career('developer'),tact=career('tactician');
  assert.equal(scout.career.picks,3);
  assert.equal(dev.career.picks,2);
  assert.equal(tact.career.picks,2);
  assert.equal(scout.career.credits,14);
  assert.equal(dev.career.credits,14);
  assert.equal(tact.career.credits,20);
  assert.equal(goodCreate({name:'  Coach\t Fox\n  '}).career.manager.name,'Coach Fox');
  function goodCreate(options){const g=new BaseballGame();assert.equal(g.createCareer(options),true);return g;}
});

test('invalid manager creation does not erase the existing game',()=>{
  const g=career(),original=g.serialize();
  for(const options of [{name:''},{name:'   '},{name:'Coach',style:'unknown'},{name:'Coach',appearance:99}]) {
    assert.equal(g.createCareer(options),false);
    assert.equal(g.serialize(),original);
  }
  assert.equal(g.createCareer({name:'<Coach> Very Long Baseball Manager Name'}),true);
  assert.equal(g.career.manager.name.length,24);
  assert.ok(!/[<>]/.test(g.career.manager.name));
});

test('drafting upgrades a real batting slot, consumes one pick, and cannot repeat',()=>{
  const g=career(),before=g.teamRating.overall,picks=g.career.picks,prospect=g.career.prospects.find(p=>p.player.type==='batter');
  const result=g.draftPlayer(prospect.id,0);
  assert.equal(result.ok,true);
  assert.equal(g.homeRoster[0].name,prospect.player.name);
  assert.equal(g.homeRoster[0].id,0);
  assert.equal(g.lineup[0].name,prospect.player.name);
  assert.equal(g.career.picks,picks-1);
  assert.ok(g.teamRating.overall>before);
  assert.equal(g.draftPlayer(prospect.id,1).ok,false);
  assert.equal(g.career.picks,picks-1);
  assert.equal(g.career.transactions[0].kind,'draft');
});

test('pitching draft and trade players appear in the real mound getter',()=>{
  const g=career(),prospect=g.career.prospects.find(p=>p.player.type==='pitcher');
  assert.equal(g.draftPlayer(prospect.id,11).ok,false);
  assert.equal(g.draftPlayer(prospect.id,0).ok,true);
  assert.equal(g.pitcher.name,prospect.player.name);
  const offer=g.career.tradeOffers.find(o=>o.player.type==='pitcher');
  const cost=g.tradePrice(offer.id,0),money=g.career.credits;
  assert.ok(cost<=money);
  assert.equal(g.tradePlayer(offer.id,0).ok,true);
  assert.equal(g.pitcher.name,offer.player.name);
  assert.equal(g.career.credits,money-cost);
});

test('drafts and trades respect picks, affordability, availability, and roster size',()=>{
  const g=career('developer');
  const selected=g.career.prospects.filter(p=>p.player.type==='batter');
  assert.equal(g.draftPlayer('missing',0).ok,false);
  assert.equal(g.draftPlayer(selected[0].id,999).ok,false);
  assert.equal(g.draftPlayer(selected[0].id,0).ok,true);
  assert.equal(g.draftPlayer(selected[1].id,1).ok,true);
  assert.equal(g.career.picks,0);
  assert.equal(g.draftPlayer(selected[2].id,2).ok,false);
  const offer=g.career.tradeOffers.find(o=>o.player.type==='batter'),cost=g.tradePrice(offer.id,0);
  assert.ok(cost>0);
  g.career.credits=cost-1;
  const original=g.serialize();
  assert.equal(g.tradePlayer(offer.id,0).ok,false);
  assert.equal(g.serialize(),original);
  g.career.credits=cost;
  assert.equal(g.tradePlayer(offer.id,0).ok,true);
  assert.equal(g.career.credits,0);
  assert.equal(g.homeRoster[0].name,offer.player.name);
  assert.equal(g.tradePlayer(offer.id,1).ok,false);
  assert.equal(g.tradePrice(offer.id,1),null);
  assert.equal(g.homeRoster.length,12);
  assert.equal(g.homePitchers.length,3);
});

test('front office locks at first pitch and reopens between games',()=>{
  const g=career(),draft=g.career.prospects[0],trade=g.career.tradeOffers[0];
  g.resolvePitch({inZone:false,pitchQuality:0});
  assert.equal(g.canManage,false);
  const money=g.career.credits,picks=g.career.picks;
  assert.equal(g.draftPlayer(draft.id,0).ok,false);
  assert.equal(g.tradePlayer(trade.id,0).ok,false);
  assert.equal(g.career.credits,money);
  assert.equal(g.career.picks,picks);
  walkOff(g);
  assert.equal(g.canManage,true);
  assert.equal(g.draftPlayer(draft.id,0).ok,true);
  assert.equal(g.nextGame(),true);
  assert.equal(g.homeRoster[0].name,draft.player.name);
  assert.equal(g.state.pitches[1],0);
});

test('completed games and goals award credits once, including across save restore',()=>{
  const g=career(),money=g.career.credits;
  assert.equal(walkOff(g).type,'homerun');
  assert.equal(g.career.credits,money+4+3); // win payout plus first-win goal
  assert.equal(g.career.goals.find(g=>g.id==='first-win').claimed,true);
  const restored=new BaseballGame(JSON.parse(g.serialize()),{rng:seeded(4)}),after=restored.career.credits;
  assert.equal(restored.resolvePitch({swing:true,quality:1}).type,'blocked');
  assert.equal(restored.career.credits,after);
  restored.nextGame();walkOff(restored);
  assert.equal(restored.career.credits,after+4);
});

test('better career players change actual contact and pitching outcomes',()=>{
  function swingWith(contact) {
    const g=career();g.state.half=1;g.homeRoster[0].contact=contact;
    return g.resolvePitch({swing:true,inZone:true,quality:.52,power:false}).quality;
  }
  assert.ok(swingWith(90)>swingWith(37));
  function aiContact(control,velocity) {
    const g=career();g.rng=()=>.5;g.homePitchers[0].control=control;g.homePitchers[0].velocity=velocity;
    return g.resolvePitch({inZone:true,pitchQuality:.5}).quality;
  }
  assert.ok(aiContact(90,90)<aiContact(40,40));
  const g=career();g.state.half=1;
  assert.equal(g.resolvePitch({swing:true,quality:1,inZone:true,power:true}).type,'homerun','perfect human timing still receives a full reward');
});

test('career save restore preserves drafts, trades, finances, and player slots',()=>{
  const g=career('tactician');g.draftPlayer(g.career.prospects[0].id,3);
  const offer=g.career.tradeOffers.find(o=>o.player.type==='batter');
  assert.equal(g.tradePlayer(offer.id,3).ok,true);
  const restored=new BaseballGame(JSON.parse(g.serialize()));
  assert.deepEqual(restored.state,g.state);
  assert.deepEqual(restored.lineup,g.lineup);
  assert.deepEqual(restored.teamRating,g.teamRating);
  assert.equal(restored.career.manager.style,'tactician');
});

test('malformed career saves fall back safely while legacy games remain supported',()=>{
  const g=career();
  for(const corrupt of [
    s=>s.career.batters[0].id=999,
    s=>s.career.pitchers[0].control=-4,
    s=>s.career.prospects[0].player.name=null,
    s=>s.career.credits=-1,
    s=>s.career.manager.appearance=9,
  ]) {
    const state=JSON.parse(g.serialize());corrupt(state);
    const restored=new BaseballGame(state);
    assert.equal(restored.career,null);assert.equal(restored.state.game,0);
  }
  const legacy=new BaseballGame();legacy.reorder(0,1);
  const restored=new BaseballGame(JSON.parse(legacy.serialize()));
  assert.deepEqual(restored.state,legacy.state);
  assert.equal(restored.career,null);
});

test('offseason retains the manager and signings, develops players, and renews draft/trades',()=>{
  const g=career('developer');
  assert.equal(g.beginNextSeason().ok,false);
  const prospect=g.career.prospects[0];g.draftPlayer(prospect.id,0);
  const name=g.homeRoster[0].name,contact=g.homeRoster[0].contact;
  completeSeason(g);
  assert.equal(g.canManage,false);
  assert.equal(g.draftPlayer(g.career.prospects[1].id,1).ok,false);
  const credits=g.career.credits,manager={...g.career.manager};
  assert.equal(g.beginNextSeason().ok,true);
  assert.deepEqual(g.career.manager,manager);
  assert.equal(g.career.season,2);
  assert.equal(g.career.picks,2);
  assert.equal(g.career.credits,credits);
  assert.equal(g.homeRoster[0].name,name);
  assert.equal(g.homeRoster[0].contact,contact+4);
  assert.equal(g.state.game,0);
  assert.equal(g.state.results.length,0);
  assert.equal(g.career.history.length,1);
  assert.equal(g.career.history[0].wins+g.career.history[0].losses,12);
  assert.ok(g.career.prospects.every(p=>!p.taken&&p.id.startsWith('s2-')));
  assert.ok(g.career.tradeOffers.every(p=>!p.taken&&p.id.startsWith('s2-')));
  assert.equal(g.canManage,true);
  assert.deepEqual(new BaseballGame(JSON.parse(g.serialize())).state,g.state);
});

test('multiple complete career seasons preserve baseball, finances, and development invariants',()=>{
  for(let seed=1;seed<=10;seed++){
    const g=career(['scout','developer','tactician'][seed%3],seed);
    for(let season=1;season<=3;season++) {
      const p=g.career.prospects.find(p=>p.player.type==='pitcher');g.draftPlayer(p.id,0);
      for(let game=0;game<12;game++) {
        completeGame(g);
        assert.ok(g.career.credits>=0);
        for(let team=0;team<2;team++)assert.equal(g.state.lines[team].reduce((n,v)=>n+(v||0),0),g.state.score[team]);
        assert.deepEqual(new BaseballGame(JSON.parse(g.serialize())).state,g.state);
        if(game<11)g.nextGame();
      }
      assert.equal(g.career.season,season);
      assert.equal(g.state.results.length,12);
      if(season<3){assert.equal(g.beginNextSeason().ok,true);assert.equal(g.career.history.length,season);}
    }
  }
});
