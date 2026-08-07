/* Screens: create → town → delve; overlay sheets; HUD */
import {S,makeCharacter,randRecipe,refresh,partyUnits,persist,restore,grantXp} from '../game/state.js';
import {D,startDelve,castSkill,playerBody} from '../game/combat.js';
import {ARCHETYPES,ARCH_KEYS} from '../config/skills.js';
import {BAL} from '../config/balance.js';
import {rollPal} from '../art/parts.js';
import {getFrame} from '../art/assemble.js';
import {itemName,sameFamily,tryMerge} from '../game/loot.js';
import {scaledStats} from '../game/stats.js';
import {sysRng,RI,pick} from '../core/rng.js';
import {on,emit} from '../core/bus.js';
import {canvasPoint,bindCanvas} from '../render/iso.js';
import {wipeSave} from '../core/save.js';

const $=id=>document.getElementById(id);
const el=(tag,cls,html)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(html!=null)d.innerHTML=html;return d;};
export function toast(msg){
  const t=$('toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),1400);
}
on('toast',d=>toast(d.msg));

/* skill ranks derive from level: unlock at 1/3/6, +1 rank per 5 levels */
export function ranks(c){
  const un=[1,3,6];
  return [0,1,2].map(i=>c.lv>=un[i]?1+Math.floor((c.lv-un[i])/5):0);
}
function portrait(c,cnv,scale){
  refresh(c);
  c.skillRanks=ranks(c);
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
$('veil').onclick=closeSheets;

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
  [S.player,...S.team].forEach(c=>{refresh(c);c.hp=c.maxhp;c.skillRanks=ranks(c);});
  startDelve(depth);
  buildHud();show('scr-delve');
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
let sheetChar=null;
function openCharSheet(c){
  sheetChar=c;paintCharSheet();openSheet('sh-char');
}
function paintCharSheet(){
  const c=sheetChar;refresh(c);c.skillRanks=ranks(c);
  portrait(c,$('ch-face'),2);
  $('ch-name').textContent=c.name+(c.isPlayer?' (YOU)':'');
  $('ch-sub').textContent=ARCHETYPES[c.arch].n+' · LV '+c.lv+' · '+c.hp+'/'+c.maxhp+' HP';
  const xpNeed=BAL.xpCurve(c.lv);
  $('ch-xp').style.width=Math.min(100,c.xp/xpNeed*100)+'%';
  $('ch-xpt').textContent='XP '+c.xp+' / '+xpNeed+' · POINTS: '+c.pts;
  const rows=$('ch-stats');rows.innerHTML='';
  const label={patt:'pATT',matt:'mATT',pdef:'pDEF',mdef:'mDEF',dodge:'DODGE',crit:'CRIT'};
  for(const k of ['patt','matt','pdef','mdef','dodge','crit']){
    const r=el('div','strow');
    r.appendChild(el('span','sl',label[k]));
    r.appendChild(el('span','sv',Math.round(c.stats[k])+(k==='dodge'||k==='crit'?'%':'')
      +(c.assigned[k]?' <i>(+'+c.assigned[k]+')</i>':'')));
    const b=el('button',null,'+');
    b.disabled=c.pts<=0;
    b.onclick=()=>{
      c.assigned[k]+= (k==='dodge'||k==='crit')?1:2;
      c.pts--;refresh(c);persist();paintCharSheet();
    };
    r.appendChild(b);
    rows.appendChild(r);
  }
  const sk=$('ch-skills');sk.innerHTML='';
  ARCHETYPES[c.arch].skills.forEach((s,i)=>{
    const rk=c.skillRanks[i];
    sk.appendChild(el('div','skrow',
      `<span>${s.g} <b>${s.n}</b> ${rk?'R'+rk:'<i>LOCKED</i>'}</span><i>${s.d}</i>`));
  });
  const eq=$('ch-equip');eq.innerHTML='';
  for(const slot of ['weapon','offhand','armor','boots']){
    const it=c.equip[slot];
    const r=el('div','eqrow');
    r.appendChild(el('span','sl',slot.toUpperCase()));
    r.appendChild(el('span','sv',it?itemName(it):'<i>—</i>'));
    const b=el('button',null,it?'SWAP':'EQUIP');
    b.onclick=()=>openInv(slot);
    r.appendChild(b);
    if(it){
      const u=el('button','ghost','✕');
      u.onclick=()=>{S.inv.push(it);c.equip[slot]=null;refresh(c);persist();paintCharSheet();};
      r.appendChild(u);
    }
    eq.appendChild(r);
  }
  $('ch-release').style.display=c.isPlayer?'none':'block';
  $('ch-release').onclick=()=>{
    if(!confirm('Release '+sheetChar.name+'? They leave forever.'))return;
    for(const slot of ['weapon','offhand','armor','boots'])
      if(sheetChar.equip[slot]){S.inv.push(sheetChar.equip[slot]);sheetChar.equip[slot]=null;}
    S.team=S.team.filter(m=>m!==sheetChar);
    persist();closeSheets();buildTown();
    toast(sheetChar.name.toUpperCase()+' MOVES ON');
  };
}
/* ═══ INVENTORY ═══ */
let invFilter=null, mergeSel=null;
function openInv(slotFilter){
  invFilter=slotFilter;mergeSel=null;paintInv();openSheet('sh-inv');
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
  let items=S.inv;
  if(invFilter)items=items.filter(i=>i.slot===invFilter);
  if(mergeSel)items=items.filter(i=>i!==mergeSel&&sameFamily(i,mergeSel));
  if(!items.length)host.appendChild(el('div','hint',
    mergeSel?'NO MATCHING ITEM — NEED SAME BASE, AFFIXES AND +LEVEL':'NOTHING HERE YET — DELVE FOR LOOT'));
  for(const it of items){
    const d=el('div','item');
    d.appendChild(el('div','in','<b>'+itemName(it)+'</b><i>T'+it.tier+' '+it.slot.toUpperCase()+' · '+statLine(it)+'</i>'));
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
        if(S.screen==='scr-town'){openCharSheet(c);}else emit('hud');
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
export function buildHud(){
  $('hud-depth').textContent='FLOOR '+S.depth;
  $('hud-silver').textContent=S.silver+'s';
  const pf=$('hud-party');pf.innerHTML='';
  for(const u of D.units.filter(u=>u.side==='party')){
    const d=el('div','pf');d.dataset.id=u.char.id;
    const cnv=el('canvas');d.appendChild(cnv);portrait(u.char,cnv,1);
    d.appendChild(el('div','pfhp','<div class="pfin"></div>'));
    d.onclick=()=>{D.paused=true;openCharSheet(u.char);};
    pf.appendChild(d);
  }
  const sb=$('hud-skills');sb.innerHTML='';
  const p=S.player;
  ARCHETYPES[p.arch].skills.forEach((s,i)=>{
    const b=el('button','skb',`<b>${s.g}</b><i>${s.n}</i><span class="cd"></span>`);
    b.onclick=()=>{
      const body=playerBody();
      if(body&&body.alive)castSkill(body,i,true);
    };
    sb.appendChild(b);
  });
  $('hud-mode').textContent=S.mode==='auto'?'⚔ AUTO':'✋ MANUAL';
  syncHud();
}
export function syncHud(){
  $('hud-silver').textContent=S.silver+'s';
  $('hud-depth').textContent='FLOOR '+S.depth;
  for(const d of $('hud-party').children){
    const u=D.units.find(u=>u.char&&u.char.id===d.dataset.id);
    if(!u)continue;
    const inb=d.querySelector('.pfin');
    if(inb){
      const mh=u.char.stats?u.char.stats.hp:1;
      inb.style.width=Math.max(0,u.hp/mh*100)+'%';
      d.classList.toggle('dead',!u.alive);
    }
  }
  const p=playerBody();
  const btns=$('hud-skills').children;
  if(p)ARCHETYPES[p.char.arch].skills.forEach((s,i)=>{
    const b=btns[i];if(!b)return;
    const rk=p.char.skillRanks[i];
    b.disabled=!p.alive||rk<1;
    const cd=b.querySelector('.cd');
    const f=Math.max(0,Math.min(1,p.skillCds[i]/s.cd));
    cd.style.height=(f*100)+'%';
  });
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
  startDelve(d);buildHud();
  toast('FLOOR '+d+(d>S.depth-1?' — THE DARK THICKENS':''));
}
function writeBack(){
  for(const u of D.units)if(u.side==='party'&&u.char)u.char.hp=Math.max(1,Math.round(u.hp));
}
/* canvas taps = rally / manual move */
export function initCanvasInput(canvas){
  canvas.addEventListener('pointerdown',e=>{
    const [wx,wy]=canvasPoint(e);
    D.rally={x:wx,y:wy};
  });
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
