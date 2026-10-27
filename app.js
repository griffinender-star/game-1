import { BaseballGame, teams, roster, pitchers } from './engine.js';
import { Stadium, FIELD } from './stadium.js';
import { CareerUI } from './career-ui.js';
import { planPlay } from './playback.js';
import { PITCH_TYPES, normalizeLocation, locationToTarget, targetToLocation, pitchPoint, swingQuality, samplePitch } from './pitch-model.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'pixel-dugout-v2';
let saved, careerUI;
let fieldView=true,lastPlayback=null,zonePointer=null,managementOpen=false,menuOpen=false;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* Private browsing can disable storage. */ }
const game = new BaseballGame(saved);
const stadium = new Stadium($('gameCanvas'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pitchTypes=PITCH_TYPES;
let selectedPitch = 0, power = false, muted = false, paused = false, activeScreen = 'game', lastFocus;
let aim={u:.5,v:.5},intro=true;
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
function snapshot() {
  const s=game.state;
  return {inning:s.inning,half:s.half,outs:s.outs,balls:s.balls,strikes:s.strikes,bases:[...s.bases],score:[...s.score]};
}
function cameraView() {
  if(['pitch'].includes(play.phase))return 'pitch';
  if(play.plan?.camera==='field'&&['contact','result'].includes(play.phase))return 'field';
  return fieldView?'field':'pitch';
}
function updateCameraUI() {
  const view=cameraView(),review=['contact','result'].includes(play.phase);
  document.body.dataset.playView=view;document.body.dataset.playPhase=play.phase;
  $('fieldViewBtn').textContent=view==='field'?'PITCH VIEW ⊕':'FULL FIELD ◇';
  $('fieldViewBtn').disabled=['pitch','contact'].includes(play.phase);
  $('cameraLabel').textContent=play.replaying?' / REPLAY':view==='field'?' / FIELD CAM':' / PLATE CAM';
  $('replayBtn').disabled=!lastPlayback||!['ready','result'].includes(play.phase)||paused;
  $('skipReplayBtn').hidden=play.phase!=='contact';
  $('hitRibbon').hidden=!review||!play.event;
  if(review&&play.event){
    $('hitLabel').textContent=play.event.label;
    $('hitDetail').textContent=play.event.scored?`${play.event.scored} RUN${play.event.scored===1?'':'S'} SCORED`:play.plan?.direction||play.timing||'';
  }
  $('playCaption').textContent=play.phase==='contact'?(play.replaying?'REPLAY · ':'BALL IN PLAY · ')+(play.plan?.direction||'FOLLOW THE PLAY'):play.phase==='result'?(play.event?.inningChanged?`END ${play.event.before.half?'BOTTOM':'TOP'} ${play.event.before.inning} · `:'')+(play.event?.text||'TAP CONTINUE FOR THE NEXT PLAY'):view==='field'?'THE WHOLE FIELD. EVERY PLAY.':game.isBatting?'WATCH THE BALL. TIME YOUR SWING.':'AIM IN THE STRIKE-ZONE PANEL. OWN THE PLATE.';
}
function resetPlay(showIntro=false) {
  play={phase:'ready',elapsed:0};zonePointer=null;
  intro=showIntro;render();
}
function pitchNow(){
  if(!isIdle()||game.isBatting)return;
  const sampled=samplePitch({aim,pitcher:game.pitcher,pitchType:selectedPitch});
  launch({offense:false,...sampled,pitchQuality:sampled.command});
}
function readyToBat(){
  if(!isIdle()||!game.isBatting)return;
  const inZone=Math.random()>.24;
  const incomingAim={u:.36+Math.random()*.28,v:.32+Math.random()*.36};
  if(!inZone)incomingAim.v=Math.random()>.5?.06:.94;
  const incomingType=Math.floor(Math.random()*pitchTypes.length);
  const sampled=samplePitch({aim:incomingAim,pitcher:game.pitcher,pitchType:incomingType});
  launch({offense:true,...sampled,pitchQuality:sampled.command});
}
function pitchRecords(){
  return Array.isArray(game.state.pitchLocations)?game.state.pitchLocations.filter(p=>p&&Number.isFinite(p.u)&&Number.isFinite(p.v)&&Number.isInteger(p.type)&&pitchTypes[p.type]&&typeof p.result==='string'&&p.result.length<80&&Number.isInteger(p.number)&&p.number>0&&Number.isFinite(p.velocity)).slice(-8):[];
}
function recordPitch(previous,event){
  if(previous.offense)return;
  const actual=targetToLocation(previous.target);
  const previousRecords=pitchRecords(),number=(previousRecords[previousRecords.length-1]?.number||0)+1;
  game.state.pitchLocations=[...previousRecords,{...actual,number,type:previous.pitchType,velocity:previous.velocity,inZone:previous.inZone,result:event.label,event:event.type,intended:previous.intended}].slice(-8);
}
function renderPitchZone(){
  const offense=play.phase==='ready'?game.isBatting:play.offense??game.isBatting;
  $('pitchLocationPanel').hidden=offense;document.body.dataset.batting=String(offense);
  const disabled=!isIdle()||game.isBatting;
  $('pitchZone').setAttribute('aria-disabled',String(disabled));$('centerPitchBtn').disabled=disabled;
  $('pitchTarget').style.left=`${aim.u*100}%`;$('pitchTarget').style.top=`${aim.v*100}%`;
  const horizontal=aim.u<.36?'Left':aim.u>.64?'Right':'Center';
  const vertical=aim.v<.36?'High':aim.v>.64?'Low':'Middle';
  $('pitchCoordinates').textContent=`${vertical} · ${horizontal}`;
  $('pitchCommand').textContent=`${pitchTypes[selectedPitch].name.toLowerCase()} · ${game.pitcher.control} control. Aim, then tap Pitch.`;
  const history=pitchRecords();$('pitchMarkers').replaceChildren(...history.map((p,i)=>{
    const dot=document.createElement('span');dot.className='pitch-mark '+(['single','double','triple','homerun'].includes(p.event)?'pitch-hit':p.event==='ball'||p.event==='walk'?'pitch-ball':'pitch-strike')+(i===history.length-1?' latest':'');
    dot.style.left=`${clamp(p.u,.03,.97)*100}%`;dot.style.top=`${clamp(p.v,.03,.97)*100}%`;dot.style.opacity=String(.35+.65*(i+1)/history.length);dot.textContent=p.number;
    dot.title=`Pitch ${p.number}: ${pitchTypes[p.type].name.toLowerCase()}, ${p.velocity} mph, ${p.result.toLowerCase()}`;return dot;
  }));
  const last=history[history.length-1];
  $('pitchResultText').textContent=play.phase==='pitch'&&!play.offense?'Pitch in flight…':last?`#${last.number} · ${last.velocity} mph · ${last.result}`:'Choose your spot';
}
function launch(options) {
  intro=false;game.state.started=true;
  const z=FIELD.zone;
  play={...options,phase:'pitch',elapsed:0,swung:false,quality:0,swingAt:-1,
    inZone: options.target.x>=z.x&&options.target.x<=z.x+z.w&&options.target.y>=z.y&&options.target.y<=z.y+z.h,
    power, pitchType:options.pitchType??selectedPitch};
  showOverlay('','',false);tone('pitch');renderControls();
}
function swing() {
  if(paused||play.phase!=='pitch'||!play.offense||play.swung)return;
  play.swung=true;play.swingAt=play.elapsed;
  const contact=swingQuality(play.elapsed/play.duration,game.batter.contact);
  play.quality=contact.quality;play.feedback=contact.feedback;
  tone(play.quality>.4?'hit':'miss');haptic();renderControls();
}
function resolve() {
  const previous={...play},before=snapshot(),batter={...game.batter},pitcher={...game.pitcher};
  const event=game.resolvePitch({swing:play.swung,quality:play.quality,inZone:play.inZone,pitchQuality:play.pitchQuality,power:play.power});
  const after=snapshot(),plan=planPlay(event,before,after);
  recordPitch(previous,event);persist();
  const timing=previous.offense&&previous.swung?previous.feedback:!previous.offense?(previous.command>.8?'LOCATED WELL':'PITCH COMPLETE'):'PITCH TAKEN';
  play={...previous,phase:'result',elapsed:0,event,timing,plan,before,after,batter,pitcher};
  if(plan.camera==='field'){
    play.phase='contact';play.duration=reducedMotion?Math.max(1000,plan.duration*.65):plan.duration;
    lastPlayback={...play};tone('hit');showOverlay('','',false);renderControls();
  }else{lastPlayback=null;presentResult();}
}
function presentResult() {
  play.phase='result';play.elapsed=0;
  const e=play.event;
  showOverlay('','',false);$('resultText').textContent=e.text;
  if(!play.replaying&&(e.type==='homerun'||game.gameOver)){haptic([20,40,20]);tone('hit');}
  render();
}
function continuePlay(){
  if(play.phase!=='result')return;
  if(game.gameOver){continueGame();return;}
  resetPlay(false);
}
function replayLast(){
  if(!lastPlayback||!['ready','result'].includes(play.phase)||paused)return;
  play={...lastPlayback,phase:'contact',elapsed:0,replaying:true};
  showOverlay('','',false);renderControls();
}
function skipHalf() {
  if(!isIdle())return;
  const offense=game.isBatting, event=game.simHalf();
  if(!event)return;
  persist();lastPlayback=null;play={phase:'result',elapsed:0,offense:game.isBatting,event,timing:'HALF INNING SIMULATED'};presentResult();
}
function continueGame() {
  if(!game.gameOver)return;
  if(game.state.game===11){showSeasonResult();return;}
  game.nextGame();lastPlayback=null;fieldView=true;persist();resetPlay(true);
}
function renderControls() {
  const result=play.phase==='result';
  const over=game.gameOver, offense=play.phase==='ready'?game.isBatting:play.offense??game.isBatting;
  const busy=play.phase!=='ready', incoming=play.phase==='pitch'&&offense;
  const canSwing=incoming&&!play.swung&&!play.taking;
  $('actionKicker').textContent=over?'LEAVE IT ALL ON THE FIELD':offense?'A LITTLE TIMING. A LOT OF HEART.':'THE BALL IS IN YOUR HANDS';
  $('actionTitle').textContent=over?(game.state.score[1]>game.state.score[0]?'That’s a ballgame.':'Get ’em next time.'):offense?'Make your swing.':'Make your pitch.';
  $('controlHint').textContent=over?'Your result is saved. Keep the season rolling.':offense?'Watch the ball reach the plate, then tap Swing or the field. Let outside pitches go.':'Choose a target in the side strike zone, then tap Pitch.';
  $('mainActionLabel').textContent=result?(over?(game.state.game===11?'SEASON RESULTS':'NEXT GAME →'):'CONTINUE →'):over?(game.state.game===11?'SEASON RESULTS':'NEXT GAME →'):canSwing?'SWING!':incoming?(play.taking?'TAKING PITCH':'SWING TAKEN'):play.phase==='ready'?(offense?'READY FOR PITCH':'PITCH'):'NEXT PLAY…';
  $('mainActionSub').textContent=result?'EVERY PLAY. AT YOUR PACE.':over?`${game.state.results.filter(r=>r.win).length} WINS THIS SEASON`:incoming?(play.swung?play.feedback:'TIME THE BALL AT THE PLATE'):offense?'WATCH THE BALL AT THE PLATE':'THROW TO YOUR TARGET';
  $('mainAction').disabled=paused||(!result&&((!over&&busy&&!canSwing)||(over&&play.phase!=='ready')));
  $('secondaryAction').textContent=incoming?'TAKE PITCH':'SIM HALF »';
  $('secondaryAction').disabled=paused||over||(busy&&!incoming)||(incoming&&(play.swung||play.taking));
  $('tacticsRow').innerHTML=offense?['CONTACT','POWER'].map((n,i)=>`<button class="tactic ${power===Boolean(i)?'active':''}" data-power="${i}" aria-pressed="${power===Boolean(i)}" ${busy||over?'disabled':''}>${i?'↗':'⊕'} ${n}</button>`).join(''):pitchTypes.map((p,i)=>`<button class="tactic ${selectedPitch===i?'active':''}" data-pitch="${i}" aria-pressed="${selectedPitch===i}" ${busy||over?'disabled':''}>${p.name}</button>`).join('');
  $('stealBtn').disabled=!isIdle()||!game.isBatting||!game.state.bases[0]||game.state.bases[1];
  $('subBtn').disabled=!isIdle(); $('aimReset').hidden=true; $('aimReset').disabled=busy||paused;
  renderPitchZone();updateCameraUI();

}
function render() {
  const s=game.state,p=play.batter&&['contact','result'].includes(play.phase)?play.batter:game.batter,opp=game.opponent, wins=s.results.filter(r=>r.win).length;
  $('seasonLabel').textContent=`SEASON ${String(game.career?.season||1).padStart(2,'0')} / GAME ${String(s.game+1).padStart(2,'0')}`;
  $('recordChip').textContent=`${wins} W · ${s.results.length-wins} L`;
  $('awayBadge').textContent=opp.short[0];$('awayBadge').style.background=opp.color;
  $('awayName').textContent=opp.city==='LOS ANGELES'?'LOS ANGELES':opp.city;
  const displayScore=play.replaying&&play.after?play.after.score:s.score;
  $('awayScore').textContent=displayScore[0];$('homeScore').textContent=displayScore[1];
  const displayInning=play.before&&['contact','result'].includes(play.phase)?play.before.inning:s.inning;
  const displayHalf=play.before&&['contact','result'].includes(play.phase)?play.before.half:s.half;
  const ordinal=displayInning%100>=11&&displayInning%100<=13?'TH':({1:'ST',2:'ND',3:'RD'}[displayInning%10]||'TH');
  $('inningLabel').textContent=s.over?'FINAL':`${displayHalf?'▼':'▲'} ${displayInning}${ordinal}`;
  const displayOuts=play.event?.inningChanged&&['contact','result'].includes(play.phase)?3:play.replaying&&play.after?play.after.outs:s.outs;
  $('outsLabel').textContent=`${displayOuts} OUT${displayOuts===1?'':'S'}`;$('gameLength').textContent=`${s.innings} INNINGS`;
  $('balls').textContent=play.replaying&&play.after?play.after.balls:s.balls;$('strikes').textContent=play.replaying&&play.after?play.after.strikes:s.strikes;$('outs').textContent=displayOuts;
  $('modeTag').textContent=s.over?'THAT’S A BALLGAME':game.isBatting?'YOU’RE BATTING':'YOU’RE PITCHING';
  $('pitchInfo').textContent=play.velocity?`${pitchTypes[play.pitchType]?.name||'PITCH'} · ${play.velocity} MPH`:game.isBatting?`${power?'POWER':'CONTACT'} SWING`:`${pitchTypes[selectedPitch].name} · ${pitchTypes[selectedPitch].speed} MPH`;
  const displayBases=play.plan&&['contact','result'].includes(play.phase)?play.plan.displayBases:s.bases;
  [1,2,3].forEach((n,i)=>$('base'+n).classList.toggle('on',displayBases[i]));
  $('baseDiamond').setAttribute('aria-label',displayBases.some(Boolean)?`Runners on ${displayBases.map((v,i)=>v?['first','second','third'][i]:'').filter(Boolean).join(' and ')}`:'Bases empty');
  $('batterName').textContent=p.name;$('batterPosition').textContent=`${p.pos} · RIGHT HANDED`;
  $('playerNumber').textContent=String(p.id+1).padStart(2,'0');$('playerRole').textContent=game.isBatting?'YOUR HITTER':'VISITING HITTER';
  $('matchupSide').textContent=`${s.half?'BOT':'TOP'} ${s.inning}`;
  $('pitcherName').textContent=(play.pitcher&&['contact','result'].includes(play.phase)?play.pitcher:game.pitcher).name;
  const stars=clamp(Math.round((p.contact+p.power)/40),1,5);$('playerStars').textContent='★'.repeat(stars)+'☆'.repeat(5-stars);
  $('skillBars').innerHTML=[['CONTACT',p.contact],['POWER',p.power],['SPEED',p.speed]].map(([n,v])=>`<div class="skill-row"><span>${n}</span><div class="skill-track"><i style="width:${v}%"></i></div><b>${v}</b></div>`).join('');
  const length=Math.max(s.innings,s.inning);
  $('lineScore').innerHTML=`<table class="line-table"><thead><tr><th>CLUB</th>${Array.from({length},(_,i)=>`<th>${i+1}</th>`).join('')}<th>R</th><th>H</th></tr></thead><tbody>${[0,1].map(t=>`<tr><td>${t?'NYK':opp.short}</td>${Array.from({length},(_,i)=>`<td>${s.lines[t][i]??'–'}</td>`).join('')}<td class="total">${s.score[t]}</td><td>${s.hits[t]}</td></tr>`).join('')}</tbody></table>`;
  const log=s.log.slice(0,7);$('playLog').replaceChildren(...(log.length?log.map(e=>{const el=document.createElement('p'),tag=document.createElement('b');tag.textContent=e.tag||'';el.append(tag,document.createTextNode(e.text));return el;}):[Object.assign(document.createElement('p'),{textContent:'The grass is cut. The crowd is ready. Let’s play ball.'})]));
  $('resultText').textContent=s.log[0]?.text||'Welcome to Knights Park. Your season starts here.';
  renderClub();renderLeague();renderControls();careerUI?.render();
  $('resetSeasonBtn').textContent=game.career?'FRONT OFFICE ↗':'NEW SEASON ↻';
  if(play.phase==='ready')showOverlay(s.over?'FINAL SCORE':game.isBatting?'YOUR TURN AT THE PLATE':'TAKE THE MOUND',s.over?(s.score[1]>s.score[0]?'KNIGHTS WIN!':'FINAL OUT.'):game.isBatting?'WAIT FOR YOUR PITCH.':'PAINT THE CORNERS.',intro||s.over);
}
function renderClub() {
  const s=game.state;
  $('rosterTable').innerHTML=game.lineup.map((p,i)=>`<div class="roster-player"><span>${i+1}</span><div><b>${p.name}</b><small>${p.pos}</small></div><div class="ratings">${p.contact} / ${p.power}</div><div class="move-buttons"><button data-move="${i},-1" aria-label="Move ${p.name} up" ${s.started||i===0?'disabled':''}>▲</button><button data-move="${i},1" aria-label="Move ${p.name} down" ${s.started||i===8?'disabled':''}>▼</button></div></div>`).join('');
  $('pitchingRoster').innerHTML=game.homePitchers.map(p=>`<div class="staff-player"><div><b>${p.name}</b><small>CONTROL ${p.control} · VELOCITY ${p.velocity}</small></div><span>${s.pitchers[1]===p.id?`${s.pitches[1]} PITCHES`:s.usedPitchers.includes(p.id)?'USED':'READY'}</span></div>`).join('');
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
    if(play.phase==='pitch'){
      const progress=play.elapsed/play.duration;
      if(progress>=1.20||(play.taking&&progress>=1.04)||(play.swung&&progress>=Math.max(1.015,play.swingAt/play.duration+.02)))resolve();
    } else if(play.phase==='contact'&&play.elapsed>=play.duration)presentResult();
  }
  if(activeScreen!=='game'||paused){requestAnimationFrame(frame);return;}
  const current=play, offense=current.phase==='ready'?game.isBatting:current.offense??game.isBatting;
  const progress=current.phase==='pitch'?clamp(current.elapsed/current.duration,0,1.25):0;
  const ball=current.phase==='pitch'?pitchPoint(progress,current.target,current.pitchType):null;
  stadium.draw({time:reducedMotion?0:sessionTime,phase:current.phase,offense,progress,aim:null,ball,
    swingProgress:current.swingAt>=0?clamp((current.phase==='pitch'?current.elapsed-current.swingAt:current.elapsed+200)/450,0,1):-1,
    view:cameraView(),bases:game.state.bases,
    playback:current.plan?.camera==='field'&&['contact','result'].includes(current.phase)?{...current.plan,progress:current.phase==='result'?1:clamp(current.elapsed/current.duration,0,1)}:null});
  requestAnimationFrame(frame);
}

function mainAction(){
  if(paused||managementOpen||menuOpen||$('mainAction').disabled)return;
  if(play.phase==='result'){continuePlay();return;}
  if(game.gameOver){continueGame();return;}
  if(play.phase==='pitch'){swing();return;}
  if(!isIdle())return;
  if(game.isBatting)readyToBat();else pitchNow();
}
$('mainAction').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();$('mainAction').focus();mainAction();});
$('mainAction').addEventListener('click',e=>{if(e.detail===0)mainAction();});
$('secondaryAction').onclick=()=>{if(play.phase==='pitch'&&play.offense&&!play.swung){play.taking=true;renderControls();}else skipHalf();};
$('fieldWrap').addEventListener('pointerdown',e=>{
  if(e.target.closest('button'))return;
  if(play.phase==='pitch'&&play.offense&&!play.swung&&!play.taking&&!paused){e.preventDefault();swing();}
});
function locatePitch(e){
  if(!isIdle()||game.isBatting)return;
  const rect=$('pitchZone').getBoundingClientRect();aim=normalizeLocation((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);renderPitchZone();
}
$('pitchZone').addEventListener('pointerdown',e=>{if(!isIdle()||game.isBatting)return;e.preventDefault();zonePointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);locatePitch(e);});
$('pitchZone').addEventListener('pointermove',e=>{if(zonePointer===e.pointerId)locatePitch(e);});
['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('pitchZone').addEventListener(type,()=>zonePointer=null));
$('centerPitchBtn').onclick=()=>{if(!isIdle()||game.isBatting)return;aim={u:.5,v:.5};renderPitchZone();};
$('fieldViewBtn').onclick=()=>{if(['pitch','contact'].includes(play.phase))return;fieldView=cameraView()!=='field';if(play.phase==='result'&&play.plan?.camera==='field')resetPlay();else renderControls();};
$('replayBtn').onclick=replayLast;$('skipReplayBtn').onclick=()=>{if(play.phase==='contact')presentResult();};
$('tacticsRow').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.pitch!==undefined)selectedPitch=Number(b.dataset.pitch);if(b.dataset.power!==undefined)power=Boolean(Number(b.dataset.power));render();};
$('rosterTable').onclick=e=>{const b=e.target.closest('[data-move]');if(!b||b.disabled)return;const [index,delta]=b.dataset.move.split(',').map(Number);if(game.reorder(index,delta)){persist();renderClub();}};
$('stealBtn').onclick=()=>{
  if(!isIdle())return;const before=snapshot(),batter={...game.batter},pitcher={...game.pitcher},event=game.steal();
  if(event.type==='blocked')return;const after=snapshot(),plan=planPlay(event,before,after);persist();
  play={phase:'contact',elapsed:0,duration:plan.duration,offense:true,event,plan,before,after,batter,pitcher,timing:'TAKING A CHANCE'};
  lastPlayback={...play};showOverlay('','',false);renderControls();
};

