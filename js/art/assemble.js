/* Socket assembly + articulation — ported from the Character Forge.
   assemble(recipe,pal,anim,phase) → canvas. Frames cached per look. */
import {HEADS,TORSOS,ARMS,LEGS,WEAPONS,OFFHANDS} from './parts.js';

export const BOX={w:42,h:44};
const TORSO_AT=[9,15];
const NECK=[TORSO_AT[0]+8,TORSO_AT[1]];
const SH_L=[TORSO_AT[0]+2,TORSO_AT[1]+3];
const SH_R=[TORSO_AT[0]+13,TORSO_AT[1]+3];
const HIP_L=[TORSO_AT[0]+5,TORSO_AT[1]+12];
const HIP_R=[TORSO_AT[0]+10,TORSO_AT[1]+12];
const HEAD_REG=[7,13], ARM_PIV=[2,1], LEG_PIV=[3,0];

function bakePart(def,pal,mirror){
  const rows=def.g,h=rows.length,w=rows[0].length;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const ch=rows[y][mirror?w-1-x:x];
    if(!ch||ch==='.')continue;
    g.fillStyle=pal[ch]||'#f0f';g.fillRect(x,y,1,1);
  }
  return c;
}
function darken(c,f){
  const r=document.createElement('canvas');r.width=c.width;r.height=c.height;
  const g=r.getContext('2d');g.drawImage(c,0,0);
  g.globalCompositeOperation='source-atop';
  g.fillStyle='rgba(8,6,14,'+f+')';g.fillRect(0,0,c.width,c.height);
  return r;
}
function rotCW(c){const r=document.createElement('canvas');r.width=c.height;r.height=c.width;
  const g=r.getContext('2d');g.translate(c.height,0);g.rotate(Math.PI/2);
  g.imageSmoothingEnabled=false;g.drawImage(c,0,0);
  return {c:r,map:(x,y)=>[c.height-1-y,x]};}
function rotCCW(c){const r=document.createElement('canvas');r.width=c.height;r.height=c.width;
  const g=r.getContext('2d');g.translate(0,c.width);g.rotate(-Math.PI/2);
  g.imageSmoothingEnabled=false;g.drawImage(c,0,0);
  return {c:r,map:(x,y)=>[y,c.width-1-x]};}
function rot180(c){const r=document.createElement('canvas');r.width=c.width;r.height=c.height;
  const g=r.getContext('2d');g.translate(c.width,c.height);g.rotate(Math.PI);
  g.imageSmoothingEnabled=false;g.drawImage(c,0,0);
  return {c:r,map:(x,y)=>[c.width-1-x,c.height-1-y]};}
const noRot=c=>({c,map:(x,y)=>[x,y]});

