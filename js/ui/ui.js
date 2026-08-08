/* Screens: splash → login → slots → create/home → delve; overlay sheets; HUD */
import {S,makeCharacter,randRecipe,refresh,partyUnits,persist,restore,grantXp,
        resetState,rollSagaName,slotSummary} from '../game/state.js';
import {D,startDelve} from '../game/combat.js';
import {ARCHETYPES,ARCH_KEYS,STAT_WEIGHTS,skillColor} from '../config/skills.js';
import {BAL} from '../config/balance.js';
import {GEAR_BASES} from '../config/gear.js';
import {rollPal,WEAPONS,OFFHANDS,TORSOS,LEGS} from '../art/parts.js';
import {getFrame} from '../art/assemble.js';
import {itemName,sameFamily,tryMerge} from '../game/loot.js';
import {scaledStats} from '../game/stats.js';
import {sysRng,RI,pick} from '../core/rng.js';
import {on,emit} from '../core/bus.js';
import {canvasPoint,bindCanvas,fitCanvas,getZoom,setZoom,minimapHitClient,renderFullMap} from '../render/iso.js';
import {wipeSave,setSlot,wipeSlot,SLOT_COUNT,saveSession,loadSession,clearSession} from '../core/save.js';
import {ambientAttach,ambientDetach} from '../render/ambient.js';

const $=id=>document.getElementById(id);
const el=(tag,cls,html)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(html!=null)d.innerHTML=html;return d;};
/* ── real item icons: render the item's actual gear sprite (not an emoji) ── */
const ICON_PAL={o:'#0d0a12',1:'#5a4a63',2:'#786688',3:'#9a86ad',5:'#4a3a2a',6:'#6e5840',
  s:'#c9a06a',S:'#e6c48e',n:'#8a6a44',q:'#b98a3a',Q:'#e8c46a',x:'#5FE0F0',X:'#CFF6FC',
  w:'#C9C2AE',W:'#EFE9D6',l:'#6B4F30',L:'#8A6A44',e:'#181218',y:'#FBF2D6'};
