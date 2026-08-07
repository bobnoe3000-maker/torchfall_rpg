/* Screens: create → town → delve; overlay sheets; HUD */
import {S,makeCharacter,randRecipe,refresh,partyUnits,persist,restore,grantXp} from '../game/state.js';
import {D,startDelve} from '../game/combat.js';
import {ARCHETYPES,ARCH_KEYS,STAT_WEIGHTS} from '../config/skills.js';
import {BAL} from '../config/balance.js';
import {rollPal} from '../art/parts.js';
import {getFrame} from '../art/assemble.js';
import {itemName,sameFamily,tryMerge} from '../game/loot.js';
import {scaledStats} from '../game/stats.js';
import {sysRng,RI,pick} from '../core/rng.js';
import {on,emit} from '../core/bus.js';
import {canvasPoint,bindCanvas,fitCanvas,getZoom,setZoom,minimapHitClient,renderFullMap} from '../render/iso.js';
import {wipeSave} from '../core/save.js';

const $=id=>document.getElementById(id);
const el=(tag,cls,html)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(html!=null)d.innerHTML=html;return d;};
export function toast(msg){
  const t=$('toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),1400);
}
on('toast',d=>toast(d.msg));

/* companions learn skills automatically by level (unlock at 1/3/6, +1 rank per 5 levels).
   the player instead spends skill points by hand — 1 earned per level. */
export function ranks(c){
  const un=[1,3,6];
  return [0,1,2].map(i=>c.lv>=un[i]?1+Math.floor((c.lv-un[i])/5):0);
}
function autoSkills(c){ if(c&&!c.isPlayer) c.skillRanks=ranks(c); }
export const SKILL_MAX=5;
const skillSpent=c=>(c.skillRanks||[]).reduce((a,b)=>a+(b||0),0);
const skillAvail=c=>c.isPlayer?Math.max(0,c.lv-skillSpent(c)):0;
function portrait(c,cnv,scale){
  refresh(c);
  autoSkills(c);   // companions learn automatically; the player allocates by hand
  const fr=getFrame(c.recipe,c.pal,'idle',0,1);
  cnv.width=fr.width;cnv.height=fr.height;
  const g=cnv.getContext('2d');g.imageSmoothingEnabled=false;
  g.clearRect(0,0,cnv.width,cnv.height);g.drawImage(fr,0,0);
  cnv.style.width=(fr.width*(scale||2))+'px';
  cnv.style.height=(fr.height*(scale||2))+'px';
}
export function show(id){
  for(const s of document.querySelectorAll('.screen'))s.classList.remove('on');
  $(id).classList.add('on');
  S.screen=id;
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
/* ═══ TOWN ═══ */
export function buildTown(){
  const c=S.player;
  portrait(c,$('tw-face'),2);
  $('tw-name').textContent=c.name+' · '+ARCHETYPES[c.arch].n+' · LV '+c.lv;
  $('tw-silver').textContent=S.silver+' SILVER';
  $('tw-best').textContent='DEEPEST: '+(S.bestDepth||'—');
  const strip=$('tw-team');strip.innerHTML='';
  for(const m of S.team){
    const d=el('div','tmate');
    const cnv=el('canvas');d.appendChild(cnv);
    d.appendChild(el('div','tn',m.name+'<i>'+ARCHETYPES[m.arch].n+' LV '+m.lv+'</i>'));
    portrait(m,cnv,1.5);
    d.onclick=()=>openCharSheet(m);
    strip.appendChild(d);
  }
  if(!S.team.length)strip.appendChild(el('div','hint','NO COMPANIONS — VISIT THE TAVERN'));
}
$('tw-tavern').onclick=()=>openTavern();
$('tw-char').onclick=()=>openCharSheet(S.player);
$('tw-inv').onclick=()=>openInv(null);
$('tw-delve').onclick=()=>{beginDelve(1);};
$('tw-wipe').onclick=()=>{
  if(!confirm('Erase this save entirely?'))return;
  wipeSave();location.reload();
};
function beginDelve(depth){
  [S.player,...S.team].forEach(c=>{refresh(c);c.hp=c.maxhp;autoSkills(c);});
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
    const upg=slotUpgrade(c,slot)?'<span class="upg" title="Better gear in your pack">▲</span>':'';
    if(it){
      const gem=(it.procs&&it.procs[0])?'<span class="gem '+(PROC_GEM[it.procs[0]]||'ward')+'"></span>':'';
      cell.innerHTML='<div class="slot '+itemRarity(it)+'"><span class="tier">T'+it.tier+'</span>'
        +(it.plus?'<span class="plus">+'+it.plus+'</span>':'')+'<span class="ic">'+SLOT_ICON[slot]+'</span>'+gem+upg+'</div>'
        +'<div class="slotlabel">'+slot.toUpperCase()+'<b>'+itemName(it).replace(/\s*\(\+\d+\)$/,'')+'</b></div>';
    } else {
      cell.innerHTML='<div class="slot empty"><span class="ic">'+SLOT_ICON[slot]+'</span>'+upg+'</div>'
        +'<div class="slotlabel">'+slot.toUpperCase()+'<b>—</b></div>';
    }
    cell.querySelector('.slot').onclick=()=>openInv(slot);
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
/* keep the loadout valid: companions auto-run all learned; the player keeps their picks */
function ensureLoadout(c){
  const learned=[0,1,2].filter(i=>(c.skillRanks[i]||0)>0);
  if(!c.isPlayer){c.loadout=learned.slice(0,3);return;}
  if(!Array.isArray(c.loadout))c.loadout=learned.slice(0,3);
  else c.loadout=c.loadout.filter(i=>learned.includes(i));
}
function swapLoad(c,a,b){const l=c.loadout,t=l[a];l[a]=l[b];l[b]=t;persist();paintCharSheet();}
function paintLoadout(c){
  ensureLoadout(c);
  const host=$('ch-loadout');host.innerHTML='';
  const lo=c.loadout, learned=[0,1,2].filter(i=>(c.skillRanks[i]||0)>0);
  if(!lo.length)host.appendChild(el('div','hint',
    c.isPlayer?'NO SKILLS QUEUED — ADD ONE BELOW':'NONE LEARNED YET'));
  lo.forEach((si,pos)=>{
    const s=ARCHETYPES[c.arch].skills[si];
    const row=el('div','lorow');
    row.innerHTML='<span class="ord">'+(pos+1)+'</span><span class="g">'+s.g+'</span>'
      +'<span class="nm">'+s.n+' <i>R'+c.skillRanks[si]+'</i></span>';
    if(c.isPlayer){
      const ctl=el('div','loctl');
      const up=el('button',null,'▲');up.disabled=pos===0;up.onclick=()=>swapLoad(c,pos,pos-1);
      const dn=el('button',null,'▼');dn.disabled=pos===lo.length-1;dn.onclick=()=>swapLoad(c,pos,pos+1);
      const rm=el('button','ghost','✕');rm.onclick=()=>{c.loadout.splice(pos,1);persist();paintCharSheet();};
      ctl.appendChild(up);ctl.appendChild(dn);ctl.appendChild(rm);row.appendChild(ctl);
    }
    host.appendChild(row);
  });
  if(c.isPlayer){
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
}
function paintSkillRows(c){
  const host=$('ch-skills');host.innerHTML='';
  const avail=skillAvail(c);
  $('ch-sp').textContent=c.isPlayer?avail:'AUTO';
  $('ch-sp-lab').textContent=c.isPlayer?'SKILL POINTS':'LEARNS AUTOMATICALLY BY LEVEL';
  ARCHETYPES[c.arch].skills.forEach((s,i)=>{
    const rank=c.skillRanks[i]||0, learn=rank===0;
    const r=el('div','skl'+(learn&&!c.isPlayer?' locked':''));
    let pips='';for(let n=0;n<SKILL_MAX;n++)pips+='<i class="'+(n<rank?'on':'')+'"></i>';
    let act='';
    if(c.isPlayer){
      const can=avail>0&&rank<SKILL_MAX;
      const lbl=rank>=SKILL_MAX?'MAXED':(learn?'LEARN · 1 SP':'RANK UP · 1 SP');
      act='<div class="skact"><button class="'+(learn?'learn':'')+'" '+(can?'':'disabled')+'>'+lbl+'</button></div>';
    } else act='<div class="skact"><span class="req">'+(rank?'R'+rank:'—')+'</span></div>';
    r.innerHTML='<span class="g">'+s.g+'</span><div class="skmid"><div class="nm">'+s.n
      +(rank?' <span class="rk">R'+rank+'</span>':'')+'</div><div class="ds">'+s.d+'</div>'
      +'<div class="pips">'+pips+'</div></div>'+act;
    if(c.isPlayer){const b=r.querySelector('button');
      if(b&&!b.disabled)b.onclick=()=>{c.skillRanks[i]=(c.skillRanks[i]||0)+1;
        if(learn&&Array.isArray(c.loadout)&&c.loadout.length<3&&!c.loadout.includes(i))c.loadout.push(i);
        persist();paintCharSheet();emit('hud');
        toast((learn?'LEARNED ':'RANKED UP ')+s.n.toUpperCase());};}
    host.appendChild(r);
  });
}
function paintCharSheet(){
  const c=sheetChar; if(!c)return;
  autoSkills(c); refresh(c);
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
  const host=$('inv-list');host.innerHTML='';
  /* when swapping a slot, offer to unequip the current piece */
  if(invFilter){
    const c=sheetChar||S.player, cur=c.equip[invFilter];
    if(cur){
      const d=el('div','item');
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
/* ═══ DELVE HUD ═══ */
const ROLE={fighter:'FTR',rogue:'ROG',mage:'MAG',cleric:'CLR',healer:'HLR'};
const stCell=(k,v,cls)=>'<div class="st"><span class="k">'+k+'</span><span class="v'+(cls?' '+cls:'')+'">'+v+'</span></div>';
export function buildHud(){
  $('hud-depth').textContent='FLOOR '+S.depth;
  $('hud-silver').textContent=S.silver+'s';
  const pf=$('hud-party');pf.innerHTML='';
  for(const u of D.units.filter(u=>u.side==='party')){
    const c=u.char;
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
    pf.appendChild(d);
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
  }
}
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
