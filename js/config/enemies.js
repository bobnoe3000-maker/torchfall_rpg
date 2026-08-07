/* Enemy config: type (recipe template + stats + kind) × prefix × level.
   "Stone Kobold (Lv 10)" = kobold type + Stone prefix + level scaling. */
export const ENEMY_TYPES=[
 {id:'goblin', n:'Goblin', minD:1, recipe:{head:1,torso:0,armR:0,armL:0,legR:0,legL:0,weapon:1,offhand:0},
  skin:{s:'#7C9A48',S:'#A6C46E',n:'#55702F'}, base:{hp:34,patt:8,matt:0,pdef:2,mdef:1,dodge:6,crit:4,spd:2.5}},
 {id:'kobold', n:'Kobold', minD:1, recipe:{head:6,torso:0,armR:6,armL:0,legR:6,legL:6,weapon:3,offhand:0},
  skin:{s:'#C08A5E',S:'#E2B27E',n:'#8E6242'}, base:{hp:40,patt:9,matt:0,pdef:3,mdef:2,dodge:5,crit:5,spd:2.3}},
 {id:'skeleton', n:'Skeleton', minD:1, recipe:{head:2,torso:2,armR:2,armL:2,legR:2,legL:2,weapon:2,offhand:0},
  skin:{s:'#CFC7B0',S:'#EFE9D6',n:'#9A9280'}, base:{hp:48,patt:9,matt:0,pdef:5,mdef:0,dodge:2,crit:4,spd:1.8}},
 {id:'crabling', n:'Crabling', minD:2, recipe:{head:3,torso:3,armR:3,armL:3,legR:3,legL:3,weapon:0,offhand:0},
  skin:{s:'#C97A5A',S:'#E8A483',n:'#94523A'}, base:{hp:60,patt:10,matt:0,pdef:9,mdef:2,dodge:2,crit:3,spd:1.6}},
 {id:'cultist', n:'Cultist', minD:2, recipe:{head:0,torso:0,armR:0,armL:0,legR:0,legL:0,weapon:7,offhand:5},
  skin:{s:'#B69AC0',S:'#D8C2E0',n:'#84688E'}, base:{hp:44,patt:3,matt:11,pdef:2,mdef:6,dodge:4,crit:5,spd:2.0}},
 {id:'ooze', n:'Ooze', minD:3, recipe:{head:8,torso:8,armR:8,armL:8,legR:8,legL:8,weapon:0,offhand:0},
  skin:{s:'#6FAF7C',S:'#9AD8A6',n:'#4A7E56'}, base:{hp:80,patt:11,matt:5,pdef:4,mdef:8,dodge:1,crit:2,spd:1.4}},
 {id:'mantid', n:'Mantid', minD:4, recipe:{head:9,torso:9,armR:9,armL:9,legR:9,legL:9,weapon:0,offhand:0},
  skin:{s:'#8AA050',S:'#B4CC78',n:'#5E7434'}, base:{hp:66,patt:14,matt:0,pdef:5,mdef:4,dodge:12,crit:12,spd:2.9}},
];
export const ENEMY_PREFIXES=[
 {n:'Lesser', minD:1, mult:{hp:.75,patt:.8,matt:.8}, lootMult:.7},
 {n:'',       minD:1, mult:{}, lootMult:1},
 {n:'Stone',  minD:2, mult:{hp:1.3,pdef:2.0}, tint:'#8A8798', lootMult:1.2},
 {n:'Fiery',  minD:3, mult:{matt:1.6}, proc:'burn', tint:'#C8582A', lootMult:1.25},
 {n:'Swift',  minD:3, mult:{spd:1.35,dodge:1.8}, tint:'#7FD8F8', lootMult:1.2},
 {n:'Venomous',minD:4, mult:{patt:1.2}, proc:'poison', tint:'#7CBE4A', lootMult:1.3},
 {n:'Elder',  minD:5, mult:{hp:1.6,patt:1.35,matt:1.35,pdef:1.3,mdef:1.3}, tint:'#DCB456', lootMult:1.7},
 {n:'Cursed', minD:6, mult:{hp:1.4,matt:1.5,mdef:1.6}, proc:'slow', tint:'#B08CFF', lootMult:1.6},
];
