/* Ambient backdrop for the menu screens (splash / login / slots / home):
   a dark isometric hollow with torches, drifting embers and NPCs that wander
   the floor — the "living" background behind the front-end. One rAF loop draws
   to whichever canvas is currently attached; the sim keeps running between
   screen swaps so figures don't teleport. */
import {getFrame} from '../art/assemble.js';
import {randRecipe} from '../game/state.js';
import {rollPal} from '../art/parts.js';
import {ARCH_KEYS} from '../config/skills.js';
import {sysRng,RI,pick} from '../core/rng.js';

const TW=48, TH=24, HW=TW/2, HH=TH/2;   // tile footprint (CSS px)
const GW=11, GH=11;                      // walkable grid
const SCALE=1.9;                         // sprite pixel scale
const torches=[[1,1],[GW-2,1],[2,GH-2],[GW-3,GH-3],[(GW-1)/2,(GH-1)/2]];

let cur=null, g=null, cssW=360, cssH=640, dpr=1;
let npcs=null, embers=null, started=false, lastT=0;

function mkNpc(){
  const arch=pick(sysRng,ARCH_KEYS);
  const c={arch, recipe:randRecipe(sysRng,arch), pal:rollPal(sysRng)};
  const x=RI(sysRng,1,GW-2)+sysRng(), y=RI(sysRng,1,GH-2)+sysRng();
  return {c, x, y, tx:x, ty:y, face:1, pauseT:RI(sysRng,300,1600), walking:false, t0:sysRng()*1000};
}
function newTarget(n){
  n.tx=1+sysRng()*(GW-3); n.ty=1+sysRng()*(GH-3);
}
function ensure(){
  if(npcs)return;
  npcs=[]; for(let i=0;i<6;i++)npcs.push(mkNpc());
  embers=[]; for(let i=0;i<26;i++)embers.push({
    x:sysRng(), y:sysRng(), s:0.15+sysRng()*0.4, r:0.5+sysRng()*1.6,
    ph:sysRng()*6.28, dx:sysRng()*0.3-0.15});
}
/* tile → screen (CSS px) */
function iso(x,y){
  const ox=cssW/2, oy=cssH*0.30 - ((GW-1)+(GH-1))/2*HH*0.0;
  return [ (x-y)*HW + ox, (x+y)*HH + oy - 40 ];
}
export function ambientFit(){
  if(!cur)return;
  const r=cur.getBoundingClientRect();
  cssW=Math.max(240,r.width||cur.clientWidth||360);
  cssH=Math.max(360,r.height||cur.clientHeight||640);
  dpr=window.devicePixelRatio||1;
  cur.width=Math.round(cssW*dpr); cur.height=Math.round(cssH*dpr);
  g=cur.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);
  g.imageSmoothingEnabled=false;
}
export function ambientAttach(canvas){
  ensure();
  cur=canvas; ambientFit();
  if(!started){ started=true; requestAnimationFrame(loop); }
}
export function ambientDetach(){ cur=null; }
window.addEventListener('resize',()=>{ if(cur)ambientFit(); });

function flick(t,ph){ return 0.8+0.2*Math.sin(t/95+ph)+0.07*Math.sin(t/41+ph*2.7); }

