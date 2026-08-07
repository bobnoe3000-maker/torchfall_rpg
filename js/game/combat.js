/* Delve simulation: units, cooldown combat, procs, skills, loot, ebb & flow */
import {W,genDungeon,solid,los,astar,buildFlow,revealFog,idx,inB} from './world.js';
import {S,partyUnits,grantXp,refresh,persist} from './state.js';
import {derive,rollDamage,itemProcs} from './stats.js';
import {genItem} from './loot.js';
import {PROCS} from '../config/gear.js';
import {ENEMY_TYPES,ENEMY_PREFIXES} from '../config/enemies.js';
import {ARCHETYPES} from '../config/skills.js';
import {BAL} from '../config/balance.js';
import {mulberry32,sysRng,R,RI,pick} from '../core/rng.js';
import {rollPal,WEAPONS} from '../art/parts.js';
import {emit} from '../core/bus.js';

export const D={units:[],loot:[],fx:[],floaters:[],cam:{x:0,y:0},rally:null,
  running:false,t:0,speed:1,paused:false,rng:sysRng,kills:0};

export function startDelve(depth){
  S.depth=depth;
  D.rng=mulberry32((depth*7919+Date.now())>>>0);
  genDungeon(D.rng);
  D.units=[];D.loot=[];D.fx=[];D.floaters=[];D.rally=null;D.t=0;D.kills=0;
  const home=W.rooms[0];
  const offs=[[0,0],[-1.2,.6],[.9,-1.1]];
  partyUnits().forEach((c,i)=>{
    refresh(c);
    D.units.push(mkBody(c,'party',home.cx+.5+offs[i][0],home.cy+.5+offs[i][1]));
  });
  for(let ri=1;ri<W.rooms.length;ri++){
    const r=W.rooms[ri],n=RI(D.rng,2,3+Math.min(2,depth>>2));
    for(let i=0;i<n;i++){
      const x=RI(D.rng,r.x+1,r.x+r.w-2)+.5,y=RI(D.rng,r.y+1,r.y+r.h-2)+.5;
      if(solid(x,y))continue;
      D.units.push(mkEnemy(depth,x,y));
    }
  }
  const p=D.units.find(u=>u.side==='party');
  D.cam.x=p.x;D.cam.y=p.y;
  D.running=true;
  emit('delve-start',{depth});
}
function mkBody(char,side,x,y){
  return {char,side,x,y,face:1,anim:'idle',animT:R(D.rng,0,900),
    atkCd:R(D.rng,300,1400),        // desynced from the first second
    skillCds:char.skills? char.skills.map(()=>R(D.rng,1000,4000)) :
      (char.arch?ARCHETYPES[char.arch].skills.map(()=>R(D.rng,1500,5000)):[]),
    procsOn:[],castLock:0,path:null,repath:0,walking:false,awake:side==='party',
    hp:char.hp,alive:true};
}
function mkEnemy(depth,x,y){
  const pool=ENEMY_TYPES.filter(t=>t.minD<=depth);
  const type=pick(D.rng,pool);
  const prePool=ENEMY_PREFIXES.filter(p=>p.minD<=depth);
  const pre=pick(D.rng,prePool);
  const lv=Math.max(1,BAL.enemyLevel(depth)+RI(D.rng,-1,1));
  const base={...type.base};
  base.hp=Math.round(base.hp*BAL.depthHp(depth)*(pre.mult.hp||1));
  base.patt=Math.round(base.patt*BAL.depthAtk(depth)*(pre.mult.patt||1));
  base.matt=Math.round(base.matt*BAL.depthAtk(depth)*(pre.mult.matt||1));
  base.pdef=Math.round(base.pdef*(pre.mult.pdef||1));
  base.mdef=Math.round(base.mdef*(pre.mult.mdef||1));
  base.dodge=Math.round(base.dodge*(pre.mult.dodge||1));
  base.spd=base.spd*(pre.mult.spd||1);
  const pal=rollPal(D.rng);
  pal.s=type.skin.s;pal.S=type.skin.S;pal.n=type.skin.n;
  if(pre.tint){pal[1]=pre.tint;pal[2]=shade(pre.tint,1.25);pal[3]=shade(pre.tint,1.55);}
  const char={id:'e',name:(pre.n?pre.n+' ':'')+type.n,lv,recipe:{...type.recipe},pal,
    stats:{...base,crit:base.crit},hp:base.hp,maxhp:base.hp,
    proc:pre.proc||null,lootMult:pre.lootMult||1,isEnemy:true,
    weaponKind: WEAPONS[type.recipe.weapon]&&WEAPONS[type.recipe.weapon].g
      ? WEAPONS[type.recipe.weapon].kind : 'punch'};
  const b=mkBody(char,'foe',x,y);
  b.awake=false;b.hp=base.hp;
  return b;
}
function shade(hex,f){
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,Math.round(((n>>16)&255)*f)),
        g=Math.min(255,Math.round(((n>>8)&255)*f)),
        b=Math.min(255,Math.round((n&255)*f));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
