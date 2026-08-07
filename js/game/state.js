import {BAL} from '../config/balance.js';
import {ARCHETYPES} from '../config/skills.js';
import {rollPal,HEADS,TORSOS,ARMS,LEGS} from '../art/parts.js';
import {sysRng,RI,pick} from '../core/rng.js';
import {saveGame,loadGame} from '../core/save.js';
import {derive} from './stats.js';

export const S={
  screen:'boot', player:null, team:[], inv:[], silver:BAL.startingSilver,
  depth:1, bestDepth:0, tavern:[], seedCounter:1,
  mode:'auto',   // auto | manual movement
};
const NAMES=['Bran','Elara','Nix','Torvald','Morwen','Vex','Hedda','Caldus','Wren','Sigrun',
 'Ithra','Ferrin','Osric','Nyra','Garruk','Selwyn','Lark','Aldous','Dagny','Thax'];

export function randRecipe(rng,arch){
  const a=ARCHETYPES[arch];
  const r={head:RI(rng,0,HEADS.length-1),
    torso:pick(rng,a.parts.torso), armR:pick(rng,a.parts.arms), armL:pick(rng,a.parts.arms),
    legR:pick(rng,a.parts.legs), legL:pick(rng,a.parts.legs), weapon:0, offhand:0};
  return r;
}
export function makeCharacter(arch,recipe,pal,isPlayer){
  const a=ARCHETYPES[arch];
  return {
    id:'c'+(S.seedCounter++), name:pick(sysRng,NAMES), arch, isPlayer:!!isPlayer,
    recipe, pal, lv:1, xp:0, pts:BAL.statPointsPerLevel,
    base:{...a.stats}, assigned:{patt:0,matt:0,pdef:0,mdef:0,dodge:0,crit:0},
    skillRanks:[1,0,0], equip:{weapon:null,offhand:null,armor:null,boots:null},
    buffs:[], hp:0, alive:true,
  };
}
export function refresh(u){
  const d=derive(u);
  const frac=u.maxhp?Math.max(0.05,u.hp/u.maxhp):1;
  u.stats=d; u.maxhp=d.hp; u.hp=Math.min(d.hp,Math.round(d.hp*frac));
  /* equipment drives the visible doll */
  u.recipe.weapon = u.equip.weapon ? gearPart(u.equip.weapon) : 0;
  u.recipe.offhand= u.equip.offhand? gearPart(u.equip.offhand): 0;
  if(u.equip.armor) u.recipe.torso=u.equip.armor.part;
  if(u.equip.boots){u.recipe.legR=u.equip.boots.part;u.recipe.legL=u.equip.boots.part;}
}
import {GEAR_BASES} from '../config/gear.js';
function gearPart(it){ return it.part; }
export function grantXp(u,amt){
  u.xp+=amt;
  while(u.xp>=BAL.xpCurve(u.lv)){ u.xp-=BAL.xpCurve(u.lv); u.lv++; u.pts+=BAL.statPointsPerLevel; refresh(u); }
}
export function persist(){
  const strip=u=>({...u,stats:undefined,buffs:[],hp:Math.round(u.hp)});
  saveGame({v:1,player:strip(S.player),team:S.team.map(strip),inv:S.inv,
    silver:S.silver,bestDepth:S.bestDepth,tavern:S.tavern.map(strip)});
}
export function restore(){
  const d=loadGame(); if(!d||!d.player)return false;
  S.player=d.player;S.team=d.team||[];S.inv=d.inv||[];
  S.silver=d.silver??BAL.startingSilver;S.bestDepth=d.bestDepth||0;S.tavern=d.tavern||[];
  [S.player,...S.team,...S.tavern].forEach(u=>{u.buffs=[];refresh(u);if(!u.hp)u.hp=u.maxhp;});
  return true;
}
export function partyUnits(){ return [S.player,...S.team].filter(u=>u&&u.alive); }
