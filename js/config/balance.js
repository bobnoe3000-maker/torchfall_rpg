/* All tuning in one place */
export const BAL={
  xpCurve: lv=>40+lv*35,
  statPointsPerLevel: 3,
  hpBase: 90, hpPerVit: 0,           // hp comes from level+gear+COLOSSUS affix
  hpPerLevel: 10,
  playerBase:{patt:10,matt:10,pdef:4,mdef:4,dodge:3,crit:5,hp:120,spd:2.3},
  teamCap: 2,
  hireCostPerLevel: 25,
  startingSilver: 60,
  deathSilverKeep: 30,               // flat silver floor kept on death
  reviveSilverLoss: .5,              // lose half above the floor
  dropSilver: d=>6+d*4,
  dropItemChance: .30,
  depthHp: d=>1+(d-1)*.22,           // enemy scaling
  depthAtk: d=>1+(d-1)*.18,
  enemyLevel: d=>Math.max(1,Math.round(d*1.6-0.5)),
  mergeDestroyChance: plus=>Math.max(0,(plus-2)*0.15),  // +3 risks 15%, +4 30%...
  mergeStatMult: 1.32,
  attackCd:{swing:1250,bow:1750,raise:1850,punch:1150},
  attackRange:{swing:1.05,bow:4.2,raise:3.6,punch:.95},
  skillNpcCd: 6500,
  regenPerSec: .012,                 // out of combat, fraction of maxhp
  dodgeCap: 45, critCap: 60,
  corpseMs: 1100,                    // corpse crumbles then vanishes over this
  respawnMs: 4600,                   // dungeon trickles in a new foe this often
  enemyCap: d=>8+Math.floor(d*1.2),  // sustained live-foe population it refills toward
  respawnMinDist: 9.5,               // new foes appear at least this far from the party
  bossEveryN: 3,                     // a big boss guards every Nth floor
  bossHpMult: 6.5, bossAtkMult: 1.7, bossDefMult: 1.4,
  bossLevelBonus: 2, bossScale: 1.9, // render scale
};
