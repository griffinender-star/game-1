import { BaseballGame, teams, roster, pitchers } from './engine.js';
import { Stadium, FIELD } from './stadium.js';
import { CareerUI } from './career-ui.js';
import { planPlay } from './playback.js';
import { PITCH_TYPES, DIFFICULTIES, normalizeLocation, targetToLocation, pitchPoint, swingQuality, samplePitch } from './pitch-model.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'pixel-dugout-v2';
let saved, careerUI;
let preferences={difficulty:'standard',flow:true,sound:true};
try { const p=JSON.parse(localStorage.getItem('dugout-play-settings'));if(p){if(DIFFICULTIES.some(d=>d.key===p.difficulty))preferences.difficulty=p.difficulty;if(typeof p.flow==='boolean')preferences.flow=p.flow;if(typeof p.sound==='boolean')preferences.sound=p.sound;} } catch { /* Defaults also work without storage. */ }
let fieldView=true,lastPlayback=null,zonePointer=null,managementOpen=false,menuOpen=false;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* Private browsing can disable storage. */ }
const game = new BaseballGame(saved);
const stadium = new Stadium($('gameCanvas'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pitchTypes=PITCH_TYPES;
let selectedPitch = 0, power = false, muted = !preferences.sound, paused = false, activeScreen = 'game', lastFocus;
let aim={u:.5,v:.5},intro=true;
let play = { phase:'ready', elapsed:0 }, lastFrame = performance.now(), sessionTime = 0, audio;

function persist() {
  try { localStorage.setItem(SAVE_KEY,game.serialize()); $('saveStatus').textContent = '✓ Saved'; }
  catch { $('saveStatus').textContent = 'Save unavailable'; }
}
function savePreferences(){try{localStorage.setItem('dugout-play-settings',JSON.stringify(preferences));}catch{/* Play settings remain usable for this session. */}}
const sentence=text=>text?text.charAt(0).toUpperCase()+text.slice(1).toLowerCase():'';
const pitchProgress=current=>(current.elapsed-(current.windup||0))/current.duration;
function unlockAudio(){
  if(muted)return;
  try {const A=window.AudioContext||window.webkitAudioContext;audio ||= new A();audio.resume().catch(()=>{});}catch{/* Audio is optional on every device. */}
}
function tone(kind='pitch') {
  if(muted) return;
  try {
    const A=window.AudioContext||window.webkitAudioContext;
    audio ||= new A(); audio.resume();
    const t=audio.currentTime,duration=kind==='hit'?.18:.14;
    const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,kind==='hit'?4:1.7);
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;
    filter.type=kind==='hit'?'highpass':'lowpass';filter.frequency.value=kind==='hit'?1300:kind==='swing'?1700:650;
    gain.gain.setValueAtTime(kind==='hit'?.14:.055,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(t);
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
  if(['pitch','impact'].includes(play.phase))return 'pitch';
  if(play.plan?.camera==='field'&&['contact','result'].includes(play.phase))return 'field';
  return fieldView?'field':'pitch';
}
function updateCameraUI() {
  const view=cameraView(),review=['impact','contact','result'].includes(play.phase);
  document.body.dataset.playView=view;document.body.dataset.playPhase=play.phase;
  $('fieldViewBtn').textContent=view==='field'?'Plate view':'Full field';
  $('fieldViewBtn').disabled=['pitch','impact','contact'].includes(play.phase);
  $('cameraLabel').textContent=play.replaying?' / Replay':view==='field'?' / Field':' / Plate';
  $('replayBtn').disabled=!lastPlayback||!['ready','result'].includes(play.phase)||paused;
  $('skipReplayBtn').hidden=play.phase!=='contact';
  $('hitRibbon').hidden=!review||!play.event;
  if(review&&play.event){
    $('hitLabel').textContent=sentence(play.event.label);
    $('hitDetail').textContent=play.event.scored?`${play.event.scored} run${play.event.scored===1?'':'s'} scored`:sentence(play.plan?.direction||play.timing||'');
  }
  $('playCaption').textContent=play.phase==='contact'?(play.replaying?'Replay · ':'Ball in play · ')+sentence(play.plan?.direction||'Follow the play'):play.phase==='result'?(play.event?.inningChanged?`END ${play.event.before.half?'BOTTOM':'TOP'} ${play.event.before.inning} · `:'')+(play.event?.text||'Continue for the next play'):view==='field'?'Knights Park · Live baseball':game.isBatting?'Watch the delivery. Meet the ball at the plate.':'Locate your pitch in the side strike zone.';
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
  const inZone=Math.random()>(game.state.balls===3?.14:game.state.strikes===2?.34:.24);
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
  $('pitchCommand').textContent=`${game.pitcher.control} control · ${game.state.pitches[1]>50?'Fatiguing':'Fresh arm'}`;
  const history=pitchRecords();$('pitchMarkers').replaceChildren(...history.map((p,i)=>{
    const dot=document.createElement('span');dot.className='pitch-mark '+(['single','double','triple','homerun'].includes(p.event)?'pitch-hit':p.event==='ball'||p.event==='walk'?'pitch-ball':'pitch-strike')+(i===history.length-1?' latest':'');
    dot.style.left=`${clamp(p.u,.03,.97)*100}%`;dot.style.top=`${clamp(p.v,.03,.97)*100}%`;dot.style.opacity=String(.35+.65*(i+1)/history.length);dot.textContent=p.number;
    dot.title=`Pitch ${p.number}: ${pitchTypes[p.type].name.toLowerCase()}, ${p.velocity} mph, ${p.result.toLowerCase()}`;return dot;
  }));
  const last=history[history.length-1];
  $('pitchResultText').textContent=play.phase==='pitch'&&!play.offense?(play.released?'Pitch in flight…':'Winding up…'):last?`#${last.number} · ${last.velocity} mph · ${last.result}`:'Choose your spot';
}
function launch(options) {
  intro=false;game.state.started=true;
  const z=FIELD.zone;
  play={...options,phase:'pitch',elapsed:0,windup:420,released:false,swung:false,quality:0,swingAt:-1,
    inZone: options.target.x>=z.x&&options.target.x<=z.x+z.w&&options.target.y>=z.y&&options.target.y<=z.y+z.h,
    power, pitchType:options.pitchType??selectedPitch};
  showOverlay('','',false);renderControls();
}
function swing() {
  if(paused||play.phase!=='pitch'||!play.offense||play.swung||play.taking||!play.released)return;
  play.swung=true;play.swingAt=play.elapsed+clamp(performance.now()-lastFrame,0,50);
  const contact=swingQuality((play.swingAt-play.windup)/play.duration,game.batter.contact,preferences.difficulty);
  play.quality=contact.quality;play.feedback=contact.feedback;
  tone('swing');haptic();renderControls();
}
function resolve() {
  const previous={...play},before=snapshot(),batter={...game.batter},pitcher={...game.pitcher};
  const actual=targetToLocation(play.target),edge=Math.max(Math.abs(actual.u-.5),Math.abs(actual.v-.5))/.32;
  const recent=pitchRecords().slice(-3),repeats=recent.filter(p=>p.type===play.pitchType).length;
  const event=game.resolvePitch({swing:play.swung,quality:play.quality,inZone:play.inZone,pitchQuality:play.pitchQuality,power:play.power,locationQuality:clamp(edge,0,1),pitchVariety:1-repeats/3});
  const spray=previous.offense&&previous.swung?clamp(((previous.swingAt-previous.windup)/previous.duration-1)/.10,-1,1):undefined;
  const after=snapshot(),plan=planPlay({...event,...(spray===undefined?{}:{spray})},before,after);
  recordPitch(previous,event);persist();
  const timing=previous.offense&&previous.swung?previous.feedback:!previous.offense?(previous.command>.8?'LOCATED WELL':'PITCH COMPLETE'):'PITCH TAKEN';
  play={...previous,phase:'result',elapsed:0,event,timing,plan,before,after,batter,pitcher};
  if(plan.camera==='field'){
    play.phase='contact';play.duration=reducedMotion?Math.max(1000,plan.duration*.65):plan.duration;
    lastPlayback={...play};
    if(plan.contact){play.fieldDuration=play.duration;play.phase='impact';play.duration=180;tone('hit');}
    showOverlay('','',false);renderControls();
  }else{lastPlayback=null;presentResult();}
}
function presentResult() {
  play.phase='result';play.elapsed=0;
  const e=play.event;
  showOverlay('','',false);$('resultText').textContent=e.text;
  if(!play.replaying&&(e.type==='homerun'||game.gameOver))haptic([20,40,20]);
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
  const canSwing=incoming&&play.released&&!play.swung&&!play.taking;
  $('actionKicker').textContent=over?'Final score':offense?'At the plate':'On the mound';
  $('actionTitle').textContent=over?(game.state.score[1]>game.state.score[0]?'Knights win.':'Next game, fresh start.'):offense?'Find your pitch.':'Work the corners.';
  $('controlHint').textContent=over?'Your result is saved. Keep the season rolling.':offense?'Watch the ball arrive at the plate. Tap Swing or the field to connect.':'Choose a target in the side strike zone, then tap Pitch.';
  $('mainActionLabel').textContent=result?(over?(game.state.game===11?'Season results':'Next game →'):'Continue →'):over?(game.state.game===11?'Season results':'Next game →'):canSwing?'Swing':incoming?(play.taking?'Taking pitch':play.swung?'Swing taken':'Pitcher winding up'):play.phase==='ready'?(offense?'Start at-bat':'Pitch'):'Ball in play';
  $('mainActionSub').textContent=result?(preferences.flow&&!play.replaying&&!over?'Flow play · next play shortly':'Ready when you are'):over?`${game.state.results.filter(r=>r.win).length} wins this season`:incoming?(play.swung?sentence(play.feedback):play.released?'Meet the ball at the plate':'Watch the delivery'):offense?'Watch the delivery. Trust your swing.':'Throw to your target';
  $('mainAction').disabled=paused||(!result&&((!over&&busy&&!canSwing)||(over&&play.phase!=='ready')));
  $('secondaryAction').textContent=incoming?'Take pitch':'Sim half ›';
  $('secondaryAction').disabled=paused||over||(busy&&!incoming)||(incoming&&(play.swung||play.taking));
  $('tacticsRow').innerHTML=offense?['Contact','Power'].map((n,i)=>`<button class="tactic ${power===Boolean(i)?'active':''}" data-power="${i}" aria-pressed="${power===Boolean(i)}" ${['pitch','impact','contact'].includes(play.phase)||over?'disabled':''}>${n}</button>`).join(''):pitchTypes.map((p,i)=>`<button class="tactic ${selectedPitch===i?'active':''}" data-pitch="${i}" aria-pressed="${selectedPitch===i}" ${['pitch','impact','contact'].includes(play.phase)||over?'disabled':''}>${sentence(p.name)}</button>`).join('');
  $('battingPanel').hidden=!offense;
  $('swingFeedback').textContent=play.swung?sentence(play.feedback):incoming?(play.released?'Ball in flight':'Watch the windup'):result?sentence(play.event?.label):`${DIFFICULTIES.find(d=>d.key===preferences.difficulty).label} timing`;
  $('swingFeedback').dataset.contact=play.swung?(play.quality>=.75?'good':play.quality>=.22?'fair':'miss'):'ready';
  $('difficultySelect').value=preferences.difficulty;$('difficultySelect').disabled=busy&&!result;
  $('autoContinue').checked=preferences.flow;
  $('stealBtn').disabled=!isIdle()||!game.isBatting||!game.state.bases[0]||game.state.bases[1];
  $('subBtn').disabled=!isIdle(); $('aimReset').hidden=true; $('aimReset').disabled=busy||paused;
  renderPitchZone();updateCameraUI();

}
function render() {
  const s=game.state,p=play.batter&&['impact','contact','result'].includes(play.phase)?play.batter:game.batter,opp=game.opponent, wins=s.results.filter(r=>r.win).length;
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
  $('outsLabel').textContent=`${displayOuts} out${displayOuts===1?'':'s'}`;$('gameLength').textContent=`${s.innings} innings`;
  $('balls').textContent=play.replaying&&play.after?play.after.balls:s.balls;$('strikes').textContent=play.replaying&&play.after?play.after.strikes:s.strikes;$('outs').textContent=displayOuts;
  $('modeTag').textContent=s.over?'Final':game.isBatting?'Batting':'Pitching';
  $('pitchInfo').textContent=play.velocity?`${sentence(pitchTypes[play.pitchType]?.name||'Pitch')} · ${play.velocity} mph`:game.isBatting?`${power?'Power':'Contact'} swing`:`${sentence(pitchTypes[selectedPitch].name)} · ${pitchTypes[selectedPitch].speed} mph`;
  const displayBases=play.plan&&['contact','result'].includes(play.phase)?play.plan.displayBases:s.bases;
  [1,2,3].forEach((n,i)=>$('base'+n).classList.toggle('on',displayBases[i]));
  $('baseDiamond').setAttribute('aria-label',displayBases.some(Boolean)?`Runners on ${displayBases.map((v,i)=>v?['first','second','third'][i]:'').filter(Boolean).join(' and ')}`:'Bases empty');
  $('batterName').textContent=p.name;$('batterPosition').textContent=`${p.pos} · Right handed`;
  $('playerNumber').textContent=String(p.id+1).padStart(2,'0');$('playerRole').textContent=game.isBatting?'Your hitter':'Visiting hitter';
  $('matchupSide').textContent=`${s.half?'BOT':'TOP'} ${s.inning}`;
  $('pitcherName').textContent=(play.pitcher&&['impact','contact','result'].includes(play.phase)?play.pitcher:game.pitcher).name;
  $('playerStars').textContent=`${Math.round((p.contact+p.power+p.speed)/3)} OVR`;
  $('skillBars').innerHTML=[['Contact',p.contact],['Power',p.power],['Speed',p.speed]].map(([n,v])=>`<div class="skill-row"><span>${n}</span><div class="skill-track"><i style="width:${v}%"></i></div><b>${v}</b></div>`).join('');
  const length=Math.max(s.innings,s.inning);
  $('lineScore').innerHTML=`<table class="line-table"><thead><tr><th>CLUB</th>${Array.from({length},(_,i)=>`<th>${i+1}</th>`).join('')}<th>R</th><th>H</th></tr></thead><tbody>${[0,1].map(t=>`<tr><td>${t?'NYK':opp.short}</td>${Array.from({length},(_,i)=>`<td>${s.lines[t][i]??'–'}</td>`).join('')}<td class="total">${s.score[t]}</td><td>${s.hits[t]}</td></tr>`).join('')}</tbody></table>`;
  const log=s.log.slice(0,7);$('playLog').replaceChildren(...(log.length?log.map(e=>{const el=document.createElement('p'),tag=document.createElement('b');tag.textContent=e.tag||'';el.append(tag,document.createTextNode(e.text));return el;}):[Object.assign(document.createElement('p'),{textContent:'The grass is cut. The crowd is ready. Let’s play ball.'})]));
  $('resultText').textContent=s.log[0]?.text||'Welcome to Knights Park. Your season starts here.';
  renderClub();renderLeague();renderControls();careerUI?.render();
  $('resetSeasonBtn').textContent=game.career?'Front office ↗':'New season ↻';
  if(play.phase==='ready')showOverlay(s.over?'FINAL SCORE':game.isBatting?'YOUR TURN AT THE PLATE':'TAKE THE MOUND',s.over?(s.score[1]>s.score[0]?'KNIGHTS WIN!':'FINAL OUT.'):game.isBatting?'WAIT FOR YOUR PITCH.':'PAINT THE CORNERS.',intro||s.over);
}
function renderClub() {
  const s=game.state;
  $('rosterTable').innerHTML=game.lineup.map((p,i)=>`<div class="roster-player"><span>${i+1}</span><div><b>${p.name}</b><small>${p.pos}</small></div><div class="ratings">${p.contact} / ${p.power}</div><div class="move-buttons"><button data-move="${i},-1" aria-label="Move ${p.name} up" ${s.started||i===0?'disabled':''}>▲</button><button data-move="${i},1" aria-label="Move ${p.name} down" ${s.started||i===8?'disabled':''}>▼</button></div></div>`).join('');
  $('pitchingRoster').innerHTML=game.homePitchers.map(p=>`<div class="staff-player"><div><b>${p.name}</b><small>Control ${p.control} · Velocity ${p.velocity}</small></div><span>${s.pitchers[1]===p.id?`${s.pitches[1]} PITCHES`:s.usedPitchers.includes(p.id)?'USED':'READY'}</span></div>`).join('');
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
      const progress=pitchProgress(play);
      if(!play.released&&progress>=0){play.released=true;tone('pitch');renderControls();}
      if(progress>=1.20||(play.taking&&progress>=1.04)||(play.swung&&progress>=Math.max(1.015,(play.swingAt-play.windup)/play.duration+.02)))resolve();
    } else if(play.phase==='impact'&&play.elapsed>=play.duration){play.phase='contact';play.elapsed=0;play.duration=play.fieldDuration;renderControls();}
    else if(play.phase==='contact'&&play.elapsed>=play.duration)presentResult();
    else if(play.phase==='result'&&preferences.flow&&!play.replaying&&!game.gameOver&&play.elapsed>=(play.plan?.camera==='field'?2400:1300)){
      const changed=play.event?.inningChanged;continuePlay();
      if(!changed&&game.isBatting)readyToBat();
    }
  }
  if(activeScreen!=='game'||paused){requestAnimationFrame(frame);return;}
  const current=play, offense=current.phase==='ready'?game.isBatting:current.offense??game.isBatting;
  const progress=current.phase==='pitch'?clamp(pitchProgress(current),0,1.25):0;
  const ball=current.phase==='pitch'&&current.released?pitchPoint(progress,current.target,current.pitchType):null;
  stadium.draw({time:reducedMotion?0:sessionTime,phase:current.phase,offense,progress,windup:current.phase==='pitch'?clamp(current.elapsed/(current.windup||1),0,1):0,aim:null,ball,
    hit:current.phase==='impact'?{progress:clamp(current.elapsed/current.duration,0,1)*.18,quality:current.event?.quality??.5}:null,
    swingProgress:current.phase==='impact'?.42+clamp(current.elapsed/current.duration,0,1)*.55:current.swingAt>=0?clamp((current.phase==='pitch'?current.elapsed-current.swingAt:current.elapsed+200)/450,0,1):-1,
    view:cameraView(),bases:game.state.bases,
    playback:current.plan?.camera==='field'&&['contact','result'].includes(current.phase)?{...current.plan,progress:current.phase==='result'?1:clamp(current.elapsed/current.duration,0,1)}:null});
  requestAnimationFrame(frame);
}

function mainAction(){
  if(paused||managementOpen||menuOpen||$('mainAction').disabled)return;
  unlockAudio();
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
$('fieldViewBtn').onclick=()=>{if(['pitch','impact','contact'].includes(play.phase))return;fieldView=cameraView()!=='field';if(play.phase==='result'&&play.plan?.camera==='field')resetPlay();else renderControls();};
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
  openModal('Game paused',`<p>The game is paused. Take a breath. The ballpark will be here.</p><button class="big-button" id="resumeBtn">Back to game →</button><p class="install-note">Your season saves after every play.</p>`);
  $('resumeBtn').onclick=closeModal;
}
$('pauseBtn').onclick=openPause;
$('helpBtn').onclick=()=>{
  openModal('Welcome to the club',`<h3>On the mound</h3><p>Use the separate strike-zone panel to locate your pitch, then tap Pitch. The outlined target is your aim; numbered dots show where actual pitches land. Pitcher control affects accuracy.</p><h3>At the plate</h3><p>Tap Start at-bat. When the ball reaches your batter on the left, tap Swing or the field. Every contact switches to the whole field, where you can follow the ball and runners. Continue starts the next play; Replay shows the last play again. Flow play advances automatically after a short break; turn it off to hold each result. Relaxed and All-Star change timing forgiveness. There is no timing bar: watch the ball approach the plate and swing as it arrives. Take pitch lets a pitch pass.</p><h3>Your career</h3><p>Create a manager, take over the struggling Knights, and rebuild through the draft and trades in the Front Office. Finish twelve games to develop your players and enter the next season. Your manager and roster carry over.</p><p class="install-note">On iPhone: Share → Add to Home Screen. On Android: browser menu → Install app or Add to Home screen. Serve the game over HTTPS for offline play.</p><button class="big-button" id="letsPlay">Let’s play ball →</button>`);
  $('letsPlay').onclick=closeModal;
};
$('rulesLink').onclick=()=>showScreen('rules');
$('subBtn').onclick=()=>{
  if(!isIdle())return;
  openModal('Make a substitution',`<h3>Relief pitchers</h3>${game.availablePitchers.map(p=>`<div class="sub-item"><div><b>${p.name}</b><small>Control ${p.control} · Velocity ${p.velocity}</small></div><button class="tiny-button" data-relief="${p.id}">Select</button></div>`).join('')||'<p>All relief pitchers have entered.</p>'}<h3>Pinch hit for ${game.homeRoster[game.state.order[game.state.bats[1]%9]].name.toUpperCase()}</h3>${game.availableBench.map(p=>`<div class="sub-item"><div><b>${p.name}</b><small>${p.contact} contact · ${p.power} power</small></div><button class="tiny-button" data-bench="${p.id}">Select</button></div>`).join('')||'<p>No unused bench players.</p>'}<p class="install-note">Replaced players cannot return until the next game.</p>`);
};
$('modalRoot').onclick=e=>{
  if(e.target===$('modalRoot')){closeModal();return;}
  const b=e.target.closest('[data-relief],[data-bench]');if(!b)return;
  const success=b.dataset.relief!==undefined?game.substitutePitcher(Number(b.dataset.relief)):game.substituteBatter(Number(b.dataset.bench));
  if(success){persist();closeModal();render();$('resultText').textContent='A fresh face steps into the game.';}
};
$('resetSeasonBtn').onclick=()=>{
  if(game.career){showScreen('career');return;}
  openModal('Start a new season',`<p>Start a new season? Your current season and scores will be cleared.</p><h3>Game length</h3><select id="inningsChoice" aria-label="Innings per game"><option value="3">3 innings · Pocket game</option><option value="9">9 innings · Full baseball</option></select><div class="modal-actions"><button class="secondary-button" id="cancelReset">Keep playing</button><button class="big-button" id="confirmReset">New season →</button></div>`);
  $('inningsChoice').value=String(game.state.innings);$('cancelReset').onclick=closeModal;
  $('confirmReset').onclick=()=>{game.reset(Number($('inningsChoice').value));persist();closeModal();resetPlay(true);showScreen('game');};
};
function showSeasonResult() {
  const s=game.state,wins=s.results.filter(r=>r.win).length,rank=game.standings.findIndex(t=>t.id===0)+1;
  openModal('Season complete',`<p style="font-size:26px;color:var(--gold);font-weight:bold">${wins} WINS · ${12-wins} LOSSES</p><p>Your Knights finish #${rank} in the Dugout League. Every pitch, every swing — that was your season.</p><button id="seasonLeague" class="big-button">View the season →</button>`);
  if(game.career){$('seasonLeague').textContent='Offseason →';}
  $('seasonLeague').onclick=()=>{closeModal();showScreen(game.career?'career':'league');};
}
$('soundToggle').onclick=()=>{muted=!muted;preferences.sound=!muted;savePreferences();unlockAudio();$('soundToggle').textContent=muted?'♩':'♫';$('soundToggle').setAttribute('aria-pressed',String(!muted));$('soundToggle').setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');};
$('difficultySelect').onchange=()=>{if(['pitch','impact','contact'].includes(play.phase))return;preferences.difficulty=$('difficultySelect').value;savePreferences();renderControls();};
$('autoContinue').onchange=()=>{preferences.flow=$('autoContinue').checked;if(play.phase==='result')play.elapsed=0;savePreferences();renderControls();};
$('soundToggle').textContent=muted?'♩':'♫';$('soundToggle').setAttribute('aria-pressed',String(!muted));$('soundToggle').setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');
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
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offlineStatus').textContent='Offline ready · Play anywhere';}).catch(()=>{$('offlineStatus').textContent='Play online · Progress saves here';});
}