function syncPause(){paused=managementOpen||menuOpen||$('modalRoot').children.length>0;lastFrame=performance.now();}
function closeManageMenu(restoreFocus=false){
  menuOpen=false;$('manageMenu').hidden=true;$('manageToggle').setAttribute('aria-expanded','false');syncPause();renderControls();if(restoreFocus)$('manageToggle').focus();
}
function toggleManageMenu(){
  if(menuOpen){closeManageMenu(true);return;}
  menuOpen=true;$('manageMenu').hidden=false;$('manageToggle').setAttribute('aria-expanded','true');zonePointer=null;syncPause();renderControls();
  $('manageMenu').querySelector('[data-manage="sub"]').disabled=play.phase!=='ready'||game.gameOver;
  $('manageMenu').querySelector('button').focus();
}
function closeManagement(restoreFocus=true){
  managementOpen=false;$('managementLayer').hidden=true;document.body.dataset.management='closed';syncPause();renderControls();if(restoreFocus)$('manageToggle').focus();
}
function openManagement(screen,tab){
  closeManageMenu();managementOpen=true;document.body.dataset.management='open';
  const names={career:'Front office',roster:'Lineup & pitching staff',league:'Season & standings',rules:'Controls & help'};
  if(screen==='career'&&tab)careerUI.tab=tab;
  render();$('managementTitle').textContent=names[screen]||'Manage your club';
  $('managementContent').querySelectorAll('.screen').forEach(node=>node.classList.toggle('active',node.id==='screen-'+screen));
  $('managementLayer').hidden=false;syncPause();renderControls();$('managementClose').focus();$('managementContent').scrollTop=0;
}
function showScreen(screen){
  if(screen==='game'){closeManagement(false);activeScreen='game';document.body.dataset.screen='game';render();return;}
  openManagement(screen);
}
$('manageToggle').onclick=toggleManageMenu;$('managementClose').onclick=()=>closeManagement();
$('managementLayer').onclick=e=>{if(e.target===$('managementLayer'))closeManagement();};
$('manageMenu').onclick=e=>{
  const b=e.target.closest('[data-manage]');if(!b||b.disabled)return;const key=b.dataset.manage;
  if(key==='sub'){closeManageMenu();$('subBtn').click();return;}
  if(key==='draft'||key==='trades')openManagement('career',key);else openManagement(key);
};
document.addEventListener('click',e=>{if(menuOpen&&!e.target.closest('.manage-control'))closeManageMenu();});
document.querySelector('.brand').onclick=e=>{e.preventDefault();closeManageMenu();closeManagement(false);};
function openModal(title,body) {
  lastFocus=document.activeElement;paused=true;
  $('modalRoot').innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-heading"><h2>${title}</h2><button class="modal-close" aria-label="Close dialog" id="closeModal">×</button></div><div class="modal-body">${body}</div></section>`;
  $('closeModal').onclick=closeModal;$('closeModal').focus();
}
function closeModal(){$('modalRoot').replaceChildren();syncPause();renderControls();lastFocus?.focus();}
function openPause() {
  openModal('TIME OUT.',`<p>The game is paused. Take a breath. The ballpark will be here.</p><button class="big-button" id="resumeBtn">BACK TO THE GAME →</button><p class="install-note">Your season saves after every play.</p>`);
  $('resumeBtn').onclick=closeModal;
}
$('pauseBtn').onclick=openPause;
$('helpBtn').onclick=()=>{
  openModal('WELCOME TO THE CLUB.',`<h3>ON THE MOUND</h3><p>Use the separate strike-zone panel to locate your pitch, then tap Pitch. The outlined target is your aim; numbered dots show where actual pitches land. Pitcher control affects accuracy.</p><h3>AT THE PLATE</h3><p>Tap READY FOR PITCH. When the ball reaches your batter on the left, tap SWING or the field. Every contact switches to the whole field, where you can follow the ball and runners. CONTINUE starts the next play; REPLAY shows the last play again. There is no timing bar: watch the ball approach the plate and swing as it arrives. TAKE lets a pitch pass.</p><h3>YOUR CAREER</h3><p>Create a manager, take over the struggling Knights, and rebuild through the draft and trades in the Front Office. Finish twelve games to develop your players and enter the next season. Your manager and roster carry over.</p><p class="install-note">On iPhone: Share → Add to Home Screen. On Android: browser menu → Install app or Add to Home screen. Serve the game over HTTPS for offline play.</p><button class="big-button" id="letsPlay">LET’S PLAY BALL →</button>`);
  $('letsPlay').onclick=closeModal;
};
$('rulesLink').onclick=()=>showScreen('rules');
$('subBtn').onclick=()=>{
  if(!isIdle())return;
  openModal('CALL TO THE DUGOUT',`<h3>FRESH ARM</h3>${game.availablePitchers.map(p=>`<div class="sub-item"><div><b>${p.name}</b><small>CONTROL ${p.control} · VELOCITY ${p.velocity}</small></div><button class="tiny-button" data-relief="${p.id}">IN</button></div>`).join('')||'<p>All relief pitchers have entered.</p>'}<h3>PINCH HIT FOR ${game.homeRoster[game.state.order[game.state.bats[1]%9]].name.toUpperCase()}</h3>${game.availableBench.map(p=>`<div class="sub-item"><div><b>${p.name}</b><small>${p.contact} CONTACT · ${p.power} POWER</small></div><button class="tiny-button" data-bench="${p.id}">IN</button></div>`).join('')||'<p>No unused bench players.</p>'}<p class="install-note">Replaced players cannot return until the next game.</p>`);
};
$('modalRoot').onclick=e=>{
  if(e.target===$('modalRoot')){closeModal();return;}
  const b=e.target.closest('[data-relief],[data-bench]');if(!b)return;
  const success=b.dataset.relief!==undefined?game.substitutePitcher(Number(b.dataset.relief)):game.substituteBatter(Number(b.dataset.bench));
  if(success){persist();closeModal();render();$('resultText').textContent='A fresh face steps into the game.';}
};
$('resetSeasonBtn').onclick=()=>{
  if(game.career){showScreen('career');return;}
  openModal('A FRESH START.',`<p>Start a new season? Your current season and scores will be cleared.</p><h3>GAME LENGTH</h3><select id="inningsChoice" aria-label="Innings per game"><option value="3">3 innings · Pocket game</option><option value="9">9 innings · Full baseball</option></select><div class="modal-actions"><button class="secondary-button" id="cancelReset">KEEP PLAYING</button><button class="big-button" id="confirmReset">NEW SEASON →</button></div>`);
  $('inningsChoice').value=String(game.state.innings);$('cancelReset').onclick=closeModal;
  $('confirmReset').onclick=()=>{game.reset(Number($('inningsChoice').value));persist();closeModal();resetPlay(true);showScreen('game');};
};
function showSeasonResult() {
  const s=game.state,wins=s.results.filter(r=>r.win).length,rank=game.standings.findIndex(t=>t.id===0)+1;
  openModal('SEASON IN THE BOOKS.',`<p style="font-size:26px;color:var(--gold);font-weight:bold">${wins} WINS · ${12-wins} LOSSES</p><p>Your Knights finish #${rank} in the Pixel League. Every pitch, every swing — that was your season.</p><button id="seasonLeague" class="big-button">VIEW THE SEASON →</button>`);
  if(game.career){$('seasonLeague').textContent='OFFSEASON →';}
  $('seasonLeague').onclick=()=>{closeModal();showScreen(game.career?'career':'league');};
}
$('soundToggle').onclick=()=>{muted=!muted;$('soundToggle').textContent=muted?'♩':'♫';$('soundToggle').setAttribute('aria-pressed',String(!muted));$('soundToggle').setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');};
let spaceHeld=false;
function trapFocus(e,root){
  if(e.key!=='Tab')return;const f=[...root.querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]')].filter(x=>x.getClientRects().length),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z?.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a?.focus();}
}
document.addEventListener('keydown',e=>{
  if(document.body.classList.contains('at-title')||document.querySelector('[data-ui-modal]'))return;
  if($('modalRoot').children.length){if(e.key==='Escape'){e.preventDefault();closeModal();}trapFocus(e,$('modalRoot'));return;}
  if(managementOpen){if(e.key==='Escape'){e.preventDefault();closeManagement();}trapFocus(e,$('managementLayer'));return;}
  if(menuOpen){
    if(e.key==='Escape'){e.preventDefault();closeManageMenu(true);return;}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=[...$('manageMenu').querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
    trapFocus(e,$('manageMenu'));return;
  }
  if(e.key==='Escape'){openPause();return;}
  if(activeScreen!=='game'||e.target.matches('select,input,textarea')||e.altKey||e.metaKey||e.ctrlKey)return;
  if(e.code==='Space'&&e.target.closest('button,a')&&e.target.id!=='mainAction')return;
  if(e.code==='Space'){e.preventDefault();if(e.repeat||spaceHeld)return;spaceHeld=true;mainAction();}
  if(e.key.startsWith('Arrow')&&isIdle()&&!game.isBatting){e.preventDefault();aim=normalizeLocation(aim.u+(e.key==='ArrowRight'?.04:e.key==='ArrowLeft'?-.04:0),aim.v+(e.key==='ArrowDown'?.04:e.key==='ArrowUp'?-.04:0));renderPitchZone();}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'&&spaceHeld){e.preventDefault();spaceHeld=false;}});
function interruption() {
  spaceHeld=false;zonePointer=null;
  if(play.phase!=='ready'&&!paused)openPause();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)interruption();lastFrame=performance.now();});
window.addEventListener('blur',interruption);

function enterGame(){
  careerUI.hideTitle();closeManageMenu();closeManagement(false);activeScreen='game';document.body.dataset.screen='game';render();
}
careerUI=new CareerUI({
  game,
  onChange:()=>{persist();render();},
  onCreated:()=>{lastPlayback=null;fieldView=true;aim={u:.5,v:.5};persist();resetPlay(true);enterGame();},
  onPlay:(destination)=>{
    if(destination!=='office'&&game.gameOver&&game.state.game<11){game.nextGame();lastPlayback=null;fieldView=true;persist();resetPlay(true);}
    enterGame();
  }
});
for(const id of ['screen-career','screen-roster','screen-league','screen-rules'])$('managementContent').append($(id));
document.body.dataset.screen='game';render();requestAnimationFrame(frame);activeScreen='title';careerUI.showTitle();
if('serviceWorker' in navigator && location.protocol!=='file:') {
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offlineStatus').textContent='OFFLINE READY · TAKE THE GAME ANYWHERE';}).catch(()=>{$('offlineStatus').textContent='PLAY ONLINE · PROGRESS SAVES HERE';});
}
