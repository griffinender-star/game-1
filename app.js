import { BaseballGame, teams, roster, pitchers } from './engine.js';
import { Stadium, FIELD } from './stadium.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'pixel-dugout-v2';
let saved;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* Private browsing can disable storage. */ }
const game = new BaseballGame(saved);
const stadium = new Stadium($('gameCanvas'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pitchTypes = [{ name:'FASTBALL', speed:93, duration:1450 }, { name:'CURVEBALL', speed:78, duration:1750 }, { name:'SLIDER', speed:85, duration:1600 }];
let selectedPitch = 0, power = false, muted = false, paused = false, activeScreen = 'game', lastFocus;
let aim = { x:182, y:313 }, chargingPointer = null, aimingPointer = null, intro = true;
let play = { phase:'ready', elapsed:0 }, lastFrame = performance.now(), sessionTime = 0, audio;

function persist() {
  try { localStorage.setItem(SAVE_KEY,game.serialize()); $('saveStatus').textContent = '✓ SAVED'; }
  catch { $('saveStatus').textContent = 'SAVE UNAVAILABLE'; }
}
function tone(kind='pitch') {
  if(muted) return;
  try {
    const A=window.AudioContext||window.webkitAudioContext;
    audio ||= new A(); audio.resume();
    const o=audio.createOscillator(), g=audio.createGain(), t=audio.currentTime;
    o.type='square'; o.frequency.setValueAtTime(kind==='hit'?660:kind==='miss'?170:350,t);
    o.frequency.exponentialRampToValueAtTime(kind==='hit'?990:120,t+.10);
    g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
    o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.17);
  } catch { /* Sound is optional. */ }
}
function haptic(pattern=12) { if(navigator.vibrate) navigator.vibrate(pattern); }
function isIdle() { return play.phase==='ready' && !paused && !game.gameOver && activeScreen==='game'; }
function showOverlay(kicker,title,show=true) {
  $('overlayKicker').textContent=kicker; $('overlayTitle').textContent=title;
  $('playOverlay').classList.toggle('hidden',!show);
}
function resetPlay(showIntro=false) {
  play={phase:'ready',elapsed:0}; chargingPointer=null; $('mainAction').classList.remove('holding');
  intro=showIntro; render();
}
function charge() {
  if(!isIdle()||game.isBatting)return;
  intro=false; play={phase:'charge',elapsed:0,offense:false};
  $('mainAction').classList.add('holding');showOverlay('','',false);tone();renderControls();
}
function release() {
  if(play.phase!=='charge'||paused)return;
  const p=chargeValue(),quality=clamp(1-Math.abs(p-.75)/.6,0,1);
  const target={...aim};
  // A poor release moves the pitch away from the chosen target.
  const error=(1-quality)*22;
  target.x+=(Math.random()-.5)*error;target.y+=(Math.random()-.5)*error;
  launch({offense:false,target,pitchQuality:quality,duration:pitchTypes[selectedPitch].duration,release:quality});
}
function chargeValue() { return (1-Math.cos(play.elapsed/1450*Math.PI*2))/2; }
function readyToBat() {
  if(!isIdle()||!game.isBatting)return;
  const inZone=Math.random()>.24;
  const target={x:174+Math.random()*19,y:286+Math.random()*54};
  if(!inZone){target.y=Math.random()>.5?FIELD.zone.y-23:FIELD.zone.y+FIELD.zone.h+21;}
  launch({offense:true,target,pitchQuality:.5,duration:1550+Math.random()*180,release:.5});
}
function launch(options) {
  chargingPointer=null;intro=false;
  const z=FIELD.zone;
  play={...options,phase:'pitch',elapsed:0,swung:false,quality:0,swingAt:-1,
    inZone: options.target.x>=z.x&&options.target.x<=z.x+z.w&&options.target.y>=z.y&&options.target.y<=z.y+z.h,
    power, pitchType:selectedPitch};
  $('mainAction').classList.remove('holding');showOverlay('','',false);tone('pitch');renderControls();
}
function swing() {
  if(paused||play.phase!=='pitch'||!play.offense||play.swung)return;
  play.swung=true;play.swingAt=play.elapsed;
  const distance=Math.abs(play.elapsed/play.duration-.86);
  // A 250 ms contact window is forgiving enough for a phone, but still rewards timing.
  play.quality=clamp(1-distance/.24,0,1);
  play.feedback=distance<.025?'PERFECT!':distance<.075?'GOOD TIMING':play.elapsed/play.duration<.86?'TOO EARLY':'TOO LATE';
  tone(play.quality>.4?'hit':'miss');haptic();renderControls();
}
function resolve() {
  const previous={...play};
  const event=game.resolvePitch({swing:play.swung,quality:play.quality,inZone:play.inZone,pitchQuality:play.pitchQuality,power:play.power});
  persist();
  const contact=['single','double','triple','homerun','out','foul'].includes(event.type);
  const timing=previous.offense&&previous.swung?previous.feedback:!previous.offense?(previous.release>.9?'PERFECT RELEASE':previous.release>.6?'GOOD RELEASE':'OFF TARGET'): 'PITCH TAKEN';
  play={...previous,phase:contact?'contact':'result',elapsed:0,event,timing};
  if(contact){tone('hit');showOverlay('','',false);}
  else presentResult();
  renderControls();
}
function presentResult() {
  play.phase='result'; play.elapsed=0;
  const e=play.event;
  const kicker=game.gameOver?'FINAL SCORE':e.scored?`${e.scored} RUN${e.scored===1?'':'S'} SCORED`:play.timing||'THE CALL';
  const title=game.gameOver?(game.state.score[1]>game.state.score[0]?'KNIGHTS WIN!':'FINAL OUT.'):e.label;
  showOverlay(kicker,title); $('resultText').textContent=e.text;
  if(e.type==='homerun'||game.gameOver){haptic([20,40,20]);tone('hit');}
  render();
}
function skipHalf() {
  if(!isIdle())return;
  const offense=game.isBatting, event=game.simHalf();
  if(!event)return;
  persist(); play={phase:'result',elapsed:0,offense,event,timing:'HALF INNING SIMULATED'};presentResult();
}
function continueGame() {
  if(!game.gameOver)return;
  if(game.state.game===11){showSeasonResult();return;}
  game.nextGame();persist();resetPlay(true);
}
function renderControls() {
  const over=game.gameOver, offense=play.phase==='ready'?game.isBatting:play.offense??game.isBatting;
  const busy=!['ready','charge'].includes(play.phase), incoming=play.phase==='pitch'&&offense;
  const canSwing=incoming&&!play.swung;
  $('actionKicker').textContent=over?'LEAVE IT ALL ON THE FIELD':offense?'A LITTLE TIMING. A LOT OF HEART.':'THE BALL IS IN YOUR HANDS';
  $('actionTitle').textContent=over?(game.state.score[1]>game.state.score[0]?'That’s a ballgame.':'Get ’em next time.'):offense?'Make your swing.':'Make your pitch.';
  $('controlHint').textContent=over?'Your result is saved. Keep the season rolling.':offense?'Ready the pitch, then tap SWING as the needle reaches green. Take pitches outside the box.':'Drag the crosshair to aim. Hold PITCH and release in green.';
  $('mainActionLabel').textContent=over?(game.state.game===11?'SEASON RESULTS':'NEXT GAME →'):canSwing?'SWING!':incoming?'SWING TAKEN':play.phase==='charge'?'RELEASE!':play.phase==='ready'?(offense?'READY FOR PITCH':'HOLD TO PITCH'):'NEXT PLAY…';
  $('mainActionSub').textContent=over?`${game.state.results.filter(r=>r.win).length} WINS THIS SEASON`:incoming?(play.swung?play.feedback:'TIME THE BALL AT THE PLATE'):play.phase==='charge'?'LET GO IN THE GREEN':offense?'WATCH THE BALL • TIME YOUR TAP':'RELEASE IN THE GREEN';
  $('mainAction').disabled=paused||(!over&&busy&&!canSwing)||(over&&play.phase!=='ready');
  $('secondaryAction').textContent=incoming?'TAKE PITCH':'SIM HALF »';
  $('secondaryAction').disabled=paused||over||(busy&&!incoming)||play.phase==='charge'||(incoming&&play.swung);
  $('tacticsRow').innerHTML=offense?['CONTACT','POWER'].map((n,i)=>`<button class="tactic ${power===Boolean(i)?'active':''}" data-power="${i}" aria-pressed="${power===Boolean(i)}" ${busy||over?'disabled':''}>${i?'↗':'⊕'} ${n}</button>`).join(''):pitchTypes.map((p,i)=>`<button class="tactic ${selectedPitch===i?'active':''}" data-pitch="${i}" aria-pressed="${selectedPitch===i}" ${busy||play.phase==='charge'||over?'disabled':''}>${p.name}</button>`).join('');
  $('stealBtn').disabled=!isIdle()||!game.isBatting||!game.state.bases[0]||game.state.bases[1];
  $('subBtn').disabled=!isIdle(); $('aimReset').hidden=offense||over; $('aimReset').disabled=busy||paused;
  $('meterLeft').textContent=offense?'SWING TIMING':'RELEASE METER';
  $('sweetSpot').style.left=offense?'80%':'65%';$('sweetSpot').style.width=offense?'12%':'20%';
  $('timingMeter').setAttribute('aria-label',offense?'Swing when the timing needle reaches the green zone':'Release when the pitch meter reaches the green zone');
  if(play.phase==='ready'){$('meterNeedle').style.left='0%';$('meterStatus').textContent=over?'GAME COMPLETE':offense?'READY WHEN YOU ARE':'HOLD TO CHARGE';}
}
function render() {
  const s=game.state,p=game.batter,opp=game.opponent, wins=s.results.filter(r=>r.win).length;
  $('seasonLabel').textContent=`SEASON 01 / GAME ${String(s.game+1).padStart(2,'0')}`;
  $('recordChip').textContent=`${wins} W · ${s.results.length-wins} L`;
  $('awayBadge').textContent=opp.short[0];$('awayBadge').style.background=opp.color;
  $('awayName').textContent=opp.city==='LOS ANGELES'?'LOS ANGELES':opp.city;
  $('awayScore').textContent=s.score[0];$('homeScore').textContent=s.score[1];
  const ordinal=s.inning%100>=11&&s.inning%100<=13?'TH':({1:'ST',2:'ND',3:'RD'}[s.inning%10]||'TH');
  $('inningLabel').textContent=s.over?'FINAL':`${s.half?'▼':'▲'} ${s.inning}${ordinal}`;
  $('outsLabel').textContent=`${s.outs} OUT${s.outs===1?'':'S'}`;$('gameLength').textContent=`${s.innings} INNINGS`;
  $('balls').textContent=s.balls;$('strikes').textContent=s.strikes;$('outs').textContent=s.outs;
  $('modeTag').textContent=s.over?'THAT’S A BALLGAME':game.isBatting?'YOU’RE BATTING':'YOU’RE PITCHING';
  $('pitchInfo').textContent=game.isBatting?`${power?'POWER':'CONTACT'} SWING`:`${pitchTypes[selectedPitch].name} · ${pitchTypes[selectedPitch].speed} MPH`;
  [1,2,3].forEach((n,i)=>$('base'+n).classList.toggle('on',s.bases[i]));
  $('baseDiamond').setAttribute('aria-label',s.bases.some(Boolean)?`Runners on ${s.bases.map((v,i)=>v?['first','second','third'][i]:'').filter(Boolean).join(' and ')}`:'Bases empty');
  $('batterName').textContent=p.name;$('batterPosition').textContent=`${p.pos} · RIGHT HANDED`;
  $('playerNumber').textContent=String(p.id+1).padStart(2,'0');$('playerRole').textContent=game.isBatting?'YOUR HITTER':'VISITING HITTER';
  $('matchupSide').textContent=`${s.half?'BOT':'TOP'} ${s.inning}`;
  $('pitcherName').textContent=game.pitcher.name;
  const stars=clamp(Math.round((p.contact+p.power)/40),1,5);$('playerStars').textContent='★'.repeat(stars)+'☆'.repeat(5-stars);
  $('skillBars').innerHTML=[['CONTACT',p.contact],['POWER',p.power],['SPEED',p.speed]].map(([n,v])=>`<div class="skill-row"><span>${n}</span><div class="skill-track"><i style="width:${v}%"></i></div><b>${v}</b></div>`).join('');
  const length=Math.max(s.innings,s.inning);
  $('lineScore').innerHTML=`<table class="line-table"><thead><tr><th>CLUB</th>${Array.from({length},(_,i)=>`<th>${i+1}</th>`).join('')}<th>R</th><th>H</th></tr></thead><tbody>${[0,1].map(t=>`<tr><td>${t?'NYK':opp.short}</td>${Array.from({length},(_,i)=>`<td>${s.lines[t][i]??'–'}</td>`).join('')}<td class="total">${s.score[t]}</td><td>${s.hits[t]}</td></tr>`).join('')}</tbody></table>`;
  const log=s.log.slice(0,7);$('playLog').replaceChildren(...(log.length?log.map(e=>{const el=document.createElement('p'),tag=document.createElement('b');tag.textContent=e.tag||'';el.append(tag,document.createTextNode(e.text));return el;}):[Object.assign(document.createElement('p'),{textContent:'The grass is cut. The crowd is ready. Let’s play ball.'})]));
  $('resultText').textContent=s.log[0]?.text||'Welcome to Knights Park. Your season starts here.';
  renderClub();renderLeague();renderControls();
  if(play.phase==='ready')showOverlay(s.over?'FINAL SCORE':game.isBatting?'YOUR TURN AT THE PLATE':'TAKE THE MOUND',s.over?(s.score[1]>s.score[0]?'KNIGHTS WIN!':'FINAL OUT.'):game.isBatting?'WAIT FOR YOUR PITCH.':'PAINT THE CORNERS.',intro||s.over);
}
function renderClub() {
  const s=game.state;
  $('rosterTable').innerHTML=game.lineup.map((p,i)=>`<div class="roster-player"><span>${i+1}</span><div><b>${p.name}</b><small>${p.pos}</small></div><div class="ratings">${p.contact} / ${p.power}</div><div class="move-buttons"><button data-move="${i},-1" aria-label="Move ${p.name} up" ${s.started||i===0?'disabled':''}>▲</button><button data-move="${i},1" aria-label="Move ${p.name} down" ${s.started||i===8?'disabled':''}>▼</button></div></div>`).join('');
  $('pitchingRoster').innerHTML=pitchers.map(p=>`<div class="staff-player"><div><b>${p.name}</b><small>CONTROL ${p.control} · VELOCITY ${p.velocity}</small></div><span>${s.pitchers[1]===p.id?`${s.pitches[1]} PITCHES`:s.usedPitchers.includes(p.id)?'USED':'READY'}</span></div>`).join('');
  $('benchRoster').innerHTML=game.availableBench.map(p=>`<div class="bench-player"><div><b>${p.name}</b><small>${p.pos}</small></div><span>${p.contact} CON</span></div>`).join('')||'<p class="card-note">Everyone on the bench has entered this game.</p>';
}
function renderLeague() {
  const s=game.state,wins=s.results.filter(r=>r.win).length;
  $('seasonRecord').textContent=`${wins} WINS / ${s.results.length-wins} LOSSES`;
  $('standings').innerHTML=`<table class="standings-table"><thead><tr><th>CLUB</th><th>W</th><th>L</th></tr></thead><tbody>${game.standings.map(t=>`<tr class="${t.id===0?'mine':''}"><td>${t.name}</td><td>${t.w}</td><td>${t.l}</td></tr>`).join('')}</tbody></table>`;
  $('schedule').innerHTML=Array.from({length:12},(_,i)=>{const r=s.results[i];return `<div class="schedule-game ${i===s.game?'current':''}"><span class="num">${String(i+1).padStart(2,'0')}</span><b>${teams[1+i%3].name}<small>AT KNIGHTS PARK</small></b><span>${r?`${r.win?'W':'L'} ${r.score[1]}–${r.score[0]}`:i===s.game?'GAME DAY':'UP NEXT'}</span></div>`;}).join('');
}

// A single animation clock pauses safely when the app is backgrounded.
function frame(now) {
  const dt=Math.min(now-lastFrame,50);lastFrame=now;
  if(!paused && !document.hidden && activeScreen==='game') {
    sessionTime+=dt;play.elapsed+=dt;
    if(play.phase==='charge') {
      const value=chargeValue();$('meterNeedle').style.left=`${value*99}%`;
      $('meterStatus').textContent=value>.65&&value<.85?'RELEASE NOW!':'FIND THE GREEN';
    }
    if(play.phase==='pitch') {
      const progress=play.elapsed/play.duration;
      if(play.offense) {
        $('meterNeedle').style.left=`${Math.min(99,progress*86/.86)}%`;
        $('meterStatus').textContent=play.swung?play.feedback:progress>.8&&progress<.92?'SWING NOW!':'WATCH THE BALL';
      }
      if(progress>=1.12 || (play.swung && progress>=Math.max(.88,play.swingAt/play.duration+.035))) resolve();
    } else if(play.phase==='contact'&&play.elapsed>750)presentResult();
    else if(play.phase==='result'&&play.elapsed>1100)resetPlay(Boolean(play.event?.inningChanged));
  }
  const current=play, offense=current.phase==='ready'?game.isBatting:current.offense??game.isBatting;
  const progress=current.phase==='pitch'?clamp(current.elapsed/current.duration,0,1.16):0;
  const t=clamp(progress/.86,0,1.3);
  let ball=null;
  if(current.phase==='pitch') {
    const curve=current.pitchType===1?Math.sin(t*Math.PI)*-35:current.pitchType===2?Math.sin(t*Math.PI)*20:0;
    ball={x:FIELD.release.x+(current.target.x-FIELD.release.x)*t,y:FIELD.release.y+(current.target.y-FIELD.release.y)*t+curve};
  }
  stadium.draw({time:reducedMotion?0:sessionTime,phase:current.phase,offense,progress,aim:offense?null:aim,ball,
    swingProgress:current.swingAt>=0?clamp((current.phase==='pitch'?current.elapsed-current.swingAt:current.elapsed+200)/450,0,1):-1,
    hit:current.phase==='contact'?{progress:current.elapsed/750,quality:current.event?.quality??.6,direction:1}:null});
  requestAnimationFrame(frame);
}

$('mainAction').addEventListener('pointerdown',e=>{
  if(e.button!==0||paused||$('mainAction').disabled)return;
  e.preventDefault();$('mainAction').focus();
  if(game.gameOver){continueGame();return;}
  if(play.phase==='pitch'){swing();return;}
  if(!isIdle())return;
  if(game.isBatting){readyToBat();return;}
  chargingPointer=e.pointerId; e.currentTarget.setPointerCapture(e.pointerId);charge();
});
$('mainAction').addEventListener('pointerup',e=>{if(chargingPointer!==e.pointerId)return;chargingPointer=null;release();});
$('mainAction').addEventListener('pointercancel',()=>{if(play.phase==='charge')resetPlay();});
$('mainAction').addEventListener('lostpointercapture',()=>{if(chargingPointer!==null&&play.phase==='charge')resetPlay();chargingPointer=null;});
// Keyboard and assistive-technology click activation have no PointerEvent sequence.
$('mainAction').addEventListener('click',e=>{if(e.detail!==0||paused||$('mainAction').disabled)return;if(game.gameOver)continueGame();else if(play.phase==='pitch')swing();else if(play.phase==='charge')release();else if(game.isBatting)readyToBat();else {charge();play.elapsed=480;release();}});
$('secondaryAction').onclick=()=>{if(play.phase==='pitch'&&play.offense&&!play.swung){play.swung=false;play.elapsed=play.duration*1.16;resolve();}else skipHalf();};
function setAim(e) {
  const rect=$('gameCanvas').getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*FIELD.width,y=(e.clientY-rect.top)/rect.height*FIELD.height;
  // The large gesture region maps to the much smaller pitch target for comfortable thumb aiming.
  aim={x:clamp(182+(x-182)*.7,FIELD.zone.x-35,FIELD.zone.x+FIELD.zone.w+35),y:clamp(y,FIELD.zone.y-35,FIELD.zone.y+FIELD.zone.h+35)};
  intro=false;showOverlay('','',false);
}
$('fieldWrap').addEventListener('pointerdown',e=>{if(e.target.closest('button')||game.isBatting||!isIdle())return;e.preventDefault();aimingPointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);setAim(e);});
$('fieldWrap').addEventListener('pointermove',e=>{if(aimingPointer===e.pointerId)setAim(e);});
['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('fieldWrap').addEventListener(type,()=>aimingPointer=null));
$('aimReset').onclick=()=>{aim={x:182,y:313};intro=false;showOverlay('','',false);};
$('tacticsRow').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.pitch!==undefined)selectedPitch=Number(b.dataset.pitch);if(b.dataset.power!==undefined)power=Boolean(Number(b.dataset.power));render();};
$('rosterTable').onclick=e=>{const b=e.target.closest('[data-move]');if(!b||b.disabled)return;const [index,delta]=b.dataset.move.split(',').map(Number);if(game.reorder(index,delta)){persist();renderClub();}};
$('stealBtn').onclick=()=>{if(!isIdle())return;const event=game.steal();if(event.type==='blocked')return;persist();play={phase:'result',elapsed:0,offense:true,event,timing:'TAKING A CHANCE'};presentResult();};

