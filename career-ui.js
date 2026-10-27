import { Stadium } from './stadium.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles = {
  scout: { name:'THE SCOUT', icon:'⌕', text:'Spot the next big thing.', bonus:'3 opening draft picks · 2 in later seasons' },
  developer: { name:'THE DEVELOPER', icon:'↗', text:'Turn potential into production.', bonus:'+4 offseason development instead of +2' },
  tactician: { name:'THE TACTICIAN', icon:'▦', text:'Win the little battles.', bonus:'+6 club credits to start your rebuild' },
};
const portraits = [
  { skin:'#e3b48a', cap:'#f5c66d', shirt:'#527a87', label:'Gold cap · light complexion' },
  { skin:'#b98059', cap:'#85c4be', shirt:'#4e6c8a', label:'Teal cap · medium complexion' },
  { skin:'#87553e', cap:'#e78b75', shirt:'#738d6c', label:'Coral cap · dark complexion' },
  { skin:'#d6a177', cap:'#b7a1d2', shirt:'#6c7c9a', label:'Violet cap · tan complexion' },
];
const rating = p => p.type === 'pitcher' || (p.control !== undefined && p.contact === undefined)
  ? Math.round((p.control + p.velocity) / 2)
  : Math.round((p.contact + p.power + p.speed) / 3);
const stars = value => '★'.repeat(Math.max(1,Math.min(5,Math.round(value/20))))+'☆'.repeat(5-Math.max(1,Math.min(5,Math.round(value/20))));
const statLabels = p => p.type === 'pitcher' || (p.control !== undefined && p.contact === undefined)
  ? [['CONTROL',p.control],['VELOCITY',p.velocity]] : [['CONTACT',p.contact],['POWER',p.power],['SPEED',p.speed]];