/* anim: idle(2ph) walk(4ph) attack(4ph, kind from weapon) dead(1) */
export function assemble(recipe,pal,anim,ph){
  const wp=WEAPONS[recipe.weapon||0], kind=wp&&wp.g?wp.kind:'punch';
  let dLL=[0,0],dLR=[0,0],dAL=[0,0],dAR=[0,0],dB=[0,0],pose='rest',fx=null;
  if(anim==='walk'){
    if(ph===1){dLL=[1,-1];dLR=[-1,0];dAL=[1,0];dAR=[-1,0];}
    if(ph===3){dLR=[1,-1];dLL=[-1,0];dAR=[1,0];dAL=[-1,0];}
  } else if(anim==='idle'){ if(ph===1)dB=[0,1];
  } else if(anim==='attack'){
    if(kind==='swing'){ if(ph===1){pose='back';dB=[-1,0];}
      if(ph===2){pose='fwd';dB=[2,0];} if(ph===3)dB=[1,0]; }
    else if(kind==='raise'){ if(ph===1){dAR=[0,-1];dB=[0,-1];}
      if(ph>=2){pose='up';fx=ph===2?'flare':'flare2';} }
    else if(kind==='bow'){ if(ph===1)dAR=[1,-1];
      if(ph===2){fx='arrow1';dB=[-1,0];} if(ph===3)fx='arrow2'; }
    else { if(ph===1){dAR=[-1,-1];dB=[-1,0];} if(ph===2){pose='fwd';dB=[2,0];} }
  }
  const c=document.createElement('canvas');c.width=BOX.w;c.height=BOX.h;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const bx=dB[0],by=dB[1];
  if(anim==='dead'){ // corpse: torso+head laid flat via rot90
    const torso=rotCW(bakePart(TORSOS[recipe.torso],pal,false)).c;
    const head=rotCW(bakePart(HEADS[recipe.head],pal,false)).c;
    g.globalAlpha=.85;
    g.drawImage(torso,10,BOX.h-torso.height-2);
    g.drawImage(head,10+torso.width-4,BOX.h-head.height-1);
    g.globalAlpha=1;
    return c;
  }
  const armDefL=ARMS[recipe.armL], armLb=darken(bakePart(armDefL,pal,true),.32);
  const handL=[armDefL.g[0].length-1-armDefL.hand[0],armDefL.hand[1]];
  const alx=SH_L[0]-(armLb.width-1-ARM_PIV[0])+dAL[0]+bx;
  const aly=SH_L[1]-ARM_PIV[1]+dAL[1]+by;
  g.drawImage(armLb,alx,aly);
  const oh=OFFHANDS[recipe.offhand||0];
  if(oh&&oh.g){
    const ohc=darken(bakePart(oh,pal,true),.18);
    const hold=[ohc.width-1-oh.hold[0],oh.hold[1]];
    const ox=alx+handL[0]-hold[0],oy=aly+handL[1]-hold[1];
    g.drawImage(ohc,ox,oy);
    if(oh.n==='Torch'||oh.n==='Orb'||oh.n==='Lantern'){
      g.globalCompositeOperation='lighter';
      const col=oh.n==='Orb'?pal.x:'#E8A03C';
      const gl=g.createRadialGradient(ox+2,oy+2,0,ox+2,oy+2,9);
      gl.addColorStop(0,col+'55');gl.addColorStop(1,col+'00');
      g.fillStyle=gl;g.fillRect(ox-8,oy-8,20,20);
      g.globalCompositeOperation='source-over';
    }
  }
  const legLd=darken(bakePart(LEGS[recipe.legL],pal,true),.22);
  g.drawImage(legLd,HIP_L[0]-(legLd.width-1-LEG_PIV[0])+dLL[0]+bx,HIP_L[1]-LEG_PIV[1]+dLL[1]);
  g.drawImage(bakePart(LEGS[recipe.legR],pal,false),HIP_R[0]-LEG_PIV[0]+dLR[0]+bx,HIP_R[1]-LEG_PIV[1]+dLR[1]);
  g.drawImage(bakePart(TORSOS[recipe.torso],pal,false),TORSO_AT[0]+bx,TORSO_AT[1]+by);
  g.drawImage(bakePart(HEADS[recipe.head],pal,false),NECK[0]-HEAD_REG[0]-1+bx,NECK[1]-HEAD_REG[1]-1+by);
  const armDef=ARMS[recipe.armR], armBase=bakePart(armDef,pal,false);
  const rot=pose==='fwd'?rotCCW(armBase):pose==='back'?rotCW(armBase)
    :pose==='up'?rot180(armBase):noRot(armBase);
  const piv=rot.map(ARM_PIV[0],ARM_PIV[1]);
  const arx=SH_R[0]-piv[0]+dAR[0]+bx,ary=SH_R[1]-piv[1]+dAR[1]+by;
  g.drawImage(rot.c,arx,ary);
  const hnd=rot.map(armDef.hand[0],armDef.hand[1]);
  const hx=arx+hnd[0],hy=ary+hnd[1];
  if(wp&&wp.g){
    const wBase=bakePart(wp,pal,false);
    const wrot=pose==='fwd'?rotCW(wBase):pose==='back'?rotCCW(wBase):noRot(wBase);
    const grp=wrot.map(wp.grip[0],wp.grip[1]);
    const wx=hx-grp[0],wy=hy-grp[1];
    g.drawImage(wrot.c,wx,wy);
    if(fx&&fx.startsWith('flare')){
      g.globalCompositeOperation='lighter';
      const tx=wx+wrot.c.width/2,ty=wy+1;
      const gl=g.createRadialGradient(tx,ty,0,tx,ty,fx==='flare'?10:6);
      gl.addColorStop(0,pal.X+'AA');gl.addColorStop(1,pal.x+'00');
      g.fillStyle=gl;g.fillRect(tx-12,ty-12,24,24);
      g.fillStyle=pal.X;g.fillRect(tx-1,ty-2,2,2);
      g.globalCompositeOperation='source-over';
    }
  }
  if(fx&&fx.startsWith('arrow')){
    const ax=hx+(fx==='arrow1'?6:14),ay=hy-2;
    g.globalAlpha=fx==='arrow1'?1:.55;
    g.fillStyle=pal.w;g.fillRect(ax,ay,5,1);
    g.fillStyle=pal.W;g.fillRect(ax+5,ay,2,1);
    g.globalAlpha=1;
  }
  return c;
}

/* frame cache: unit.lookKey → {animKey → canvas}; L-facing via flipped blit */
const cache=new Map();
export function lookKey(recipe,pal){
  return JSON.stringify(recipe)+'|'+pal.s+pal[1]+pal[5]+pal.q+pal.x;
}
export function getFrame(recipe,pal,anim,ph,face){
  const k=lookKey(recipe,pal)+'|'+anim+ph+(face>0?'R':'L');
  let f=cache.get(k);
  if(!f){
    const base=assemble(recipe,pal,anim,ph);
    if(face<0){
      f=document.createElement('canvas');f.width=base.width;f.height=base.height;
      const g=f.getContext('2d');g.translate(base.width,0);g.scale(-1,1);
      g.imageSmoothingEnabled=false;g.drawImage(base,0,0);
    } else f=base;
    if(cache.size>900)cache.clear();
    cache.set(k,f);
  }
  return f;
}
