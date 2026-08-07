import {BAL} from '../config/balance.js';
import {PROCS} from '../config/gear.js';
/* derive final combat stats from base + assigned + level + gear + buffs */
export function derive(u){
  const d={patt:0,matt:0,pdef:0,mdef:0,dodge:0,crit:0,hp:0};
  const add=st=>{ for(const k in st) d[k]=(d[k]||0)+st[k]; };
  add(u.base); add(u.assigned||{});
  d.patt+=u.lv*1.5; d.matt+=u.lv*1.5; d.hp+=u.lv*BAL.hpPerLevel;
  for(const slot of ['weapon','offhand','armor','boots']){
    const it=u.equip&&u.equip[slot]; if(!it)continue;
    add(scaledStats(it));
  }
  for(const b of (u.buffs||[])){
    if(b.stat==='all'){ for(const k of ['patt','matt','pdef','mdef','dodge','crit']) d[k]*= (1+b.amt); }
    else if(b.flat) d[b.stat]+=b.amt;
    else d[b.stat]*=(1+b.amt);
  }
  d.dodge=Math.min(BAL.dodgeCap,d.dodge);
  d.crit=Math.min(BAL.critCap,d.crit);
  d.hp=Math.round(d.hp);
  return d;
}
export function scaledStats(it){
  const m=Math.pow(1.32,it.plus)*(1+it.tier*.08);
  const out={};
  for(const k in it.st) out[k]=Math.round(it.st[k]*m);
  return out;
}
export function itemProcs(u){
  const ps=[];
  for(const slot of ['weapon','offhand','armor','boots']){
    const it=u.equip&&u.equip[slot]; if(!it)continue;
    for(const p of it.procs||[]) if(PROCS[p]) ps.push(p);
  }
  return ps;
}
export function rollDamage(rng,att,def,phys,critBonus){
  const a=phys?att.patt:att.matt;
  const dfn=phys?def.pdef:def.mdef;
  if(rng()*100<def.dodge) return {dmg:0,dodged:true};
  const crit=rng()*100<att.crit+(critBonus||0);
  let dmg=a*(0.88+rng()*0.24)*(100/(100+dfn));
  if(crit)dmg*=1.75;
  return {dmg:Math.max(1,Math.round(dmg)),crit};
}
