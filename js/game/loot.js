import {GEAR_BASES,PREFIXES,SUFFIXES} from '../config/gear.js';
import {BAL} from '../config/balance.js';
import {RI,pick} from '../core/rng.js';
let nextId=1;
export function genItem(rng,tier,lootMult){
  const base=pick(rng,GEAR_BASES);
  const it={id:nextId++,base:GEAR_BASES.indexOf(base),slot:base.slot,part:base.part,
    kind:base.kind||null,tier,plus:0,st:{...base.st},procs:[],pre:-1,suf:-1};
  if(rng()< .62*(lootMult||1)){
    it.pre=RI(rng,0,PREFIXES.length-1);
    const p=PREFIXES[it.pre];
    for(const k in p.st) it.st[k]=(it.st[k]||0)+p.st[k];
    if(p.proc) it.procs.push(p.proc);
  }
  if(rng()< .45*(lootMult||1)){
    it.suf=RI(rng,0,SUFFIXES.length-1);
    const sfx=SUFFIXES[it.suf];
    for(const k in sfx.st) it.st[k]=(it.st[k]||0)+sfx.st[k];
    if(sfx.proc&&!it.procs.includes(sfx.proc)) it.procs.push(sfx.proc);
  }
  return it;
}
export function itemName(it){
  const b=GEAR_BASES[it.base];
  return (it.pre>=0?PREFIXES[it.pre].n+' ':'')+b.n+
    (it.suf>=0?' '+SUFFIXES[it.suf].n:'')+(it.plus?' (+'+it.plus+')':'');
}
export function sameFamily(a,b){
  return a.base===b.base&&a.pre===b.pre&&a.suf===b.suf&&a.plus===b.plus&&a.tier===b.tier;
}
export function tryMerge(rng,a,b){ // returns {ok,item?} — on fail both are gone
  const risk=BAL.mergeDestroyChance(a.plus+1);
  if(rng()<risk) return {ok:false,risk};
  const it={...a,id:++nextId+100000,st:{...a.st},procs:[...a.procs],plus:a.plus+1};
  return {ok:true,item:it,risk};
}
