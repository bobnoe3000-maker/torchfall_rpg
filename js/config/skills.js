/* Archetypes: base stats, growth flavor, 3 skills each.
   kind: nuke|aoe|buff|heal|taunt|dot — combat.js implements these verbs. */
export const ARCHETYPES={
  fighter:{n:'Fighter', stats:{patt:14,matt:4,pdef:8,mdef:4,dodge:4,crit:6,hp:150},
    weaponBias:['swing'], parts:{torso:[1,0],legs:[1,0],arms:[1,0]},
    skills:[
      {id:'cleave', n:'Cleave', g:'⚔', kind:'aoe', cd:7000, pow:1.4, rad:1.6,
       d:'Physical sweep hitting all foes in reach.'},
      {id:'warcry', n:'Warcry', g:'📢', kind:'buff', cd:12000, stat:'patt', amt:.3, dur:6000,
       d:'+30% pATT to the whole team for 6s.'},
      {id:'bulwark', n:'Bulwark', g:'🛡', kind:'taunt', cd:11000, dur:4000, defAmt:.5,
       d:'Draws all enemies; +50% pDEF while it holds.'}]},
  rogue:{n:'Rogue', stats:{patt:13,matt:4,pdef:4,mdef:4,dodge:12,crit:14,hp:110},
    weaponBias:['swing','bow'], parts:{torso:[0,4],legs:[0,6],arms:[0,9]},
    skills:[
      {id:'backstab', n:'Backstab', g:'🗡', kind:'nuke', cd:6000, pow:2.2, phys:true,
       d:'220% physical strike on the current target.'},
      {id:'envenom', n:'Envenom', g:'☠', kind:'dot', cd:9000, dps:.35, dur:5000, proc:'poison',
       d:'Poisons the target — heavy damage over 5s.'},
      {id:'shadow', n:'Shadowstep', g:'🌑', kind:'buff', cd:12000, stat:'dodge', amt:20, flat:true, dur:5000,
       d:'+20 dodge for 5s.'}]},
  mage:{n:'Mage', stats:{patt:4,matt:15,pdef:3,mdef:8,dodge:5,crit:8,hp:95},
    weaponBias:['raise'], parts:{torso:[0,5],legs:[0,5],arms:[0,5]},
    skills:[
      {id:'firebolt', n:'Firebolt', g:'🔥', kind:'nuke', cd:5500, pow:2.0, phys:false, proc:'burn',
       d:'200% magic bolt that sets the target burning.'},
      {id:'frostnova', n:'Frost Nova', g:'❄', kind:'aoe', cd:10000, pow:.9, rad:2.4, phys:false, proc:'slow',
       d:'Magic burst that slows everything nearby.'},
      {id:'manashield', n:'Mana Shield', g:'◈', kind:'buff', cd:13000, stat:'mdef', amt:.6, dur:6000,
       d:'+60% mDEF for 6s.'}]},
  cleric:{n:'Cleric', stats:{patt:8,matt:11,pdef:7,mdef:9,dodge:4,crit:5,hp:130},
    weaponBias:['swing','raise'], parts:{torso:[1,7],legs:[1,0],arms:[1,6]},
    skills:[
      {id:'smite', n:'Smite', g:'✦', kind:'nuke', cd:6500, pow:1.7, phys:false,
       d:'170% holy magic strike.'},
      {id:'bless', n:'Bless', g:'☀', kind:'buff', cd:14000, stat:'all', amt:.15, dur:7000,
       d:'+15% to every stat, whole team, 7s.'},
      {id:'mend', n:'Mend', g:'✚', kind:'heal', cd:8000, amt:.3,
       d:'Heals the most wounded ally 30%.'}]},
  healer:{n:'Healer', stats:{patt:4,matt:12,pdef:4,mdef:10,dodge:6,crit:4,hp:105},
    weaponBias:['raise'], parts:{torso:[0,8],legs:[0,8],arms:[0,8]},
    skills:[
      {id:'mend2', n:'Mend', g:'✚', kind:'heal', cd:6000, amt:.35,
       d:'Heals the most wounded ally 35%.'},
      {id:'radiance', n:'Radiance', g:'✳', kind:'heal', cd:12000, amt:.22, all:true,
       d:'Heals the whole team 22%.'},
      {id:'ward', n:'Ward', g:'❖', kind:'buff', cd:13000, stat:'mdef', amt:.5, dur:7000,
       d:'+50% mDEF, whole team, 7s.'}]},
};
export const ARCH_KEYS=Object.keys(ARCHETYPES);
/* how much each class values a stat — powers the class-aware "upgrade" indicator so
   a mage isn't told a heavy pATT weapon is a step up. hp is weighted down (big numbers). */
export const STAT_WEIGHTS={
  fighter:{patt:2,pdef:1.4,crit:1.2,dodge:1,mdef:.5,hp:.15,matt:.1},
  rogue:  {patt:1.8,dodge:1.8,crit:1.8,pdef:.6,mdef:.4,hp:.12,matt:.1},
  mage:   {matt:2.2,mdef:1.1,crit:1.2,dodge:.8,pdef:.4,hp:.12,patt:.1},
  cleric: {matt:1.6,mdef:1.2,pdef:1,patt:.6,crit:.6,dodge:.6,hp:.18},
  healer: {matt:1.8,mdef:1.4,pdef:.7,dodge:.6,crit:.4,hp:.15,patt:.1},
};