export class CareerUI {
  constructor({game,onChange=()=>{},onPlay=()=>{},onCreated=()=>{}}) {
    this.game=game;this.onChange=onChange;this.onPlay=onPlay;this.onCreated=onCreated;
    this.tab='overview';this.notice='';this.appearance=0;this.style='scout';this.selection={};this.dialog=null;
    this.start=document.createElement('section');this.start.id='careerStart';this.start.className='career-start';this.start.hidden=true;this.start.setAttribute('aria-label','Pixel Dugout career start');document.body.append(this.start);
    this.office=document.createElement('section');this.office.id='screen-career';this.office.className='screen';this.office.setAttribute('aria-label','Manager front office');document.querySelector('main').append(this.office);
    this.start.addEventListener('click',e=>this.handleStart(e));
    this.start.addEventListener('submit',e=>this.handleSubmit(e));
    this.office.addEventListener('click',e=>this.handleOffice(e));
    this.office.addEventListener('change',e=>this.handleSelection(e));
    document.addEventListener('keydown',e=>this.handleKeys(e),true);
  }
  portrait(index=0,large=false) {
    const p=portraits[Math.abs(Number(index)||0)%portraits.length];
    return `<div class="career-avatar ${large?'career-avatar-large':''}" style="--avatar-skin:${p.skin};--avatar-cap:${p.cap};--avatar-shirt:${p.shirt}" aria-hidden="true"><i class="career-avatar-face"></i><i class="career-avatar-hair"></i><i class="career-avatar-cap"></i><i class="career-avatar-body"></i><i class="career-avatar-collar"></i></div>`;
  }
  showTitle() {
    this.start.hidden=false;document.body.classList.add('at-title');
    this.start.innerHTML=`<div class="career-title-layout"><div class="career-title-art"><div class="career-title-wordmark"><span>THE NEXT GREAT BASEBALL STORY</span><h1>PIXEL<br><em>DUGOUT</em></h1><p>A BAD TEAM. A NEW MANAGER.<br>A WHOLE NEW BALLGAME.</p></div><canvas id="careerTitleCanvas" width="960" height="480" aria-label="Pixel baseball stadium"></canvas><div class="career-title-ticker"><span>★</span> FROM THE BOTTOM OF THE LEAGUE TO THE TOP OF THE WORLD <span>★</span></div></div><div class="career-title-menu"><div class="career-cartridge-label">CAREER EDITION <span>1987</span></div><span class="career-kicker">WELCOME TO THE BIG LEAGUES</span><h2>Your story.<br>Your dugout.</h2><p>Build a club worth believing in. Create your manager, find your stars, and make every season count.</p>${this.game.career?`<div class="career-save-preview">${this.portrait(this.game.career.manager.appearance)}<div><span>SAVED CAREER</span><strong>${escapeHTML(this.game.career.manager.name)}</strong><small>NEW YORK KNIGHTS · YEAR ${this.game.career.season}</small></div></div><button class="career-primary" data-start="continue">CONTINUE CAREER <b>→</b></button><button class="career-outline" data-start="create">CREATE A NEW MANAGER</button>`:`<button class="career-primary" data-start="create">CREATE YOUR MANAGER <b>→</b></button>${this.game.state.started||this.game.state.results?.length?'<button class="career-outline" data-start="legacy">CONTINUE EXISTING GAME</button>':''}`}<div class="career-title-features"><span>↗ DRAFT FUTURE STARS</span><span>⇄ MAKE THE BIG TRADE</span><span>⚾ PLAY EVERY PITCH</span></div><small class="career-local-note">YOUR CAREER SAVES ON THIS DEVICE.</small></div></div>`;
    const canvas=this.start.querySelector('canvas');if(canvas)new Stadium(canvas).draw({time:0,phase:'ready',offense:true});
    this.start.querySelector('button')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});
  }
  hideTitle() { this.start.hidden=true;document.body.classList.remove('at-title'); }
  showForm() {
    this.start.innerHTML=`<div class="career-create-shell"><button class="career-back" data-start="back">← TITLE SCREEN</button><header class="career-create-heading"><span class="career-kicker">YOUR FIRST DAY IN THE BIG LEAGUES</span><h1>MEET THE <em>MANAGER.</em></h1><p>Every rebuild starts with someone who believes.</p></header><form id="managerForm" class="career-manager-form"><div class="career-manager-left"><div class="career-portrait-stage">${this.portrait(this.appearance,true)}<span>THE NEXT CHAPTER STARTS WITH YOU</span></div><fieldset class="career-appearance"><legend>CHOOSE YOUR LOOK</legend>${portraits.map((p,i)=>`<button type="button" class="${i===this.appearance?'selected':''}" data-appearance="${i}" aria-label="${p.label}" aria-pressed="${i===this.appearance}">${this.portrait(i)}</button>`).join('')}</fieldset></div><div class="career-manager-right"><label class="career-field-label" for="managerName">MANAGER NAME</label><input id="managerName" name="managerName" type="text" maxlength="24" placeholder="Enter your name" autocomplete="nickname" required aria-describedby="managerNameHelp"><small id="managerNameHelp" class="career-field-help">The name on the office door. Up to 24 characters.</small><fieldset class="career-style-choices"><legend>YOUR COACHING STYLE</legend>${Object.entries(styles).map(([key,s])=>`<button type="button" class="career-style-choice ${key===this.style?'selected':''}" data-style="${key}" aria-pressed="${key===this.style}"><span class="career-style-icon">${s.icon}</span><span><b>${s.name}</b><small>${s.text}</small><em>${s.bonus}</em></span><i>${key===this.style?'●':'○'}</i></button>`).join('')}</fieldset><label class="career-field-label" for="careerInnings">GAME LENGTH</label><select id="careerInnings" name="innings"><option value="3">3 innings · Pocket baseball</option><option value="9">9 innings · The full nine</option></select><div class="career-contract"><span>YOUR FIRST ASSIGNMENT</span><strong>NEW YORK KNIGHTS</strong><p>Last season: <b>2–10</b>. Last place. An aging lineup and a thin bullpen. The owner is giving you the keys — and a chance to build it your way.</p></div>${this.game.career?'<label class="career-reset-warning"><input type="checkbox" id="careerReplaceConfirm" required> I understand this replaces my current saved manager, roster, and season.</label>':''}<p class="career-form-error" role="alert" id="careerFormError"></p><button class="career-primary" type="submit">${this.game.career?'REPLACE CAREER & SIGN':'SIGN THE CONTRACT'} <b>→</b></button></div></form></div>`;
    this.start.querySelector('#managerName').focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});
  }
  handleStart(e) {
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.start==='continue'){this.hideTitle();this.onPlay('office');}
    if(b.dataset.start==='legacy'){this.hideTitle();this.onPlay('game');}
    if(b.dataset.start==='create')this.showForm();
    if(b.dataset.start==='back')this.showTitle();
    if(b.dataset.appearance!==undefined){
      this.appearance=Number(b.dataset.appearance);
      this.start.querySelectorAll('[data-appearance]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});
      const stage=this.start.querySelector('.career-portrait-stage');stage.querySelector('.career-avatar').outerHTML=this.portrait(this.appearance,true);
    }
    if(b.dataset.style){this.style=b.dataset.style;this.start.querySelectorAll('[data-style]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));x.querySelector('i').textContent=x===b?'●':'○';});}
  }
  handleSubmit(e) {
    if(e.target.id!=='managerForm')return;e.preventDefault();
    const input=this.start.querySelector('#managerName'),name=input.value.trim();
    if(!name){this.start.querySelector('#careerFormError').textContent='Your manager needs a name before signing.';input.focus();return;}
    const ok=this.game.createCareer({name,appearance:this.appearance,style:this.style,innings:Number(this.start.querySelector('#careerInnings').value)});
    if(!ok){this.start.querySelector('#careerFormError').textContent='The contract could not be signed. Please check your name.';return;}
    this.notice='Contract signed. Welcome to New York. Your first draft picks are waiting.';this.tab='overview';this.hideTitle();this.onCreated(true);
  }
  render() {
    const c=this.game.career;
    if(!c){this.office.innerHTML='<div class="career-empty"><h1>YOUR DUGOUT IS WAITING.</h1><p>Create a manager to begin rebuilding the Knights.</p><button class="career-primary" data-office="title">CREATE MANAGER →</button></div>';return;}
    const g=this.game,ready=g.state.game===11&&g.gameOver,record=g.state.results.filter(r=>r.win).length;
    this.office.innerHTML=`<div class="career-office-heading"><div><span class="career-kicker">MANAGER ${escapeHTML(c.manager.name.toUpperCase())} / YEAR ${c.season}</span><h1>THE <span>${c.season===1?'REBUILD.':'NEXT CHAPTER.'}</span></h1><p>New York Knights · ${record}–${g.state.results.length-record} this season${c.season===1?' · Inherited a 2–10 club':''}</p></div><button class="career-small-btn" data-office="title">⌂ TITLE SCREEN</button></div><div class="career-resource-grid"><div><span>CLUB RATING</span><b>${g.teamRating.overall}<small>/99</small></b><em>${stars(g.teamRating.overall)}</em></div><div><span>CLUB CREDITS</span><b>${c.credits}<small> CR</small></b><em>EARNED AFTER EVERY GAME</em></div><div><span>DRAFT PICKS</span><b>${c.picks}<small> LEFT</small></b><em>FIND YOUR NEXT STAR</em></div><div><span>YOUR APPROACH</span><b class="career-style-value">${styles[c.manager.style]?.name.replace('THE ','')||'MANAGER'}</b><em>${c.manager.style==='developer'?'+4 OFFSEASON DEVELOPMENT':c.manager.style==='scout'?'EXTRA OPENING DRAFT PICK':'+6 STARTING CLUB CREDITS'}</em></div></div><div class="career-office-tabs" role="tablist" aria-label="Front office">${[['overview','THE OFFICE'],['draft','DRAFT ROOM'],['trades','TRADE DESK'],['history','CAREER LOG']].map(([id,label])=>`<button role="tab" aria-selected="${this.tab===id}" data-career-tab="${id}" class="${this.tab===id?'active':''}">${label}</button>`).join('')}</div><div class="career-notice ${this.notice?'has-message':''}" id="careerNotice" role="status">${escapeHTML(this.notice)}</div><div class="career-tab-content" role="tabpanel">${this.tab==='draft'?this.renderDraft():this.tab==='trades'?this.renderTrades():this.tab==='history'?this.renderHistory():this.renderOverview(ready)}</div>`;
  }
  renderOverview(seasonDone) {
    const c=this.game.career,r=this.game.teamRating;
    return `<div class="career-overview-grid"><article class="career-mission"><span class="career-kicker">FROM THE OWNER’S OFFICE</span><h2>${c.season===1?'Nobody said it would be easy.':'Keep building something special.'}</h2><p>${c.season===1?'The Knights finished last with a 2–10 record. The lineup needs life and the bullpen needs help. You have draft picks, a modest budget, and the final say. Turn this club around.':'The work continues. Develop your young players, fill the holes, and give New York another reason to believe.'}</p><div class="career-rating-comparison"><div><span>BATTING</span><b>${r.batting}</b><i style="--rating:${r.batting}%"></i></div><div><span>PITCHING</span><b>${r.pitching}</b><i style="--rating:${r.pitching}%"></i></div></div>${this.game.canManage&&c.picks>0?`<button class="career-draft-cta" data-career-tab="draft">ENTER THE DRAFT ROOM · ${c.picks} PICKS <b>→</b></button>`:''}<button class="career-primary" data-office="${seasonDone?'next-season':'play'}">${seasonDone?'START NEXT SEASON':this.game.gameOver?'ON TO THE NEXT GAME':this.game.state.started?'BACK TO THE BALLGAME':'PLAY GAME '+String(this.game.state.game+1).padStart(2,'0')} <b>→</b></button>${seasonDone?'<small class="career-action-note">Keep your roster. Develop your players. Receive new draft picks and fresh trade offers.</small>':'<small class="career-action-note">Your draft picks and trade opportunities remain available between games.</small>'}</article><div class="career-office-aside"><article class="career-manager-card">${this.portrait(c.manager.appearance)}<div><span>YOUR MANAGER</span><h3>${escapeHTML(c.manager.name)}</h3><p>${styles[c.manager.style]?.name||'THE MANAGER'} · YEAR ${c.season}</p></div></article><article class="career-objectives"><h3>THE REBUILD PLAYBOOK</h3><button data-career-tab="draft"><b>01</b><span>Draft a future star<small>${c.picks} pick${c.picks===1?'':'s'} still available</small></span><i>→</i></button><button data-career-tab="trades"><b>02</b><span>Make a smart trade<small>Swap a player. Strengthen the squad.</small></span><i>→</i></button><div><b>03</b><span>Develop your club<small>Play the season. Grow in the offseason.</small></span><i>↗</i></div></article><article class="career-budget-note"><span>THE LONG GAME</span><p>Games earn club credits. Use them to close trades. Draft picks bring new talent at no credit cost. The players you sign really take the field.</p></article></div></div>`;
  }
  rosterFor(player) { return player.type==='pitcher'?this.game.homePitchers:this.game.homeRoster; }
  selected(entry,kind) {
    const list=this.rosterFor(entry.player);const key=kind+':'+entry.id;
    const id=this.selection[key]??[...list].sort((a,b)=>rating(a)-rating(b))[0]?.id;
    return list.find(p=>String(p.id)===String(id))||list[0];
  }
  statsHTML(player) {
    return `<div class="career-player-stats">${statLabels(player).map(([name,value])=>`<div><span>${name}</span><b>${value}</b><i style="width:${value}%"></i></div>`).join('')}</div>`;
  }
  renderPlayerCard(entry,kind) {
    const p=entry.player,out=this.selected(entry,kind),taken=entry.taken;
    const price=kind==='trade'?this.game.tradePrice(entry.id,out.id):0;
    const available=this.game.canManage&&!taken&&(kind==='draft'?this.game.career.picks>0:price!==null&&price<=this.game.career.credits);
    const partner=typeof entry.team==='string'?entry.team:entry.team?.name||'PIXEL LEAGUE CLUB';
    return `<article class="career-player-card ${taken?'career-player-taken':''}"><div class="career-prospect-top"><span>${kind==='trade'?escapeHTML(partner.toUpperCase()):'DRAFT PROSPECT'}</span><b>${p.type==='pitcher'?'P':escapeHTML(p.pos||'HITTER')}</b></div><div class="career-prospect-intro"><div class="career-rating-badge">${rating(p)}<small>OVR</small></div><div><h3>${escapeHTML(p.name)}</h3><p>AGE ${p.age??20} · ${p.type==='pitcher'?'PITCHER':'POSITION PLAYER'}</p><span>UPSIDE ${p.potential??rating(p)} <i>↗</i></span></div></div>${this.statsHTML(p)}${taken?'<div class="career-completed-stamp">✓ ADDED TO THE CLUB</div>':`<label class="career-field-label" for="career-select-${kind}-${escapeHTML(entry.id)}">${kind==='trade'?'YOUR TRADE OFFER':'REPLACE ON YOUR ROSTER'}</label><select id="career-select-${kind}-${escapeHTML(entry.id)}" data-career-select="${kind}" data-entry="${escapeHTML(entry.id)}" ${!this.game.canManage?'disabled':''}>${this.rosterFor(p).map(slot=>`<option value="${slot.id}" ${slot.id===out.id?'selected':''}>${escapeHTML(slot.name)} · ${rating(slot)} OVR${slot.pos?' · '+escapeHTML(slot.pos):''}</option>`).join('')}</select><div class="career-player-upgrade"><span>PLAYER UPGRADE</span><b>${rating(out)} → <em class="${rating(p)>=rating(out)?'positive':'negative'}">${rating(p)}</em></b></div><button class="career-primary" data-career-${kind}="${escapeHTML(entry.id)}" ${available?'':'disabled'}>${kind==='draft'?'REVIEW DRAFT PICK':`REVIEW TRADE · ${price??'—'} CR`} <b>→</b></button>${kind==='trade'&&price!==null&&price>this.game.career.credits?'<small class="career-insufficient">Not enough club credits. Play games to earn more.</small>':''}`}</article>`;
  }
  renderDraft() {
    const c=this.game.career;
    return `<div class="career-panel-intro"><div><span class="career-kicker">BUILD THROUGH THE DRAFT</span><h2>The next face of the franchise.</h2><p>Use a pick to bring in a prospect. Choose who they replace. Their ratings become part of your actual lineup.</p></div><span class="career-pick-counter">${c.picks} PICKS LEFT</span></div>${!this.game.canManage?'<div class="career-lock-note">Ⅱ Finish the current game before making roster moves.</div>':c.picks===0?'<div class="career-lock-note">Your picks are in. Play the season for a fresh draft class next year.</div>':''}<div class="career-player-grid">${c.prospects.map(p=>this.renderPlayerCard(p,'draft')).join('')}</div>`;
  }
  renderTrades() {
    return `<div class="career-panel-intro"><div><span class="career-kicker">PICK UP THE PHONE</span><h2>One move can change a club.</h2><p>Other clubs want a player plus credits. Choose your outgoing player to see the price, then review the deal.</p></div><span class="career-pick-counter">${this.game.career.credits} CR AVAILABLE</span></div>${!this.game.canManage?'<div class="career-lock-note">Ⅱ Finish the current game before making roster moves.</div>':''}<div class="career-player-grid">${this.game.career.tradeOffers.map(p=>this.renderPlayerCard(p,'trade')).join('')}</div>`;
  }
  renderHistory() {
    const c=this.game.career;
    const seasons=(c.history||[]).map(h=>`<div class="career-history-row"><span>YEAR ${h.season??h.year??'—'}</span><b>${h.wins??h.w??'—'}–${h.losses??h.l??'—'}</b><small>${h.rank?'FINISHED #'+h.rank:h.label||'SEASON COMPLETE'}</small></div>`).join('');
    const transactions=(c.transactions||[]).slice(0,30).map(t=>`<div class="career-transaction"><span>${escapeHTML((t.kind||t.type)?.toUpperCase()||'CLUB NEWS')} ${t.season?'· YEAR '+t.season:''}</span><p>${escapeHTML(t.message||t.text||t.description||t.label||'The club made a roster move.')}</p></div>`).join('');
    return `<div class="career-history-grid"><article class="career-history-card"><h2>Your seasons</h2>${seasons||'<p class="career-empty-note">Your first season is still being written. Finish all twelve games to begin your next chapter.</p>'}</article><article class="career-history-card"><h2>The transaction wire</h2>${transactions||'<p class="career-empty-note">The office is open. Make your first draft pick or trade and leave your mark on the club.</p>'}</article></div>`;
  }
  handleSelection(e) {
    const select=e.target.closest('[data-career-select]');if(!select)return;
    this.selection[select.dataset.careerSelect+':'+select.dataset.entry]=Number(select.value);
    const scroll=window.scrollY;this.render();window.scrollTo(0,scroll);
    this.office.querySelector(`#${CSS.escape(select.id)}`)?.focus({preventScroll:true});
  }
  handleOffice(e) {
    const button=e.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.careerTab){this.tab=button.dataset.careerTab;this.notice='';this.render();return;}
    if(button.dataset.office==='title'){this.showTitle();return;}
    if(button.dataset.office==='play'){this.onPlay('game');return;}
    if(button.dataset.office==='next-season'){
      const result=this.game.beginNextSeason();this.notice=result.message;this.tab='overview';if(result.ok)this.onChange();this.render();return;
    }
    for(const kind of ['draft','trade'])if(button.dataset['career'+(kind==='draft'?'Draft':'Trade')]!==undefined){
      const id=button.dataset['career'+(kind==='draft'?'Draft':'Trade')];
      const entries=kind==='draft'?this.game.career.prospects:this.game.career.tradeOffers;
      const entry=entries.find(p=>String(p.id)===id);if(entry)this.review(entry,kind,button);return;
    }
  }
  review(entry,kind,opener) {
    if(this.dialog)return;
    const outgoing=this.selected(entry,kind),incoming=entry.player,price=kind==='trade'?this.game.tradePrice(entry.id,outgoing.id):0;
    const layer=document.createElement('div');layer.className='career-confirm-layer career-dialog';layer.dataset.uiModal='true';layer.innerHTML=`<section class="career-confirm" role="dialog" aria-modal="true" aria-labelledby="careerConfirmTitle"><div class="career-confirm-heading"><span class="career-kicker">${kind==='draft'?'ON THE CLOCK':'THE DEAL IS ON THE TABLE'}</span><h2 id="careerConfirmTitle">${kind==='draft'?'Make the pick?':'Make the trade?'}</h2></div><div class="career-confirm-body"><div class="career-deal-side"><span>JOINING THE KNIGHTS</span><strong>${escapeHTML(incoming.name)}</strong><b>${rating(incoming)} OVR</b></div><div class="career-deal-arrow">⇄</div><div class="career-deal-side outgoing"><span>LEAVING THE CLUB</span><strong>${escapeHTML(outgoing.name)}</strong><b>${rating(outgoing)} OVR</b></div><p class="career-deal-cost">${kind==='draft'?`USES 1 DRAFT PICK · ${this.game.career.picks-1} REMAINING`:`COSTS ${price} CLUB CREDITS · ${this.game.career.credits-price} REMAINING`}</p><p class="career-deal-warning">This permanently replaces ${escapeHTML(outgoing.name)} on your roster. Their spot in the lineup or pitching staff goes to your new player.</p><div class="career-confirm-actions"><button class="career-outline" id="careerCancelDeal">KEEP MY PLAYER</button><button class="career-primary" id="careerConfirmDeal">${kind==='draft'?'DRAFT PLAYER':'ACCEPT TRADE'} ✓</button></div></div></section>`;
    document.body.append(layer);this.dialog={layer,opener};
    const close=()=>{layer.remove();this.dialog=null;opener?.focus({preventScroll:true});};
    layer.querySelector('#careerCancelDeal').onclick=close;
    layer.addEventListener('click',e=>{if(e.target===layer)close();});
    layer.querySelector('#careerConfirmDeal').onclick=()=>{
      const result=kind==='draft'?this.game.draftPlayer(entry.id,outgoing.id):this.game.tradePlayer(entry.id,outgoing.id);
      close();this.notice=result.message;if(result.ok)this.onChange();this.render();this.office.querySelector('#careerNotice')?.scrollIntoView({block:'nearest',behavior:'auto'});
    };
    layer.querySelector('#careerCancelDeal').focus({preventScroll:true});
  }
  handleKeys(e) {
    if(this.dialog){
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.dialog.layer.querySelector('#careerCancelDeal').click();}
      if(e.key==='Tab'){
        const buttons=[...this.dialog.layer.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      if(e.code==='Space'||e.key.startsWith('Arrow'))e.stopPropagation();
    }else if(!this.start.hidden){
      if(e.key==='Escape'&&this.start.querySelector('#managerForm')){e.preventDefault();this.showTitle();}
      e.stopPropagation();
    }
  }
}