const PART_SET={weapon:WEAPONS,offhand:OFFHANDS,armor:TORSOS,boots:LEGS};
function bakeGrid(rows,pal){
  const h=rows.length,w=rows[0].length;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ch=rows[y][x];if(!ch||ch==='.')continue;g.fillStyle=pal[ch]||'#f0f';g.fillRect(x,y,1,1);}
  return c;
}
/* returns an icon box element (fixed size, sprite centered & pixel-scaled) */
function itemIconEl(it,box){
  box=box||30;
  const wrap=el('div','iconbox');wrap.style.width=wrap.style.height=box+'px';
  const def=(PART_SET[it.slot]||[])[it.part];
  if(def&&def.g){
    const cv=bakeGrid(def.g,ICON_PAL);
    const k=Math.max(1,Math.floor((box-4)/Math.max(cv.width,cv.height)));
    cv.style.width=(cv.width*k)+'px';cv.style.height=(cv.height*k)+'px';
    cv.style.imageRendering='pixelated';wrap.appendChild(cv);
  } else wrap.textContent='▪';
  return wrap;
}
export function toast(msg){
  const t=$('toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),1400);
}
on('toast',d=>toast(d.msg));

/* every character — player and companions alike — earns 1 skill point per level to
   spend on learning/ranking skills and to order their auto-cast priority. */
export function ranks(c){
  const un=[1,3,6];
  return [0,1,2].map(i=>c.lv>=un[i]?1+Math.floor((c.lv-un[i])/5):0);
}
export const SKILL_MAX=5;
const skillSpent=c=>(c.skillRanks||[]).reduce((a,b)=>a+(b||0),0);
const skillAvail=c=>Math.max(0,c.lv-skillSpent(c));
function portrait(c,cnv,scale){
  refresh(c);
  const fr=getFrame(c.recipe,c.pal,'idle',0,1);
  cnv.width=fr.width;cnv.height=fr.height;
  const g=cnv.getContext('2d');g.imageSmoothingEnabled=false;
  g.clearRect(0,0,cnv.width,cnv.height);g.drawImage(fr,0,0);
  cnv.style.width=(fr.width*(scale||2))+'px';
  cnv.style.height=(fr.height*(scale||2))+'px';
}
/* which screens carry the living NPC backdrop, and the canvas that hosts it */
const AMB={'scr-splash':'amb-splash','scr-login':'amb-login','scr-slots':'amb-slots',
           'scr-create':'amb-create','scr-town':'amb-town'};
export function show(id){
  for(const s of document.querySelectorAll('.screen'))s.classList.remove('on');
  $(id).classList.add('on');
  S.screen=id;
  const ac=AMB[id]&&$(AMB[id]);
  if(ac)ambientAttach(ac); else ambientDetach();
}
function closeSheets(){for(const s of document.querySelectorAll('.osheet'))s.classList.remove('on');$('veil').classList.remove('on');}
function openSheet(id){$('veil').classList.add('on');$(id).classList.add('on');}
$('veil').onclick=()=>{closeSheets();if(S.screen==='scr-delve')D.paused=false;};

/* ═══ CREATE ═══ */
let draft=null;
export function initCreate(){
  const chips=$('cc-arch');chips.innerHTML='';
  ARCH_KEYS.forEach((k,i)=>{
    const b=el('button','chip'+(i===0?' on':''),ARCHETYPES[k].n.toUpperCase());
    b.onclick=()=>{chips.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');draft.arch=k;rerollDraft(false);};
    chips.appendChild(b);
  });
  draft={arch:'fighter'};
  rerollDraft(true);
  $('cc-reroll').onclick=()=>rerollDraft(true);
  $('cc-colors').onclick=()=>{draft.char.pal=rollPal(sysRng);paintCreate();};
  $('cc-start').onclick=()=>{
    S.player=draft.char;S.player.isPlayer=true;
    S.sagaName=rollSagaName();
    S.tavern=[];fillTavern();
    persist();buildTown();show('scr-town');
    toast('WELCOME TO TORCHFALL, '+S.player.name.toUpperCase());
  };
}
function rerollDraft(newChar){
  const arch=draft.arch;
  const rec=randRecipe(sysRng,arch);
  if(newChar||!draft.char)draft.char=makeCharacter(arch,rec,rollPal(sysRng),true);
  else{draft.char.arch=arch;draft.char.base={...ARCHETYPES[arch].stats};draft.char.recipe=rec;}
  paintCreate();
}
function paintCreate(){
  const c=draft.char;
  portrait(c,$('cc-face'),3);
  $('cc-name').textContent=c.name;
  $('cc-desc').innerHTML=ARCHETYPES[c.arch].skills.map(s=>
    `<div class="skrow"><span>${s.g} <b>${s.n}</b></span><i>${s.d}</i></div>`).join('');
}
/* ═══ FRONT-END: splash · login · save slots ═══ */
const ROMAN=['I','II','III','IV','V'];
export function initMenus(){
  /* splash — a tap anywhere carries on (returning players skip login) */
  $('scr-splash').onclick=()=>{ if(loadSession())gotoSlots(); else show('scr-login'); };
  $('login-email-btn').onclick=()=>{
    const em=($('login-email').value||'').trim();
    saveSession({mode:'email',email:em||'seeker@thedeep.io'});
    toast(em?('BOUND TO '+em.toUpperCase()):'WELCOME, SEEKER');
    gotoSlots();
  };
  $('login-guest').onclick=()=>{ saveSession({mode:'guest'}); gotoSlots(); };
  $('slots-logout').onclick=()=>{ clearSession(); show('scr-login'); };
}
function gotoSlots(){ paintSlots(); show('scr-slots'); }
function paintSlots(){
  const host=$('slot-list'); host.innerHTML='';
  for(let i=0;i<SLOT_COUNT;i++){
    const sum=slotSummary(i);
    const card=el('div','slot '+(sum?'filled':'empty'));
    card.appendChild(el('div','sno','SLOT '+(ROMAN[i]||i+1)));
    if(sum){
      const party=el('div','sparty');
      for(const m of sum.members){const cnv=el('canvas');party.appendChild(cnv);portrait(m,cnv,1);}
      card.appendChild(party);
      const need=BAL.xpCurve(sum.xpLv);
      const info=el('div','sinfo');
      info.innerHTML='<div class="sname">'+sum.sagaName+'</div>'
        +'<div class="smeta"><span>LV <b>'+sum.lv+'</b></span>'
        +'<span>DEPTH <b>'+(sum.depth?('B'+sum.depth):'—')+'</b></span>'
        +'<span>'+sum.party+' IN PARTY</span></div>'
        +'<div class="sbar"><i style="width:'+Math.min(100,sum.xp/need*100)+'%"></i></div>';
      card.appendChild(info);
      card.appendChild(el('div','schev','▸'));
      const w=el('button','swipe','✕ ERASE');
      w.onclick=e=>{e.stopPropagation();
        if(confirm('Erase "'+sum.sagaName+'"? This saga is lost forever.')){wipeSlot(i);paintSlots();}};
      card.appendChild(w);
    } else {
      card.appendChild(el('div','plus','<span>✦</span>BEGIN A NEW SAGA'));
    }
    card.onclick=()=>pickSlot(i);
    host.appendChild(card);
  }
}
function pickSlot(i){
  setSlot(i);
  resetState();
  if(slotSummary(i)){                 // existing saga → load and drop into town
    restore(); buildTown(); show('scr-town');
    toast('THE EMBER REKINDLES — '+(S.sagaName||'').toUpperCase());
  } else {                            // empty slot → forge a new hero for this saga
    S.tavern=[]; initCreate(); show('scr-create');
  }
}
/* ═══ TOWN / HOME (Emberrest) ═══ */
export function buildTown(){
  $('tw-silver').textContent='◈ '+S.silver;
  $('tw-best').textContent=S.bestDepth?('DEEPEST B'+S.bestDepth):'DEEPEST —';
  const room=BAL.teamCap-S.team.length;
  $('tw-tav-tag').textContent=room>0?(room+' OPEN'):'';
  $('tw-delve-sub').textContent=(S.bestDepth?('DEEPEST FLOOR '+S.bestDepth):'THE STAIR AWAITS')+' · A BOSS EVERY 3RD';
  const strip=$('tw-team');strip.innerHTML='';
  for(const m of [S.player,...S.team]){
    if(!m)continue;
    const d=el('div','tmate');
    const cnv=el('canvas');d.appendChild(cnv);
    d.appendChild(el('div','cn','<b>'+m.name+'</b>'+ARCHETYPES[m.arch].n+' · L'+m.lv));
    portrait(m,cnv,1);cnv.style.width='100%';cnv.style.height='auto';
    d.onclick=()=>openCharSheet(m);
    strip.appendChild(d);
  }
}
$('tw-tavern').onclick=()=>openTavern();
$('tw-char').onclick=()=>openCharSheet(S.player);
$('tw-inv').onclick=()=>openInv(null);
$('tw-forge').onclick=()=>openForge();
$('tw-shop').onclick=()=>toast('THE SHOP OPENS SOON — MERCHANTS STILL FEAR THE DARK');
$('tw-bank').onclick=()=>toast('THE BANK OPENS SOON — NO VAULT YET HOLDS YOUR HAUL');
$('tw-delve').onclick=()=>{beginDelve(1);};
$('tw-wipe').onclick=()=>{
  if(!confirm('Abandon this saga entirely? The slot will be emptied.'))return;
  wipeSave();resetState();paintSlots();show('scr-slots');
  toast('THE SAGA IS ASH — CHOOSE ANOTHER EMBER');
};
function beginDelve(depth){
  [S.player,...S.team].forEach(c=>{refresh(c);c.hp=c.maxhp;});
  startDelve(depth);setZoom(1);
  buildHud();show('scr-delve');
  requestAnimationFrame(()=>fitCanvas());   // size the canvas once the screen is laid out
}
/* ═══ TAVERN ═══ */
export function fillTavern(){
  while(S.tavern.length<3){
    const arch=pick(sysRng,ARCH_KEYS);
    const lv=Math.max(1,Math.min(S.player.lv+RI(sysRng,-1,1),S.player.lv+1));
    const c=makeCharacter(arch,randRecipe(sysRng,arch),rollPal(sysRng),false);
    c.lv=lv;c.pts=lv*BAL.statPointsPerLevel;
    S.tavern.push(c);
  }
}
function openTavern(){
  fillTavern();
  const host=$('tav-list');host.innerHTML='';
  for(const c of S.tavern){
    const cost=BAL.hireCostPerLevel*c.lv;
    const d=el('div','cand');
    const cnv=el('canvas');d.appendChild(cnv);portrait(c,cnv,2);
    d.appendChild(el('div','ci',
      `<b>${c.name}</b><i>${ARCHETYPES[c.arch].n} · LV ${c.lv}</i><i>${cost} SILVER</i>`));
    const ops=el('div','cops');
    const hire=el('button',null,'HIRE');
    hire.disabled=S.team.length>=BAL.teamCap||S.silver<cost;
    hire.onclick=()=>{
      S.silver-=cost;S.team.push(c);
      S.tavern=S.tavern.filter(x=>x!==c);fillTavern();
      persist();buildTown();openTavern();
      toast(c.name.toUpperCase()+' JOINS THE DELVE');
    };
    const dis=el('button','ghost','DISMISS');
    dis.onclick=()=>{S.tavern=S.tavern.filter(x=>x!==c);fillTavern();persist();openTavern();};
    ops.appendChild(hire);ops.appendChild(dis);d.appendChild(ops);
    host.appendChild(d);
  }
  $('tav-cap').textContent='PARTY '+S.team.length+' / '+BAL.teamCap+
    (S.team.length?' · TAP A COMPANION IN TOWN TO MANAGE OR RELEASE':'');
  openSheet('sh-tavern');
}
/* ═══ CHARACTER SHEET ═══ */
let sheetChar=null, sheetTab='stats', pend=null;
const STAT_KEYS=['patt','matt','pdef','mdef','dodge','crit'];
const STAT_LABEL={patt:'pATT',matt:'mATT',pdef:'pDEF',mdef:'mDEF',dodge:'DODGE',crit:'CRIT'};
const statStep=k=>(k==='dodge'||k==='crit')?1:2;
const pendSum=()=>STAT_KEYS.reduce((a,k)=>a+(pend[k]||0),0);
const SLOTS=['weapon','offhand','armor','boots'];
const SLOT_ICON={weapon:'🗡️',offhand:'🛡️',armor:'🥋',boots:'🥾'};
const PROC_GEM={burn:'burn',poison:'dodge',slow:'slow',leech:'ward'};
function itemRarity(it){const n=(it.pre>=0?1:0)+(it.suf>=0?1:0);return (it.plus>=1||n>=2)?'rare':(n>=1?'magic':'');}
/* a weapon whose swing/bow/raise kind isn't in the class's bias fights the wrong way */
function offClassWeapon(it,c){
  if(it.slot!=='weapon'||!it.kind||!c)return false;
  const bias=ARCHETYPES[c.arch]?.weaponBias||[];
  return bias.length>0 && !bias.includes(it.kind);
}
/* class-aware "is this an upgrade FOR ME" score — powers the slot dot */
const DEFAULT_W={patt:1,matt:1,pdef:1,mdef:1,dodge:1,crit:1,hp:.2};
function itemScore(it,c){
  const w=(c&&STAT_WEIGHTS[c.arch])||DEFAULT_W, s=scaledStats(it);
  let v=0;for(const k in s)v+=s[k]*(w[k]!==undefined?w[k]:1);
  v+=((it.procs&&it.procs.length)||0)*3;
  if(offClassWeapon(it,c))v*=0.35;
  return v;
}
function bestInvFor(slot,c){let best=null,bs=-1;for(const it of S.inv){if(it.slot!==slot)continue;const sc=itemScore(it,c);if(sc>bs){bs=sc;best=it;}}return best?{it:best,score:bs}:null;}
function slotUpgrade(c,slot){const b=bestInvFor(slot,c);if(!b)return false;const cur=c.equip[slot];return b.score>(cur?itemScore(cur,c):0)+0.5;}
/* stat change if `candidate` replaces what's in `slot` — returns colored chips */
const DELTA_LABEL={patt:'pATT',matt:'mATT',pdef:'pDEF',mdef:'mDEF',dodge:'DODGE',crit:'CRIT',hp:'HP'};
function deltaHtml(candidate,slot,c){
  const cand=scaledStats(candidate), cur=c.equip[slot]?scaledStats(c.equip[slot]):{};
  const parts=[];
  for(const k of ['patt','matt','pdef','mdef','dodge','crit','hp']){
    const d=Math.round((cand[k]||0)-(cur[k]||0)); if(!d)continue;
    const pct=(k==='dodge'||k==='crit')?'%':'';
    parts.push('<span class="'+(d>0?'up':'dn')+'">'+DELTA_LABEL[k]+' '+(d>0?'▲+':'▼')+d+pct+'</span>');
  }
  const cp=candidate.procs||[], ep=c.equip[slot]?(c.equip[slot].procs||[]):[];
  for(const p of cp)if(!ep.includes(p))parts.push('<span class="pc">+'+p.toUpperCase()+'</span>');
  for(const p of ep)if(!cp.includes(p))parts.push('<span class="dn">−'+p.toUpperCase()+'</span>');
  if(!parts.length)parts.push('<span class="flat">NO STAT CHANGE</span>');
  return '<div class="delta">'+parts.join('')+'</div>';
}
function openCharSheet(c){
  sheetChar=c; sheetTab='stats'; pend={patt:0,matt:0,pdef:0,mdef:0,dodge:0,crit:0};
  paintCharSheet(); openSheet('sh-char');
}
/* swipe / arrows to flip through the party on the character sheet */
function sheetParty(){ return [S.player,...S.team].filter(Boolean); }
function navChar(dir){
  const party=sheetParty(); if(party.length<2)return;
  let i=party.indexOf(sheetChar); if(i<0)i=0;
  const keep=sheetTab;
  openCharSheet(party[(i+dir+party.length)%party.length]);
  sheetTab=keep; paintCharSheet();
}
function paintDollSlots(c){
  for(const slot of SLOTS){
    const cell=document.querySelector('#sh-char .slot-'+slot); if(!cell)continue;
    const it=c.equip[slot];
    const slotDiv=el('div','slot'+(it?(' '+itemRarity(it)):' empty'));
    if(it){
      slotDiv.appendChild(el('span','tier','T'+it.tier));
      if(it.plus)slotDiv.appendChild(el('span','plus','+'+it.plus));
      slotDiv.appendChild(itemIconEl(it,48));                 // real item sprite
      if(it.procs&&it.procs[0])slotDiv.appendChild(el('span','gem '+(PROC_GEM[it.procs[0]]||'ward')));
    } else slotDiv.appendChild(el('span','ic',SLOT_ICON[slot]));
    if(slotUpgrade(c,slot)){const u=el('span','upg','▲');u.title='Better gear in your pack';slotDiv.appendChild(u);}
    cell.innerHTML='';cell.appendChild(slotDiv);
    cell.appendChild(el('div','slotlabel',slot.toUpperCase()+'<b>'+(it?itemName(it).replace(/\s*\(\+\d+\)$/,''):'—')+'</b>'));
    slotDiv.onclick=()=>openInv(slot);
  }
}
function paintStatRows(c){
  const host=$('ch-stats');host.innerHTML='';
  const avail=c.pts-pendSum();
  for(const k of STAT_KEYS){
    const step=statStep(k), p=pend[k]||0, gain=p*step, pct=(k==='dodge'||k==='crit')?'%':'';
    const base=Math.round(c.stats[k]);
    const r=el('div','astat');
    r.innerHTML='<span class="sl">'+STAT_LABEL[k]+'</span>'
      +'<span class="sv">'+(base+gain)+pct+(p?' <span class="pend">(+'+gain+pct+')</span>':'')+'</span>'
      +'<span class="per">＋'+step+pct+' / PT</span>'
      +'<span class="stepper"><button class="minusb">−</button><button class="plusb">＋</button></span>';
    const mb=r.querySelector('.minusb'), pb=r.querySelector('.plusb');
    mb.disabled=p<=0; pb.disabled=avail<=0;
    mb.onclick=()=>{if((pend[k]||0)>0){pend[k]--;paintCharSheet();}};
    pb.onclick=()=>{if(c.pts-pendSum()>0){pend[k]=(pend[k]||0)+1;paintCharSheet();}};
    host.appendChild(r);
  }
  $('ch-pts').textContent=avail;
  $('ch-confirm').disabled=pendSum()===0;
}
/* keep the loadout valid: default to learned skills, then honour the player's picks */
function ensureLoadout(c){
  const learned=[0,1,2].filter(i=>(c.skillRanks[i]||0)>0);
  if(!Array.isArray(c.loadout))c.loadout=learned.slice(0,3);
  else c.loadout=c.loadout.filter(i=>learned.includes(i));
}
function swapLoad(c,a,b){const l=c.loadout,t=l[a];l[a]=l[b];l[b]=t;persist();paintCharSheet();}
function paintLoadout(c){
  ensureLoadout(c);
  const host=$('ch-loadout');host.innerHTML='';
  const lo=c.loadout, learned=[0,1,2].filter(i=>(c.skillRanks[i]||0)>0);
  if(!lo.length)host.appendChild(el('div','hint',
    'NO SKILLS QUEUED — ADD ONE BELOW'));
  lo.forEach((si,pos)=>{
    const s=ARCHETYPES[c.arch].skills[si];
    const row=el('div','lorow');
    row.innerHTML='<span class="ord">'+(pos+1)+'</span><span class="g">'+s.g+'</span>'
      +'<span class="nm">'+s.n+' <i>R'+c.skillRanks[si]+'</i></span>';
    const ctl=el('div','loctl');
    const up=el('button',null,'▲');up.disabled=pos===0;up.onclick=()=>swapLoad(c,pos,pos-1);
    const dn=el('button',null,'▼');dn.disabled=pos===lo.length-1;dn.onclick=()=>swapLoad(c,pos,pos+1);
    const rm=el('button','ghost','✕');rm.onclick=()=>{c.loadout.splice(pos,1);persist();paintCharSheet();};
    ctl.appendChild(up);ctl.appendChild(dn);ctl.appendChild(rm);row.appendChild(ctl);
    host.appendChild(row);
  });
  const addable=learned.filter(i=>!lo.includes(i));
  if(addable.length&&lo.length<3){
    const add=el('div','loadd');add.appendChild(el('span','lbl','ADD:'));
    for(const i of addable){
      const s=ARCHETYPES[c.arch].skills[i];
      const chip=el('button','addchip',s.g+' '+s.n+' ＋');
      chip.onclick=()=>{c.loadout.push(i);persist();paintCharSheet();};
      add.appendChild(chip);
    }
    host.appendChild(add);
  }
}
function paintSkillRows(c){
  const host=$('ch-skills');host.innerHTML='';
  const avail=skillAvail(c);
  $('ch-sp').textContent=avail;
  $('ch-sp-lab').textContent='SKILL POINTS';
  ARCHETYPES[c.arch].skills.forEach((s,i)=>{
    const rank=c.skillRanks[i]||0, learn=rank===0;
    const r=el('div','skl');
    let pips='';for(let n=0;n<SKILL_MAX;n++)pips+='<i class="'+(n<rank?'on':'')+'"></i>';
    const can=avail>0&&rank<SKILL_MAX;
    const lbl=rank>=SKILL_MAX?'MAXED':(learn?'LEARN · 1 SP':'RANK UP · 1 SP');
    const act='<div class="skact"><button class="'+(learn?'learn':'')+'" '+(can?'':'disabled')+'>'+lbl+'</button></div>';
    r.innerHTML='<span class="g">'+s.g+'</span><div class="skmid"><div class="nm">'+s.n
      +(rank?' <span class="rk">R'+rank+'</span>':'')+'</div><div class="ds">'+s.d+'</div>'
      +'<div class="pips">'+pips+'</div></div>'+act;
    const b=r.querySelector('button');
    if(b&&!b.disabled)b.onclick=()=>{c.skillRanks[i]=(c.skillRanks[i]||0)+1;
      if(learn&&Array.isArray(c.loadout)&&c.loadout.length<3&&!c.loadout.includes(i))c.loadout.push(i);
      persist();paintCharSheet();emit('hud');
      toast((learn?'LEARNED ':'RANKED UP ')+s.n.toUpperCase());};
    host.appendChild(r);
  });
}
function paintCharSheet(){
  const c=sheetChar; if(!c)return;
  refresh(c);
  portrait(c,$('ch-face'),2);
  $('ch-name').textContent=c.name+(c.isPlayer?' (YOU)':'');
  $('ch-sub').textContent=ARCHETYPES[c.arch].n+' · LV '+c.lv+' · '+Math.round(c.hp)+'/'+c.maxhp+' HP';
  const xpNeed=BAL.xpCurve(c.lv);
  $('ch-xp').style.width=Math.min(100,c.xp/xpNeed*100)+'%';
  $('ch-xpt').textContent='XP '+Math.round(c.xp)+' / '+xpNeed;
  $('ch-best').textContent=S.bestDepth?('DEEPEST FLOOR '+S.bestDepth):'';
  paintDollSlots(c);
  $('ch-pane-stats').classList.toggle('hide',sheetTab!=='stats');
  $('ch-pane-skills').classList.toggle('hide',sheetTab!=='skills');
  document.querySelectorAll('#sh-char .tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===sheetTab));
  paintStatRows(c); paintLoadout(c); paintSkillRows(c);
  const availStat=c.pts-pendSum(), availSk=skillAvail(c);
  const pb=$('ch-tab-pts'); pb.textContent=availStat; pb.classList.toggle('on',availStat>0);
  const sb=$('ch-tab-sp'); sb.textContent=availSk; sb.classList.toggle('on',availSk>0);
  $('ch-release').style.display=c.isPlayer?'none':'block';
  const multi=sheetParty().length>1 && sheetParty().includes(c);
  $('ch-prev').style.display=multi?'':'none';
  $('ch-next').style.display=multi?'':'none';
}
/* one-time bindings */
document.querySelectorAll('#sh-char .tab').forEach(t=>t.onclick=()=>{sheetTab=t.dataset.tab;paintCharSheet();});
$('ch-prev').onclick=()=>navChar(-1);
$('ch-next').onclick=()=>navChar(1);
(function(){                                        // horizontal swipe flips characters
  const sheet=$('sh-char'); let sx=0,sy=0,down=false;
  sheet.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;down=true;});
  sheet.addEventListener('pointerup',e=>{
    if(!down)return;down=false;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.4) navChar(dx<0?1:-1);
  });
  sheet.addEventListener('pointercancel',()=>{down=false;});
})();
$('ch-reset').onclick=()=>{STAT_KEYS.forEach(k=>pend[k]=0);paintCharSheet();};
$('ch-confirm').onclick=()=>{
  const c=sheetChar; if(!c)return; const n=pendSum(); if(!n)return;
  for(const k of STAT_KEYS){c.assigned[k]=(c.assigned[k]||0)+pend[k]*statStep(k);pend[k]=0;}
  c.pts-=n; refresh(c); persist(); paintCharSheet(); emit('hud');
  toast(n+' POINT'+(n>1?'S':'')+' ASSIGNED');
};
$('ch-release').onclick=()=>{
  if(!sheetChar||!confirm('Release '+sheetChar.name+'? They leave forever.'))return;
  for(const slot of SLOTS)
    if(sheetChar.equip[slot]){S.inv.push(sheetChar.equip[slot]);sheetChar.equip[slot]=null;}
  S.team=S.team.filter(m=>m!==sheetChar);
  persist();closeSheets();buildTown();
  toast(sheetChar.name.toUpperCase()+' MOVES ON');
};
/* ═══ INVENTORY ═══ */
let invFilter=null, mergeSel=null;
function openInv(slotFilter){
  invFilter=slotFilter;mergeSel=null;paintInv();openSheet('sh-inv');
}
/* true if any character already has this exact item equipped (shared inventory guard) */
function equippedElsewhere(it){
  for(const c of [S.player,...S.team]) if(c)
    for(const s of SLOTS) if(c.equip&&c.equip[s]===it) return true;
  return false;
}
function statLine(it){
  const st=scaledStats(it);
  return Object.entries(st).map(([k,v])=>k.toUpperCase()+'+'+v).join(' ')+
    (it.procs.length?' · '+it.procs.map(p=>p.toUpperCase()).join('/'):'');
}
function paintInv(){
  $('inv-title').textContent=invFilter?('EQUIP: '+invFilter.toUpperCase()):
    (mergeSel?'MERGE — PICK A MATCHING ITEM':'INVENTORY');
  /* keep the character we're equipping for named at the top */
  const whoLine=$('inv-who');
  if(invFilter&&sheetChar){whoLine.textContent='FOR '+sheetChar.name.toUpperCase()+' · '+ARCHETYPES[sheetChar.arch].n.toUpperCase();whoLine.style.display='';}
  else whoLine.style.display='none';
  const host=$('inv-list');host.innerHTML='';
  /* when swapping a slot, offer to unequip the current piece */
  if(invFilter){
    const c=sheetChar||S.player, cur=c.equip[invFilter];
    if(cur){
      const d=el('div','item');
      d.appendChild(itemIconEl(cur,30));
      d.appendChild(el('div','in','<b>EQUIPPED · '+itemName(cur)+'</b><i>T'+cur.tier+' '+invFilter.toUpperCase()+' · '+statLine(cur)+'</i>'));
      const ops=el('div','iops');
      const un=el('button','ghost','UNEQUIP');
      un.onclick=()=>{S.inv.push(c.equip[invFilter]);c.equip[invFilter]=null;refresh(c);persist();
        closeSheets();openCharSheet(c);emit('hud');toast('UNEQUIPPED');};
      ops.appendChild(un);d.appendChild(ops);host.appendChild(d);
    }
  }
  let items=S.inv.filter(i=>!equippedElsewhere(i));   // never offer gear worn by another hero
  if(invFilter)items=items.filter(i=>i.slot===invFilter);
  if(mergeSel)items=items.filter(i=>i!==mergeSel&&sameFamily(i,mergeSel));
  if(!items.length)host.appendChild(el('div','hint',
    mergeSel?'NO MATCHING ITEM — NEED SAME BASE, AFFIXES AND +LEVEL':'NOTHING HERE YET — DELVE FOR LOOT'));
  const who=sheetChar||S.player;
  for(const it of items){
    const d=el('div','item');
    let sub='T'+it.tier+' '+it.slot.toUpperCase()+' · '+statLine(it);
    if(offClassWeapon(it,who))sub+=' · <span class="offc">OFF-CLASS</span>';
    let inHtml='<b>'+itemName(it)+'</b><i>'+sub+'</i>';
    if(invFilter)inHtml+=deltaHtml(it,invFilter,who);   // stat change vs equipped
    d.appendChild(itemIconEl(it,30));                   // real item sprite next to the name
    d.appendChild(el('div','in',inHtml));
    const ops=el('div','iops');
    if(mergeSel){
      const risk=Math.round(BAL.mergeDestroyChance(mergeSel.plus+1)*100);
      const b=el('button',null,'FUSE'+(risk?' ⚠'+risk+'%':''));
      b.onclick=()=>{
        const r=tryMerge(sysRng,mergeSel,it);
        S.inv=S.inv.filter(x=>x!==mergeSel&&x!==it);
        if(r.ok){S.inv.push(r.item);toast('FORGED: '+itemName(r.item).toUpperCase());}
        else toast('THE FORGE CONSUMED BOTH ITEMS');
        mergeSel=null;persist();paintInv();emit('hud');
      };
      ops.appendChild(b);
    } else if(invFilter){
      const b=el('button',null,'EQUIP');
      b.onclick=()=>{
        const c=sheetChar||S.player;
        if(c.equip[invFilter])S.inv.push(c.equip[invFilter]);
        c.equip[invFilter]=it;S.inv=S.inv.filter(x=>x!==it);
        refresh(c);persist();closeSheets();
        openCharSheet(c);emit('hud');   // reopen sheet in town & delve (delve stays paused)
        toast('EQUIPPED: '+itemName(it).toUpperCase());
      };
      ops.appendChild(b);
    } else {
      const m=el('button',null,'MERGE');
      const anyMatch=S.inv.some(x=>x!==it&&sameFamily(x,it));
      m.disabled=!anyMatch;
      m.onclick=()=>{mergeSel=it;paintInv();};
      const dr=el('button','ghost','DROP');
      dr.onclick=()=>{S.inv=S.inv.filter(x=>x!==it);persist();paintInv();};
      ops.appendChild(m);ops.appendChild(dr);
    }
    d.appendChild(ops);
    host.appendChild(d);
  }
  $('inv-back').style.display=(invFilter||mergeSel)?'inline-block':'none';
  $('inv-back').onclick=()=>{invFilter=null;mergeSel=null;paintInv();};
}
/* ═══ FORGE ═══ */
let fTarget=null, fMats=[null,null], fBusy=false;
const forgeChance=t=>t?Math.max(25,95-(t.plus||0)*15):0;         // safer curve, floors at 25%
const baseCount=bi=>S.inv.reduce((n,i)=>n+(i.base===bi?1:0),0);
function openForge(){fTarget=null;fMats=[null,null];fBusy=false;$('f-result').className='fresult';paintForge();openSheet('sh-forge');}
function fillForgeSlot(slotEl,nmEl,it,ph){
  slotEl.className=slotEl.className.replace(/\s*(filled|magic|rare)/g,'');
  slotEl.innerHTML='';
  if(it){
    slotEl.classList.add('filled');const r=itemRarity(it);if(r)slotEl.classList.add(r);
    slotEl.appendChild(el('span','tier','T'+it.tier));
    if(it.plus)slotEl.appendChild(el('span','plus','+'+it.plus));
    slotEl.appendChild(itemIconEl(it,slotEl.classList.contains('target')?54:42));
    nmEl.textContent=itemName(it);
  } else {slotEl.appendChild(el('span','fph',ph));nmEl.textContent='';}
}
function paintForge(){
  fillForgeSlot($('f-target'),$('fnm-target'),fTarget,'TAP AN ITEM<br>TO UPGRADE');
  fillForgeSlot($('f-m0'),$('fnm-m0'),fMats[0],'MATERIAL');
  fillForgeSlot($('f-m1'),$('fnm-m1'),fMats[1],'MATERIAL');
  $('f-target').onclick=()=>{if(!fBusy&&fTarget){fTarget=null;fMats=[null,null];paintForge();}};
  [0,1].forEach(i=>{$('f-m'+i).onclick=()=>{if(!fBusy&&fMats[i]){fMats[i]=null;paintForge();}};});
  const c=forgeChance(fTarget), col=c>=80?'#5FBE6A':c>=55?'#E8A03C':'#C4552B';
  $('f-chance').textContent=fTarget?c+'%':'—';$('f-chance').style.color=fTarget?col:'';
  const bar=$('f-bar');bar.style.width=(fTarget?c:0)+'%';bar.style.background=col;
  $('f-prev').innerHTML=fTarget?('<b>'+itemName(fTarget).replace(/\s*\(\+\d+\)$/,'')+'</b> (+'+(fTarget.plus||0)+') <span class="up">→ (+'+((fTarget.plus||0)+1)+')</span>'):'SEAT A TARGET TO SEE THE UPGRADE';
  $('f-forge').disabled=fBusy||!(fTarget&&fMats[0]&&fMats[1]);
  const host=$('f-inv');host.innerHTML='';
  const used=it=>it===fTarget||fMats.includes(it);
  let list;
  if(fTarget){list=S.inv.filter(i=>i.base===fTarget.base&&!used(i));$('f-filter').textContent='SHOWING · '+GEAR_BASES[fTarget.base].n.toUpperCase()+' MATERIALS';}
  else{list=S.inv.filter(i=>baseCount(i.base)>=3);$('f-filter').textContent='TAP AN UPGRADEABLE ITEM';}
  if(!list.length)host.appendChild(el('div','hint',fTarget?'NO MORE MATCHING MATERIALS IN YOUR PACK':'NEED 3+ OF THE SAME ITEM TO FORGE — DELVE FOR MORE'));
  for(const it of list){
    const d=el('div','item');
    d.appendChild(itemIconEl(it,30));
    d.appendChild(el('div','in','<b>'+itemName(it)+'</b><i>T'+it.tier+' '+it.slot.toUpperCase()+' · '+statLine(it)+'</i>'));
    d.onclick=()=>forgePick(it);
    host.appendChild(d);
  }
}
function forgePick(it){
  if(fBusy)return;
  if(!fTarget)fTarget=it;
  else if(it.base===fTarget.base&&it!==fTarget&&!fMats.includes(it)){const i=fMats.indexOf(null);if(i>=0)fMats[i]=it;}
  paintForge();
}
function doForge(){
  if(fBusy||!(fTarget&&fMats[0]&&fMats[1]))return;
  fBusy=true;$('f-forge').disabled=true;$('f-result').className='fresult';
  const bench=$('fbench');bench.classList.add('forging');
  const em=$('f-embers');em.innerHTML='';
  for(let i=0;i<20;i++){const s=el('span','ember');s.style.left=(38+sysRng()*24)+'%';
    s.style.setProperty('--dx',(sysRng()*40-20)+'px');s.style.background=sysRng()<.5?'#E8A03C':'#FFE6A0';
    s.style.animation='emberfly '+(700+sysRng()*450)+'ms ease-out '+(sysRng()*160)+'ms forwards';em.appendChild(s);}
  $('f-flash').style.animation='flashpop 620ms ease-out 240ms';
  setTimeout(()=>{
    bench.classList.remove('forging');$('f-flash').style.animation='';
    const win=sysRng()*100<forgeChance(fTarget);
    S.inv=S.inv.filter(x=>x!==fMats[0]&&x!==fMats[1]);   // materials are always consumed
    const res=$('f-result');
    if(win){
      fTarget.plus=(fTarget.plus||0)+1;
      res.className='fresult show win';
      $('f-verdict').textContent='Forged!';
      $('f-ritem').innerHTML='<b>'+itemName(fTarget)+'</b>';
      $('f-rsub').textContent='THE ANVIL SINGS · MATERIALS CONSUMED';
      toast('FORGED: '+itemName(fTarget).toUpperCase());
    } else {
      res.className='fresult show lose';
      $('f-verdict').textContent='The temper cracked';
      $('f-ritem').innerHTML='<b>'+itemName(fTarget)+'</b> — UNCHANGED';
      $('f-rsub').textContent='BOTH MATERIALS LOST TO THE FLAME';
      toast('THE FORGE CLAIMED YOUR MATERIALS');
    }
    fMats=[null,null];fBusy=false;persist();paintForge();
    clearTimeout(res._h);res._h=setTimeout(()=>{res.className='fresult';},3000);
  },1120);
}
$('f-forge').onclick=()=>doForge();
/* ═══ DELVE HUD ═══ */
const ROLE={fighter:'FTR',rogue:'ROG',mage:'MAG',cleric:'CLR',healer:'HLR'};
const stCell=(k,v,cls)=>'<div class="st"><span class="k">'+k+'</span><span class="v'+(cls?' '+cls:'')+'">'+v+'</span></div>';
export function buildHud(){
  $('hud-depth').textContent='FLOOR '+S.depth;
  $('hud-silver').textContent=S.silver+'s';
  const pf=$('hud-party');pf.innerHTML='';
  for(const u of D.units.filter(u=>u.side==='party')){
    const c=u.char;
    const col=el('div','cardcol');col.dataset.id=c.id;
    /* skill chips above the card — the firing-order loadout, padded to 3 so the
       bar always spans the same width as the card below it */
    const skbar=el('div','skbar');
    const learned=[0,1,2].filter(i=>(c.skillRanks&&c.skillRanks[i]||0)>0);
    const lo=(Array.isArray(c.loadout)?c.loadout.filter(i=>learned.includes(i)):learned).slice(0,3);
    for(let pos=0;pos<3;pos++){
      const si=lo[pos];
      const box=el('div','skbox');
      if(si!=null){
        const sk=ARCHETYPES[c.arch].skills[si];
        box.dataset.si=si;box.dataset.cd=sk.cd;box.style.setProperty('--sc',skillColor(sk));
        box.appendChild(el('span','g',sk.g));
        box.appendChild(el('span','cd'));
        box.appendChild(el('span','rd'));
      } else box.classList.add('empty');
      skbar.appendChild(box);
    }
    col.appendChild(skbar);
    const d=el('div','pf'+(c.isPlayer?' lead':''));d.dataset.id=c.id;
    const head=el('div','pfhead');
    const pcol=el('div','pcol');
    const port=el('div','port');
    const cnv=el('canvas');port.appendChild(cnv);
    port.appendChild(el('span','lv','L'+c.lv));
    pcol.appendChild(port);
    pcol.appendChild(el('div','role',ROLE[c.arch]||'—'));   // class under the picture
    head.appendChild(pcol);
    head.appendChild(el('div','pname',c.name.toUpperCase()));
    d.appendChild(head);
    if(c.isPlayer)d.appendChild(el('span','flag','⚑'));
    const hp=el('div','hpwrap');hp.appendChild(el('div','hpfill'));hp.appendChild(el('div','hpnum'));
    d.appendChild(hp);                                       // hp + stats + xp span the full card
    d.appendChild(el('div','grid'));
    const xp=el('div','xprow');
    xp.appendChild(el('span','xplv',''));
    const xb=el('div','xpbar2');xb.appendChild(el('div','xpfill'));
    xp.appendChild(xb);
    d.appendChild(xp);
    d.onclick=()=>{D.paused=true;openCharSheet(c);};
    col.appendChild(d);
    pf.appendChild(col);
    portrait(c,cnv,1);cnv.style.width='100%';cnv.style.height='auto';
  }
  $('hud-mode').textContent=S.mode==='auto'?'⚔ AUTO':'✋ MANUAL';
  syncHud();
}
export function syncHud(){
  $('hud-silver').textContent=S.silver+'s';
  $('hud-depth').textContent='FLOOR '+S.depth;
  for(const d of $('hud-party').children){
    const u=D.units.find(u=>u.char&&u.char.id===d.dataset.id);
    if(!u)continue;
    const st=u.char.stats||{}, mh=st.hp||u.maxhp||1, f=Math.max(0,u.hp/mh);
    const fill=d.querySelector('.hpfill');
    if(fill){fill.style.width=(f*100)+'%';
      fill.style.background=f>.5?'#5FBE6A':f>.25?'#E8A03C':'#C4552B';}
    const num=d.querySelector('.hpnum');
    if(num)num.textContent=Math.max(0,Math.round(u.hp))+'/'+Math.round(mh);
    d.classList.toggle('dead',!u.alive);
    /* level + xp (kept live through level-ups) */
    const lvb=d.querySelector('.port .lv'); if(lvb)lvb.textContent='L'+u.char.lv;
    const xlv=d.querySelector('.xplv'); if(xlv)xlv.textContent='LV '+u.char.lv;
    const xf=d.querySelector('.xpfill');
    if(xf){const need=BAL.xpCurve(u.char.lv);xf.style.width=Math.min(100,Math.max(0,u.char.xp/need*100))+'%';}
    const grid=d.querySelector('.grid');
    if(grid){
      const phys=(st.patt||0)>=(st.matt||0);
      const atk=Math.round(Math.max(st.patt||0,st.matt||0));
      grid.innerHTML=stCell('ATK',atk,phys?'phy':'mag')
        +stCell('DEF',Math.round(st.pdef||0)+'·'+Math.round(st.mdef||0))
        +stCell('CRT',Math.round(st.crit||0)+'%')
        +stCell('DDG',Math.round(st.dodge||0)+'%');
    }
    /* skill chip cooldown sweeps + ready glow */
    for(const box of d.querySelectorAll('.skbox[data-si]')){
      const si=+box.dataset.si, cd=+box.dataset.cd;
      const rem=(u.skillCds&&u.skillCds[si])||0;
      const p=cd>0?Math.max(0,Math.min(1,rem/cd)):0;      // fraction of cooldown left
      const cdEl=box.querySelector('.cd'); if(cdEl)cdEl.style.setProperty('--a',(p*360)+'deg');
      box.classList.toggle('ready', u.alive && rem<1);
    }
  }
}
/* flash a hero's chip the instant that skill fires */
on('skillcast',d=>{
  const col=[...$('hud-party').children].find(c=>c.dataset.id===d.id); if(!col)return;
  const box=col.querySelector('.skbox[data-si="'+d.si+'"]'); if(!box)return;
  box.classList.remove('fire');void box.offsetWidth;box.classList.add('fire');
});
on('hud',syncHud);
on('delve-start',()=>{buildHud();});
$('hud-mode').onclick=()=>{
  S.mode=S.mode==='auto'?'manual':'auto';
  $('hud-mode').textContent=S.mode==='auto'?'⚔ AUTO':'✋ MANUAL';
  toast(S.mode==='auto'?'AUTO — THE PARTY HUNTS':'MANUAL — TAP THE FLOOR TO MOVE');
};
$('hud-pause').onclick=()=>{D.paused=!D.paused;$('hud-pause').textContent=D.paused?'▶':'❚❚';};
$('hud-speed').onclick=()=>{D.speed=D.speed===1?2:1;$('hud-speed').textContent='×'+D.speed;};
$('hud-retreat').onclick=()=>{
  writeBack();D.running=false;persist();buildTown();show('scr-town');
  toast('BACK TO TOWN — THE HAUL IS YOURS');
};
$('hud-down').onclick=()=>{writeBack();beginFloor(S.depth+1);};
$('hud-up').onclick=()=>{if(S.depth>1){writeBack();beginFloor(S.depth-1);}else toast('THE SURFACE IS THROUGH TOWN — RETREAT');};
function beginFloor(d){
  startDelve(d);setZoom(1);buildHud();
  requestAnimationFrame(()=>fitCanvas());
  toast('FLOOR '+d+(d>S.depth-1?' — THE DARK THICKENS':''));
}
function writeBack(){
  for(const u of D.units)if(u.side==='party'&&u.char)u.char.hp=Math.max(1,Math.round(u.hp));
}
/* canvas gestures: one-finger tap = rally / open map · two-finger pinch = zoom */
function openMap(){
  D.paused=true;
  renderFullMap($('map-cv'));
  openSheet('sh-map');
}
export function initCanvasInput(canvas){
  const pts=new Map();
  let pinchStart=0, zoomStart=1, down=null, moved=false;
  canvas.addEventListener('pointerdown',e=>{
    canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2){
      const [a,b]=[...pts.values()];
      pinchStart=Math.hypot(a.x-b.x,a.y-b.y);zoomStart=getZoom();moved=true;
    } else { down={x:e.clientX,y:e.clientY};moved=false; }
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId))return;
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size>=2&&pinchStart>0){
      const [a,b]=[...pts.values()];
      setZoom(zoomStart*Math.hypot(a.x-b.x,a.y-b.y)/pinchStart);
    } else if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10){moved=true;}
  });
  const end=e=>{
    const tap=pts.size===1&&!moved&&down;
    const cx=e.clientX,cy=e.clientY;
    pts.delete(e.pointerId);
    if(pts.size<2)pinchStart=0;
    if(tap){
      if(minimapHitClient(cx,cy))openMap();
      else{const [wx,wy]=canvasPoint(e);D.rally={x:wx,y:wy};}
    }
    if(pts.size===0){down=null;moved=false;}
  };
  canvas.addEventListener('pointerup',end);
  canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();setZoom(getZoom()*(e.deltaY<0?1.12:0.9));
  },{passive:false});
}
/* ═══ DEATH ═══ */
on('player-dead',()=>{
  const lost=[];
  for(const c of [S.player,...S.team])
    for(const slot of ['weapon','offhand','armor','boots'])
      if(c.equip[slot]){lost.push(itemName(c.equip[slot]));c.equip[slot]=null;}
  lost.push(...S.inv.map(itemName));
  S.inv=[];
  const kept=Math.min(S.silver,BAL.deathSilverKeep);
  S.silver=kept;
  [S.player,...S.team].forEach(c=>{refresh(c);c.hp=c.maxhp;});
  persist();
  $('dd-lost').innerHTML=lost.length?lost.map(n=>'<div>'+n+'</div>').join(''):'<div>Nothing but pride.</div>';
  $('dd-kept').textContent=kept+' SILVER · LEVELS · SKILLS · YOUR SCARS';
  openSheet('sh-death');
});
$('dd-town').onclick=()=>{closeSheets();buildTown();show('scr-town');};
document.querySelectorAll('.osheet .x').forEach(b=>b.onclick=()=>{
  closeSheets();
  if(S.screen==='scr-delve')D.paused=false;
});
/* closing the equip list returns to the character sheet, not out to the delve/town */
$('sh-inv').querySelector('.x').onclick=()=>{
  if(invFilter&&sheetChar){$('sh-inv').classList.remove('on');openCharSheet(sheetChar);}
  else{closeSheets();if(S.screen==='scr-delve')D.paused=false;}
};