function showScreen(screen) {
  if(play.phase==='charge')resetPlay();
  if(play.phase!=='ready'){openPause();return;}
  activeScreen=screen;document.body.dataset.screen=screen;
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='screen-'+screen));
  document.querySelectorAll('[data-screen]').forEach(b=>{b.classList.toggle('active',b.dataset.screen===screen);if(b.dataset.screen===screen)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  window.scrollTo({top:0,behavior:'auto'});render();
}
document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));
document.querySelector('.brand').onclick=e=>{e.preventDefault();showScreen('game');};
function openModal(title,body) {
  lastFocus=document.activeElement;paused=true;
  $('modalRoot').innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-heading"><h2>${title}</h2><button class="modal-close" aria-label="Close dialog" id="closeModal">×</button></div><div class="modal-body">${body}</div></section>`;
  $('closeModal').onclick=closeModal;$('closeModal').focus();
}
function closeModal() { $('modalRoot').replaceChildren();paused=false;lastFrame=performance.now();lastFocus?.focus(); }
function openPause() {
  if(play.phase==='charge')resetPlay();
  openModal('TIME OUT.',`<p>The game is paused. Take a breath. The ballpark will be here.</p><button class="big-button" id="resumeBtn">BACK TO THE GAME →</button><p class="install-note">Your season saves after every play.</p>`);
  $('resumeBtn').onclick=closeModal;
}
$('pauseBtn').onclick=openPause;
$('helpBtn').onclick=()=>{
  if(play.phase==='charge')resetPlay();
  openModal('WELCOME TO THE CLUB.',`<h3>ON THE MOUND</h3><p>Drag the crosshair near the batter to aim. Hold the gold PITCH button, then release when the meter reaches green.</p><h3>AT THE PLATE</h3><p>Tap READY FOR PITCH. When the ball reaches your batter on the left, tap SWING. The green timing zone helps you find the sweet spot. TAKE lets a pitch pass.</p><h3>YOUR SEASON</h3><p>Play twelve quick three-inning games, or choose nine innings in New Season. Manage your lineup in the Clubhouse.</p><p class="install-note">On iPhone: Share → Add to Home Screen. On Android: browser menu → Install app or Add to Home screen. Serve the game over HTTPS for offline play.</p><button class="big-button" id="letsPlay">LET’S PLAY BALL →</button>`);
  $('letsPlay').onclick=closeModal;
};
$('rulesLink').onclick=()=>showScreen('rules');
$('subBtn').onclick=()=>{
  if(!isIdle())return;
  openModal('CALL TO THE DUGOUT',`<h3>FRESH ARM</h3>${game.availablePitchers.map(p=>`<div class="sub-item"><div><b>${p.name}</b><small>CONTROL ${p.control} · VELOCITY ${p.velocity}</small></div><button class="tiny-button" data-relief="${p.id}">IN</button></div>`).join('')||'<p>All relief pitchers have entered.</p>'}<h3>PINCH HIT FOR ${roster[game.state.order[game.state.bats[1]%9]].name.toUpperCase()}</h3>${game.availableBench.map(p=>`<div class="sub-item"><div><b>${p.name}</b><small>${p.contact} CONTACT · ${p.power} POWER</small></div><button class="tiny-button" data-bench="${p.id}">IN</button></div>`).join('')||'<p>No unused bench players.</p>'}<p class="install-note">Replaced players cannot return until the next game.</p>`);
};
$('modalRoot').onclick=e=>{
  if(e.target===$('modalRoot')){closeModal();return;}
  const b=e.target.closest('[data-relief],[data-bench]');if(!b)return;
  const success=b.dataset.relief!==undefined?game.substitutePitcher(Number(b.dataset.relief)):game.substituteBatter(Number(b.dataset.bench));
  if(success){persist();closeModal();render();$('resultText').textContent='A fresh face steps into the game.';}
};
$('resetSeasonBtn').onclick=()=>{
  openModal('A FRESH START.',`<p>Start a new season? Your current season and scores will be cleared.</p><h3>GAME LENGTH</h3><select id="inningsChoice" aria-label="Innings per game"><option value="3">3 innings · Pocket game</option><option value="9">9 innings · Full baseball</option></select><div class="modal-actions"><button class="secondary-button" id="cancelReset">KEEP PLAYING</button><button class="big-button" id="confirmReset">NEW SEASON →</button></div>`);
  $('inningsChoice').value=String(game.state.innings);$('cancelReset').onclick=closeModal;
  $('confirmReset').onclick=()=>{game.reset(Number($('inningsChoice').value));persist();closeModal();resetPlay(true);showScreen('game');};
};
function showSeasonResult() {
  const s=game.state,wins=s.results.filter(r=>r.win).length,rank=game.standings.findIndex(t=>t.id===0)+1;
  openModal('SEASON IN THE BOOKS.',`<p style="font-size:26px;color:var(--gold);font-weight:bold">${wins} WINS · ${12-wins} LOSSES</p><p>Your Knights finish #${rank} in the Pixel League. Every pitch, every swing — that was your season.</p><button id="seasonLeague" class="big-button">VIEW THE SEASON →</button>`);
  $('seasonLeague').onclick=()=>{closeModal();showScreen('league');};
}
$('soundToggle').onclick=()=>{muted=!muted;$('soundToggle').textContent=muted?'♩':'♫';$('soundToggle').setAttribute('aria-pressed',String(!muted));$('soundToggle').setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');};
let spaceHeld=false;
document.addEventListener('keydown',e=>{
  if($('modalRoot').children.length){
    if(e.key==='Escape'){e.preventDefault();closeModal();}
    if(e.key==='Tab'){
      const f=[...$('modalRoot').querySelectorAll('button:not(:disabled),select')],a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
    }return;
  }
  if(e.key==='Escape'){openPause();return;}
  if(activeScreen!=='game'||e.target.matches('select,input,textarea')||e.altKey||e.metaKey||e.ctrlKey)return;
  if(e.code==='Space' && e.target.closest('button,a') && e.target.id!=='mainAction')return;
  if(e.code==='Space'){
    e.preventDefault();if(e.repeat||spaceHeld)return;spaceHeld=true;
    if(game.gameOver&&play.phase==='ready'){continueGame();return;}
    if(play.phase==='pitch'&&play.offense)swing();else if(isIdle()){if(game.isBatting)readyToBat();else charge();}
  }
  if(e.key.startsWith('Arrow')&&isIdle()&&!game.isBatting){e.preventDefault();aim.x=clamp(aim.x+(e.key==='ArrowRight'?5:e.key==='ArrowLeft'?-5:0),116,248);aim.y=clamp(aim.y+(e.key==='ArrowDown'?5:e.key==='ArrowUp'?-5:0),240,387);intro=false;showOverlay('','',false);}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'&&spaceHeld){e.preventDefault();spaceHeld=false;if(play.phase==='charge')release();}});
function interruption() {
  spaceHeld=false;chargingPointer=null;aimingPointer=null;
  if(play.phase==='charge')resetPlay();
  if(play.phase!=='ready'&&!paused)openPause();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)interruption();lastFrame=performance.now();});
window.addEventListener('blur',interruption);

document.body.dataset.screen='game';render();persist();requestAnimationFrame(frame);
if('serviceWorker' in navigator && location.protocol!=='file:') {
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offlineStatus').textContent='OFFLINE READY · TAKE THE GAME ANYWHERE';}).catch(()=>{$('offlineStatus').textContent='PLAY ONLINE · PROGRESS SAVES HERE';});
}
