/* Loot: base types map to Forge parts (equipment is VISIBLE on the doll).
   Affixes add stats and procs. "Fiery Warblade of Doom (+2)" is real data. */
export const GEAR_BASES=[
 // slot weapon: idx = WEAPONS index in parts.js
 {slot:'weapon', part:1, n:'Shortsword', kind:'swing', st:{patt:6}},
 {slot:'weapon', part:2, n:'Warblade',  kind:'swing', st:{patt:9}},
 {slot:'weapon', part:3, n:'Axe',       kind:'swing', st:{patt:8,crit:3}},
 {slot:'weapon', part:4, n:'Mace',      kind:'swing', st:{patt:7,pdef:2}},
 {slot:'weapon', part:5, n:'Shortbow',  kind:'bow',   st:{patt:7,dodge:2}},
 {slot:'weapon', part:6, n:'Longbow',   kind:'bow',   st:{patt:9}},
 {slot:'weapon', part:7, n:'Wand',      kind:'raise', st:{matt:8}},
 {slot:'weapon', part:8, n:'Staff',     kind:'raise', st:{matt:10}},
 // slot offhand: idx = OFFHANDS index
 {slot:'offhand', part:1, n:'Buckler', st:{pdef:5,dodge:2}},
 {slot:'offhand', part:2, n:'Kite Shield', st:{pdef:8}},
 {slot:'offhand', part:3, n:'Torch', st:{matt:3,patt:3}},
 {slot:'offhand', part:5, n:'Orb', st:{matt:6}},
 {slot:'offhand', part:6, n:'Tome', st:{matt:4,mdef:4}},
 {slot:'offhand', part:7, n:'Parry Dagger', st:{dodge:5,crit:3}},
 // slot armor: idx = TORSOS index (changes your torso sprite)
 {slot:'armor', part:0, n:'Tunic', st:{pdef:3,mdef:3}},
 {slot:'armor', part:1, n:'Plate', st:{pdef:9}},
 {slot:'armor', part:4, n:'Scale Mail', st:{pdef:6,mdef:3}},
 {slot:'armor', part:9, n:'Chitin Shell', st:{pdef:5,dodge:3}},
 // slot boots: idx = LEGS index (changes your legs sprite)
 {slot:'boots', part:0, n:'Boots', st:{dodge:3}},
 {slot:'boots', part:1, n:'Greaves', st:{pdef:4}},
 {slot:'boots', part:6, n:'Striders', st:{dodge:5}},
];
export const PREFIXES=[
 {n:'Fiery',    st:{matt:5},  proc:'burn'},
 {n:'Venomous', st:{patt:3},  proc:'poison'},
 {n:'Frozen',   st:{matt:4},  proc:'slow'},
 {n:'Vampiric', st:{patt:3},  proc:'leech'},
 {n:'Brutal',   st:{patt:7}},
 {n:'Arcane',   st:{matt:7}},
 {n:'Stony',    st:{pdef:7}},
 {n:'Warded',   st:{mdef:7}},
 {n:'Swift',    st:{dodge:6}},
 {n:'Keen',     st:{crit:7}},
];
export const SUFFIXES=[
 {n:'of Doom',        st:{patt:8}},
 {n:'of Storms',      st:{matt:8}},
 {n:'of the Turtle',  st:{pdef:6,mdef:4}},
 {n:'of the Fox',     st:{dodge:8}},
 {n:'of Precision',   st:{crit:8}},
 {n:'of the Colossus',st:{hp:40}},
 {n:'of Embers',      st:{matt:4}, proc:'burn'},
 {n:'of Leeching',    st:{patt:3}, proc:'leech'},
 {n:'of the Viper',   st:{crit:4}, proc:'poison'},
 {n:'of Winter',      st:{mdef:4}, proc:'slow'},
];
export const PROCS={
 burn:  {n:'Burn',  chance:.30, dot:.20, dur:3000, col:'#E8834E'},
 poison:{n:'Poison',chance:.30, dot:.28, dur:4000, col:'#7CBE4A'},
 slow:  {n:'Slow',  chance:.35, slow:.45, dur:2500, col:'#7FD8F8'},
 leech: {n:'Leech', chance:1,   heal:.18, col:'#C45B7A'},
};