const nearest=(u,side,maxd)=>{
  let best=null,bd=maxd;
  for(const o of D.units)if(o.alive&&o.side===side){
    const d=Math.hypot(o.x-u.x,o.y-u.y);
    if(d<bd){bd=d;best=o;}
  }
  return best;
};
function moveUnit(u,dx,dy,dt,spd){
  const len=Math.hypot(dx,dy);if(len<1e-4)return;
  const slow=u.procsOn.find(p=>p.k==='slow');
  const sp=spd*(slow?1-PROCS.slow.slow:1)*dt/1000;
  const nx=u.x+dx/len*sp,ny=u.y+dy/len*sp;
  if(!solid(nx,u.y))u.x=nx;
  if(!solid(u.x,ny))u.y=ny;
  u.face=dx>0?1:dx<0?-1:u.face;u.walking=true;
}
function moveAlong(u,tx,ty,dt,spd){
  if(los(u.x,u.y,tx,ty)){u.path=null;moveUnit(u,tx-u.x,ty-u.y,dt,spd);return;}
  const pk=((tx|0)*97)+(ty|0);
  u.repath-=dt;
  if(!u.path||u.pathKey!==pk||u.repath<=0){
    u.path=astar(u.x|0,u.y|0,tx|0,ty|0);u.pathKey=pk;u.repath=650+D.rng()*350;
  }
  if(u.path&&u.path.length){
    while(u.path.length>1&&los(u.x,u.y,u.path[1][0]+.5,u.path[1][1]+.5))u.path.shift();
    const wp=u.path[0];
    if(Math.hypot(wp[0]+.5-u.x,wp[1]+.5-u.y)<.35)u.path.shift();
    const w2=u.path[0];
    if(w2){moveUnit(u,w2[0]+.5-u.x,w2[1]+.5-u.y,dt,spd);return;}
  }
  moveUnit(u,tx-u.x,ty-u.y,dt,spd);
}
function separate(u,dt){
  for(const o of D.units){
    if(o===u||!o.alive)continue;
    const dx=u.x-o.x,dy=u.y-o.y,d=Math.hypot(dx,dy);
    if(d>0.001&&d<0.62){
      const p=(0.62-d)*dt/240;
      if(!solid(u.x+dx/d*p,u.y))u.x+=dx/d*p;
      if(!solid(u.x,u.y+dy/d*p))u.y+=dy/d*p;
    }
  }
}
function foeAdvance(u,dt,cx,cy){
  const tx=u.x|0,ty=u.y|0,d0=W.flow?W.flow[idx(tx,ty)]:-1;
  const spd=u.char.stats.spd||2;
  if(d0<0){moveAlong(u,cx,cy,dt,spd);return;}
  if(d0<=1){const t=nearest(u,'party',4);if(t){moveUnit(u,t.x-u.x,t.y-u.y,dt,spd);return;}}
  let bx=0,by=0,bd=d0;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=tx+dx,ny=ty+dy;
    if(!inB(nx,ny))continue;
    const dv=W.flow[idx(nx,ny)];
    if(dv>=0&&dv<bd){bd=dv;bx=dx;by=dy;}
  }
  if(bd<d0)moveUnit(u,(tx+bx+.5)-u.x,(ty+by+.5)-u.y,dt,spd);
  else{const t=nearest(u,'party',20);if(t)moveUnit(u,t.x-u.x,t.y-u.y,dt,spd);}
}
/* ── damage + procs ── */
function applyProc(target,key,src){
  const p=PROCS[key];if(!p)return;
  if(D.rng()>p.chance)return;
  if(key==='leech')return;
  const ex=target.procsOn.find(q=>q.k===key);
  if(ex)ex.left=p.dur;
  else target.procsOn.push({k:key,left:p.dur,tick:800,srcAtk:src});
  float(target,PROCS[key].n.toUpperCase(),p.col);
}
function hit(att,tgt,pow,phys,procs,critBonus){
  const as=att.char.stats,ts=tgt.char.stats||tgt.char.stats;
  const r=rollDamage(D.rng,as,tgt.char.stats,phys,critBonus);
  if(r.dodged){float(tgt,'DODGE','#9AB4C4');return 0;}
  const dmg=Math.round(r.dmg*pow);
  tgt.hp-=dmg;tgt.flash=110;
  float(tgt,'-'+dmg,r.crit?'#FFD27A':(tgt.side==='party'?'#E86A4A':'#D9CFBA'));
  for(const pk of procs||[]){
    if(pk==='leech'){
      const h=Math.round(dmg*PROCS.leech.chance*PROCS.leech.heal*3);
      att.hp=Math.min(att.char.stats.hp,att.hp+h);
      float(att,'+'+h,'#C45B7A');
    } else applyProc(tgt,pk,as);
  }
  if(tgt.hp<=0)kill(att,tgt);
  return dmg;
}
function kill(att,tgt){
  tgt.hp=0;tgt.alive=false;tgt.anim='dead';
  if(tgt.side==='foe'){
    D.kills++;
    const lv=tgt.char.lv,lm=tgt.char.lootMult||1;
    D.loot.push({x:tgt.x,y:tgt.y,kind:'silver',amt:Math.round(BAL.dropSilver(S.depth)*lm),ph:D.rng()*6.3});
    if(D.rng()<BAL.dropItemChance*lm)
      D.loot.push({x:tgt.x+R(D.rng,-.3,.3),y:tgt.y+R(D.rng,-.3,.3),kind:'item',
        item:genItem(D.rng,lv,lm),ph:D.rng()*6.3});
    for(const b of D.units)if(b.side==='party'&&b.alive)grantXp(b.char,7+lv*3);
    emit('hud');
  } else if(tgt.char.isPlayer){
    onWipeCheck();
  } else {
    // teammate permadeath
    S.team=S.team.filter(c=>c.id!==tgt.char.id);
    emit('toast',{msg:tgt.char.name.toUpperCase()+' HAS FALLEN — FOREVER'});
    emit('hud');
    persist();
    onWipeCheck();
  }
}
function onWipeCheck(){
  const alivePlayer=D.units.some(u=>u.side==='party'&&u.alive&&u.char.isPlayer);
  if(!alivePlayer){D.running=false;emit('player-dead');}
}
function float(u,txt,col){D.floaters.push({x:u.x,y:u.y,txt,col,life:850});}
/* ── skills ── */
export function castSkill(body,si,manual){
  const arch=ARCHETYPES[body.char.arch];if(!arch)return false;
  const sk=arch.skills[si];
  if(body.skillCds[si]>0)return false;
  if((body.char.skillRanks[si]||0)<1)return false;
  const rank=body.char.skillRanks[si];
  const powMul=1+(rank-1)*.15;
  const allies=D.units.filter(u=>u.side==='party'&&u.alive);
  const foes=D.units.filter(u=>u.side==='foe'&&u.alive);
  let ok=false;
  if(sk.kind==='nuke'){
    const t=nearest(body,'foe',6);
    if(t){hit(body,t,sk.pow*powMul,sk.phys!==false,sk.proc?[sk.proc]:[]);spark(t,'#FFE6A0');ok=true;}
  } else if(sk.kind==='aoe'){
    let any=false;
    for(const f of foes)if(Math.hypot(f.x-body.x,f.y-body.y)<=sk.rad+1){
      hit(body,f,sk.pow*powMul,sk.phys!==false,sk.proc?[sk.proc]:[]);spark(f,'#FFB27A');any=true;}
    ok=any;
  } else if(sk.kind==='buff'){
    for(const a of allies)a.char.buffs.push({stat:sk.stat,amt:sk.amt*(sk.flat?rank:powMul),flat:sk.flat,left:sk.dur});
    allies.forEach(a=>{refresh(a.char);spark(a,'#7FD8F8');});
    ok=true;
  } else if(sk.kind==='heal'){
    const pool=sk.all?allies:[allies.filter(a=>a.hp<a.char.stats.hp)
      .sort((a,b)=>a.hp/a.char.stats.hp-b.hp/b.char.stats.hp)[0]].filter(Boolean);
    for(const a of pool){
      const amt=Math.round(a.char.stats.hp*sk.amt*powMul);
      a.hp=Math.min(a.char.stats.hp,a.hp+amt);
      float(a,'+'+amt,'#7FD8A4');spark(a,'#7FD8A4');
    }
    ok=pool.length>0;
  } else if(sk.kind==='taunt'){
    for(const f of foes)if(Math.hypot(f.x-body.x,f.y-body.y)<8)f.forced=body;
    body.char.buffs.push({stat:'pdef',amt:sk.defAmt,left:sk.dur});refresh(body.char);
    setTimeout(()=>{},0);ok=true;
  } else if(sk.kind==='dot'){
    const t=nearest(body,'foe',6);
    if(t){t.procsOn.push({k:'poison',left:sk.dur,tick:800});float(t,'ENVENOMED','#7CBE4A');ok=true;}
  }
  if(ok){body.skillCds[si]=sk.cd;if(manual)emit('hud');}
  return ok;
}
function spark(u,col){
  for(let i=0;i<6;i++){
    const a=D.rng()*6.28,v=R(D.rng,1.4,3.2);
    D.fx.push({t:'spark',x:u.x,y:u.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.5-1.2,col,life:R(D.rng,220,320),max:320});
  }
}
/* ── projectiles ── */
function bolt(src,tgt,pow,phys,col,procs){
  D.fx.push({t:'bolt',x:src.x,y:src.y-.6,tgt,src,pow,phys,procs,col,life:4000,trail:[]});
}
/* ── main step ── */
let flowT=0;
export function step(dt){
  if(!D.running||D.paused)return;
  dt*=D.speed;D.t+=dt;
  for(const f of D.floaters)f.life-=dt;
  D.floaters=D.floaters.filter(f=>f.life>0);
  flowT-=dt;
  const party=D.units.filter(u=>u.side==='party'&&u.alive);
  if(!party.length)return;
  if(flowT<=0){buildFlow(party);flowT=420;}
  const cx=party.reduce((s,u)=>s+u.x,0)/party.length;
  const cy=party.reduce((s,u)=>s+u.y,0)/party.length;
  for(const u of D.units){
    if(!u.alive)continue;
    u.walking=false;
    u.atkCd-=dt;
    if(u.castLock>0)u.castLock-=dt;
    if(u.flash>0)u.flash-=dt;
    u.skillCds=u.skillCds.map(c=>Math.max(0,c-dt));
    // buffs decay
    if(u.char.buffs&&u.char.buffs.length){
      let ch=false;
      for(const b of u.char.buffs){b.left-=dt;if(b.left<=0)ch=true;}
      if(ch){u.char.buffs=u.char.buffs.filter(b=>b.left>0);refresh(u.char);}
    }
    // procs tick
    for(const p of u.procsOn){
      p.left-=dt;p.tick-=dt;
      if(p.tick<=0&&PROCS[p.k].dot){
        p.tick=800;
        const dmg=Math.max(1,Math.round((p.srcAtk?(p.srcAtk.patt+p.srcAtk.matt)/2:8)*PROCS[p.k].dot));
        u.hp-=dmg;float(u,'-'+dmg,PROCS[p.k].col);
        if(u.hp<=0){kill(u,u);break;}
      }
    }
    u.procsOn=u.procsOn.filter(p=>p.left>0);
    if(!u.alive)continue;
    const spd=u.char.stats.spd||2.2;
    if(u.side==='foe'){
      if(!u.awake){if(Math.hypot(u.x-cx,u.y-cy)<8.5)u.awake=true;else continue;}
      const kind=u.char.weaponKind||'punch';
      const rng2=BAL.attackRange[kind];
      const tgt=u.forced&&u.forced.alive?u.forced:nearest(u,'party',30);
      if(!tgt)continue;
      const d=Math.hypot(tgt.x-u.x,tgt.y-u.y);
      if(d<=rng2){
        if(u.atkCd<=0&&u.castLock<=0){
          u.atkCd=BAL.attackCd[kind]*R(D.rng,.9,1.15);
          u.castLock=560;u.animA=D.t;u.face=(tgt.x-u.x)>0?1:-1;
          if(kind==='bow'||kind==='raise')
            bolt(u,tgt,1,kind!=='raise',kind==='raise'?'#B08CFF':'#D9CFBA',u.char.proc?[u.char.proc]:[]);
          else hit(u,tgt,1,true,u.char.proc?[u.char.proc]:[]);
        }
      } else if(u.castLock<=0) foeAdvance(u,dt,cx,cy);
      separate(u,dt);
      continue;
    }
    /* party member */
    const c=u.char;
    const kind=c.equip.weapon?c.equip.weapon.kind:'punch';
    const rng2=BAL.attackRange[kind];
    const foe=nearest(u,'foe',11);
    // NPC skill autopilot (player casts manually)
    if(!c.isPlayer&&foe){
      const arch=ARCHETYPES[c.arch];
      for(let si=0;si<3;si++)
        if((c.skillRanks[si]||0)>0&&u.skillCds[si]<=0&&D.rng()<.02){castSkill(u,si,false);break;}
    }
    if(u.castLock>0){separate(u,dt);continue;}
    if(foe){
      const d=Math.hypot(foe.x-u.x,foe.y-u.y);
      if(d<=rng2){
        if(u.atkCd<=0){
          u.atkCd=BAL.attackCd[kind]*R(D.rng,.9,1.15);
          u.castLock=560;u.animA=D.t;u.face=(foe.x-u.x)>0?1:-1;
          const procs=itemProcs(c);
          if(kind==='bow')bolt(u,foe,1,true,'#D9CFBA',procs);
          else if(kind==='raise')bolt(u,foe,1,false,c.pal.x,procs);
          else hit(u,foe,1,true,procs);
        }
      } else if(S.mode==='auto'||D.rally) {
        if(D.rally)moveAlong(u,D.rally.x,D.rally.y,dt,spd);
        else moveAlong(u,foe.x,foe.y,dt,spd);
      }
    } else {
      const lead=party[0];
      if(D.rally){
        if(Math.hypot(D.rally.x-u.x,D.rally.y-u.y)>0.7)moveAlong(u,D.rally.x,D.rally.y,dt,spd);
      } else if(S.mode==='auto'){
        if(u===lead){
          const near=D.loot.length?D.loot.reduce((b,p)=>{
            const d=Math.hypot(p.x-u.x,p.y-u.y);return d<b.d?{d,p}:b;},{d:7,p:null}):{d:7,p:null};
          if(near.p)moveAlong(u,near.p.x,near.p.y,dt,spd);
          else{const far=nearest(u,'foe',1e9);if(far)moveAlong(u,far.x,far.y,dt,spd);}
        } else if(Math.hypot(lead.x-u.x,lead.y-u.y)>1.5)moveAlong(u,lead.x,lead.y,dt,spd);
      } else if(u!==lead&&Math.hypot(lead.x-u.x,lead.y-u.y)>1.8)
        moveAlong(u,lead.x,lead.y,dt,spd);
    }
    separate(u,dt);
  }
  if(D.rally&&Math.hypot(D.rally.x-cx,D.rally.y-cy)<0.8)D.rally=null;
  /* pickups */
  for(const p of D.loot){
    for(const b of party){
      if(Math.hypot(p.x-b.x,p.y-b.y)<.65){
        if(p.kind==='silver'){S.silver+=p.amt;float(b,'+'+p.amt+'s','#E8C46A');}
        else{S.inv.push(p.item);float(b,'+ITEM','#C9A24A');}
        p.dead=true;emit('hud');break;
      }
    }
  }
  D.loot=D.loot.filter(p=>!p.dead);
  /* breather regen */
  if(!D.units.some(u=>u.side==='foe'&&u.alive&&u.awake&&Math.hypot(u.x-cx,u.y-cy)<10))
    for(const b of party)b.hp=Math.min(b.char.stats.hp,b.hp+b.char.stats.hp*BAL.regenPerSec*dt/1000);
  /* fx */
  for(const f of D.fx){
    f.life-=dt;
    if(f.t==='spark'){f.x+=f.vx*dt/1000;f.y+=f.vy*dt/1000;f.vy+=dt/300;}
    else if(f.t==='bolt'){
      const t=f.tgt;
      if(!t.alive){f.life=0;continue;}
      const dx=t.x-f.x,dy=(t.y-.5)-f.y,d=Math.hypot(dx,dy),sp=9*dt/1000;
      f.trail.push([f.x,f.y]);if(f.trail.length>4)f.trail.shift();
      if(d<=sp||d<.15){hit(f.src,t,f.pow,f.phys,f.procs);f.life=0;}
      else{f.x+=dx/d*sp;f.y+=dy/d*sp;}
    }
  }
  D.fx=D.fx.filter(f=>f.life>0);
  const k=Math.min(1,dt/220);
  D.cam.x+=(cx-D.cam.x)*k;D.cam.y+=(cy-D.cam.y)*k;
  revealFog(party);
  if(S.depth>S.bestDepth){S.bestDepth=S.depth;}
}
export function playerBody(){return D.units.find(u=>u.char&&u.char.isPlayer);}