function update(dt,t){
  for(const n of npcs){
    if(n.pauseT>0){ n.pauseT-=dt; n.walking=false; if(n.pauseT<=0)newTarget(n); continue; }
    const dx=n.tx-n.x, dy=n.ty-n.y, d=Math.hypot(dx,dy);
    if(d<0.08){ n.walking=false; n.pauseT=RI(sysRng,500,2600); continue; }
    n.walking=true;
    const sp=1.5*dt/1000, step=Math.min(d,sp);
    n.x+=dx/d*step; n.y+=dy/d*step;
    n.face=(dx-dy)>=0?1:-1;                     // screen-horizontal facing
  }
}
function drawFloor(t){
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const [sx,sy]=iso(x,y);
    const band=(x+y)&1;
    g.fillStyle=band?'#171320':'#1d1828';
    g.beginPath();
    g.moveTo(sx,sy); g.lineTo(sx+HW,sy+HH); g.lineTo(sx,sy+TH); g.lineTo(sx-HW,sy+HH);
    g.closePath(); g.fill();
    /* faint seams */
    g.strokeStyle='rgba(0,0,0,.25)'; g.lineWidth=1; g.stroke();
  }
}
function drawTorch(x,y,t){
  const [sx,sy]=iso(x,y), fl=flick(t,x*3+y);
  g.fillStyle='#3E2C1B'; g.fillRect(sx-1,sy-13,2,9);
  g.fillStyle='#C4552B'; g.fillRect(sx-2,sy-16,4,4);
  g.fillStyle='#E8A03C'; g.fillRect(sx-1,sy-17+(fl>1?-1:0),2,3);
  g.fillStyle='#FFE6A0'; g.fillRect(sx-1,sy-18+(fl>1?-1:0),1,1);
  g.globalCompositeOperation='lighter';
  const gr=g.createRadialGradient(sx,sy-14,0,sx,sy-14,30*fl);
  gr.addColorStop(0,'rgba(232,150,60,.30)'); gr.addColorStop(1,'rgba(232,150,60,0)');
  g.fillStyle=gr; g.fillRect(sx-36,sy-50,72,68);
  g.globalCompositeOperation='source-over';
}
function drawNpc(n,t){
  const [sx,sy]=iso(n.x,n.y);
  const anim=n.walking?'walk':'idle';
  const ph=n.walking?Math.floor((t+n.t0)/150)%4:Math.floor((t+n.t0)/560)%2;
  const fr=getFrame(n.c.recipe,n.c.pal,anim,ph,n.face);
  const dw=fr.width*SCALE, dh=fr.height*SCALE;
  g.fillStyle='rgba(0,0,0,.42)';
  g.beginPath(); g.ellipse(sx,sy+2,9,3.4,0,0,6.29); g.fill();
  g.drawImage(fr, sx-dw/2, sy+6-dh, dw, dh);
}
function drawEmbers(t){
  g.globalCompositeOperation='lighter';
  for(const e of embers){
    e.y-=e.s*0.0016*16; e.x+=e.dx*0.0004*16;
    if(e.y<-0.02){ e.y=1.04; e.x=sysRng(); }
    const a=(0.5+0.5*Math.sin(t/500+e.ph))*0.6;
    const px=e.x*cssW, py=e.y*cssH;
    g.fillStyle='rgba('+(e.r>1.1?'232,160,60':'196,85,43')+','+a+')';
    g.beginPath(); g.arc(px,py,e.r,0,6.28); g.fill();
  }
  g.globalCompositeOperation='source-over';
}
function draw(t){
  /* ground wash */
  g.clearRect(0,0,cssW,cssH);
  const bg=g.createLinearGradient(0,0,0,cssH);
  bg.addColorStop(0,'#0a0812'); bg.addColorStop(0.55,'#0d0a16'); bg.addColorStop(1,'#060409');
  g.fillStyle=bg; g.fillRect(0,0,cssW,cssH);
  drawFloor(t);
  /* painter-sorted: torches + npcs by depth (x+y) */
  const Q=[];
  for(const [tx,ty] of torches) Q.push({z:tx+ty-0.1, f:()=>drawTorch(tx,ty,t)});
  for(const n of npcs) Q.push({z:n.x+n.y, f:()=>drawNpc(n,t)});
  Q.sort((a,b)=>a.z-b.z);
  for(const q of Q) q.f();
  drawEmbers(t);
  /* vignette + torch-glow top wash */
  const vg=g.createRadialGradient(cssW/2,cssH*0.34,cssH*0.16,cssW/2,cssH*0.5,cssH*0.72);
  vg.addColorStop(0,'rgba(232,150,60,.05)'); vg.addColorStop(0.4,'rgba(6,4,10,0)');
  vg.addColorStop(1,'rgba(4,3,8,.92)');
  g.fillStyle=vg; g.fillRect(0,0,cssW,cssH);
}
function loop(now){
  const dt=Math.min(60, now-(lastT||now)); lastT=now;
  if(cur&&g){ update(dt,now); draw(now); }
  requestAnimationFrame(loop);
}
