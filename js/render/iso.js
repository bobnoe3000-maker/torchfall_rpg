/* Iso renderer — condensed from the prototype: banded floors, coursed walls,
   torch flicker, props, units via the Forge assembler, minimap fog. */
import {W,TW,TH,tileAt,idx,inB,FLOOR,WALL} from '../game/world.js';
import {D} from '../game/combat.js';
import {S} from '../game/state.js';
import {getFrame,BOX} from '../art/assemble.js';
import {BAL} from '../config/balance.js';

let cv,g,VW=320,VH=256;
export function bindCanvas(canvas){
  cv=canvas;g=cv.getContext('2d');
  fitCanvas();window.addEventListener('resize',fitCanvas);
}
export function fitCanvas(){
  if(!cv)return;
  const wrap=cv.parentElement||cv;
  const cssW=wrap.clientWidth||cv.getBoundingClientRect().width||360;
  const cssH=wrap.clientHeight||Math.round(cssW*1.02);
  const dpr=window.devicePixelRatio||1;
  const k=Math.max(1,Math.round(dpr*cssW/330));
  VW=Math.max(240,Math.floor(cssW*dpr/k));
  VH=Math.max(200,Math.floor(cssH*dpr/k));
  cv.width=VW;cv.height=VH;
  cv.style.width='100%';cv.style.height=cssH+'px';
  g.imageSmoothingEnabled=false;
}
/* pinch/scroll zoom — the whole world is drawn under a scale transform, so scr()
   stays in base space and only unscr() (screen→world) unwinds the zoom. */
let Z=1; export const ZMIN=0.62, ZMAX=2.6;
export const getZoom=()=>Z;
export function setZoom(z){Z=Math.max(ZMIN,Math.min(ZMAX,z));}
export const scr=(x,y)=>[(x-D.cam.x)*(TW/2)-(y-D.cam.y)*(TW/2)+VW/2,
  (x-D.cam.x)*(TH/2)+(y-D.cam.y)*(TH/2)+VH*0.42];
export function unscr(px,py){
  const ox=(px-VW/2)/Z,oy=(py-VH*0.42)/Z;
  return [D.cam.x+(ox/(TW/2)+oy/(TH/2))/2, D.cam.y+(oy/(TH/2)-ox/(TW/2))/2];
}
export function canvasPoint(e){
  const r=cv.getBoundingClientRect();
  const px=(e.clientX-r.left)*VW/r.width,py=(e.clientY-r.top)*VH/r.height;
  return unscr(px,py);
}
function flick(t,ph){return .82+.18*Math.sin(t/95+ph)+.07*Math.sin(t/41+ph*2.7);}
export function render(t){
  if(!cv)return;
  g.fillStyle='#050409';g.fillRect(0,0,VW,VH);
  g.save();
  g.translate(VW/2,VH*0.42);g.scale(Z,Z);g.translate(-VW/2,-VH*0.42);
  const cxi=D.cam.x|0,cyi=D.cam.y|0,RAD=Math.ceil(VW/(TW*Z))+8;
  const MX=(VW/2)/Z+TW, MY=(VH*0.6)/Z+72;
  const lanterns=D.units.filter(u=>u.alive&&u.side==='party');
  for(let s=-RAD;s<=RAD;s++)for(let d2=-RAD;d2<=RAD;d2++){
    const x=cxi+s,y=cyi+d2;
    if(!inB(x,y))continue;
    const i=idx(x,y),tl=W.tiles[i];
    if(!tl)continue;
    const [sx,sy]=scr(x,y);
    if(sx<VW/2-MX||sx>VW/2+MX||sy<VH*0.42-MY||sy>VH*0.42+MY)continue;
    if(tl===FLOOR){
      g.fillStyle=W.cFloor[i];
      g.beginPath();
      g.moveTo(sx,sy);g.lineTo(sx+TW/2,sy+TH/2);g.lineTo(sx,sy+TH);g.lineTo(sx-TW/2,sy+TH/2);
      g.closePath();g.fill();
      const fk=W.fKind[i];
      if(fk){
        g.fillStyle='rgba(0,0,0,.18)';
        if(fk===1)g.fillRect(sx-4,sy+6,8,1);
        if(fk===2)g.fillRect(sx-1,sy+4,2,2);
        if(fk===3){g.fillRect(sx-6,sy+8,3,1);g.fillRect(sx+3,sy+5,2,1);}
        if(fk===4){g.fillStyle='rgba(255,240,200,.05)';g.fillRect(sx-2,sy+5,4,2);}
        if(fk===5)g.fillRect(sx+1,sy+9,3,1);
      }
    } else if(tl===WALL){
      const h=W.wallH[i];
      g.fillStyle=W.cLeft[i];
      g.beginPath();g.moveTo(sx-TW/2,sy+TH/2-h);g.lineTo(sx,sy+TH-h);g.lineTo(sx,sy+TH);g.lineTo(sx-TW/2,sy+TH/2);g.closePath();g.fill();
      g.fillStyle=W.cRight[i];
      g.beginPath();g.moveTo(sx+TW/2,sy+TH/2-h);g.lineTo(sx,sy+TH-h);g.lineTo(sx,sy+TH);g.lineTo(sx+TW/2,sy+TH/2);g.closePath();g.fill();
      g.fillStyle='rgba(0,0,0,.30)';
      for(let cy2=sy+TH-h+3;cy2<sy+TH-2;cy2+=4){g.fillRect(sx-TW/2+2,cy2,TW/2-3,1);g.fillRect(sx+1,cy2+2,TW/2-3,1);}
      g.fillStyle=W.cTop[i];
      g.beginPath();g.moveTo(sx,sy-h);g.lineTo(sx+TW/2,sy+TH/2-h);g.lineTo(sx,sy+TH-h);g.lineTo(sx-TW/2,sy+TH/2-h);g.closePath();g.fill();
    }
  }
  /* queue: torches, props, loot, units — painter sort */
  const Q=[];
  for(const to of W.torches){
    if(Math.abs(to.x-D.cam.x)>RAD||Math.abs(to.y-D.cam.y)>RAD)continue;
    Q.push({z:to.x+to.y,f:()=>{
      const [sx,sy]=scr(to.x,to.y),fl=flick(t,to.ph);
      g.fillStyle='#3E2C1B';g.fillRect(sx-1,sy-13,2,9);
      g.fillStyle='#C4552B';g.fillRect(sx-2,sy-16,4,4);
      g.fillStyle='#E8A03C';g.fillRect(sx-1,sy-17+(fl>1?-1:0),2,3);
      g.fillStyle='#FFE6A0';g.fillRect(sx-1,sy-18+(fl>1?-1:0),1,1);
      g.globalCompositeOperation='lighter';
      const gr=g.createRadialGradient(sx,sy-14,0,sx,sy-14,26*fl);
      gr.addColorStop(0,'rgba(232,150,60,.28)');gr.addColorStop(1,'rgba(232,150,60,0)');
      g.fillStyle=gr;g.fillRect(sx-30,sy-44,60,60);
      g.globalCompositeOperation='source-over';
    }});
  }
  for(const p of W.props){
    if(Math.abs(p.x-D.cam.x)>RAD||Math.abs(p.y-D.cam.y)>RAD)continue;
    Q.push({z:p.x+p.y,f:()=>{
      const [sx,sy]=scr(p.x,p.y);
      g.fillStyle='rgba(0,0,0,.35)';g.fillRect(sx-4,sy-1,8,2);
      if(p.k==='urn'){g.fillStyle='#4A3A30';g.fillRect(sx-3,sy-8,6,8);g.fillStyle='#6A5340';g.fillRect(sx-2,sy-9,4,2);}
      else if(p.k==='crate'){g.fillStyle='#4C3A26';g.fillRect(sx-5,sy-9,10,9);g.fillStyle='#2E2214';g.fillRect(sx-5,sy-5,10,1);}
      else if(p.k==='bones'){g.fillStyle='#CFC7B0';g.fillRect(sx-4,sy-2,3,1);g.fillRect(sx+1,sy-3,4,1);g.fillRect(sx-1,sy-4,2,2);}
      else if(p.k==='rubble'){g.fillStyle='#3E3A44';g.fillRect(sx-4,sy-3,4,3);g.fillRect(sx+1,sy-2,3,2);}
      else if(p.k==='pillar'){g.fillStyle='#2E2A36';g.fillRect(sx-3,sy-22,6,22);g.fillStyle='#413A4A';g.fillRect(sx-3,sy-22,2,22);g.fillStyle='#4A4254';g.fillRect(sx-4,sy-24,8,3);}
      else if(p.k==='brazier'){g.fillStyle='#3A3440';g.fillRect(sx-3,sy-5,6,5);g.fillStyle='#C4552B';g.fillRect(sx-2,sy-8,4,3);g.fillStyle='#FFE6A0';g.fillRect(sx-1,sy-9,2,2);}
      else if(p.k==='statue'){g.fillStyle='#332E3E';g.fillRect(sx-3,sy-16,6,16);g.fillStyle='#443C50';g.fillRect(sx-2,sy-19,4,4);}
    }});
  }
  for(const p of D.loot){
    Q.push({z:p.x+p.y,f:()=>{
      const [sx,sy]=scr(p.x,p.y),bob=Math.sin(t/280+p.ph)*1.5;
      g.fillStyle='rgba(0,0,0,.3)';g.fillRect(sx-3,sy,6,2);
      if(p.kind==='silver'){g.fillStyle='#C9CDD6';g.fillRect(sx-2,sy-4+bob,4,3);g.fillStyle='#EFF2F8';g.fillRect(sx-1,sy-4+bob,2,1);}
      else{g.fillStyle='#C9A24A';g.fillRect(sx-3,sy-6+bob,6,5);g.fillStyle='#FFE6A0';g.fillRect(sx-2,sy-5+bob,2,1);
        g.globalCompositeOperation='lighter';
        const gr=g.createRadialGradient(sx,sy-3,0,sx,sy-3,10);
        gr.addColorStop(0,'rgba(255,220,120,.25)');gr.addColorStop(1,'rgba(255,220,120,0)');
        g.fillStyle=gr;g.fillRect(sx-12,sy-15,24,24);g.globalCompositeOperation='source-over';}
    }});
  }
  for(const u of D.units){
    if(Math.abs(u.x-D.cam.x)>RAD||Math.abs(u.y-D.cam.y)>RAD)continue;
    Q.push({z:u.x+u.y+(u.alive?0:-.4),f:()=>drawUnit(u,t)});
  }
  Q.sort((a,b)=>a.z-b.z);
  for(const q of Q)q.f();
  /* fx */
  for(const f of D.fx){
    if(f.t==='spark'){
      const [sx,sy]=scr(f.x,f.y);
      g.globalAlpha=Math.max(0,f.life/f.max);
      g.fillStyle=f.col;g.fillRect(sx-1,sy-6,2,2);g.globalAlpha=1;
    } else if(f.t==='bolt'){
      for(let i=0;i<f.trail.length;i++){
        const [tx,ty]=scr(f.trail[i][0],f.trail[i][1]);
        g.globalAlpha=.16*(i+1);g.fillStyle=f.col;g.fillRect(tx-1,ty-1,2,2);
      }
      g.globalAlpha=1;
      const [sx,sy]=scr(f.x,f.y);
      g.fillStyle='#FFFFFF';g.fillRect(sx-1,sy-1,2,2);
      g.fillStyle=f.col;g.fillRect(sx-2,sy-2,4,4);
      g.globalAlpha=.5;g.fillRect(sx-3,sy-3,6,6);g.globalAlpha=1;
    }
  }
  /* floaters */
  g.font='7px monospace';g.textAlign='center';
  for(const f of D.floaters){
    const [sx,sy]=scr(f.x,f.y);
    g.globalAlpha=Math.min(1,f.life/500);
    g.fillStyle='#000';g.fillText(f.txt,sx+1,sy-30-(850-f.life)/40+1);
    g.fillStyle=f.col;g.fillText(f.txt,sx,sy-30-(850-f.life)/40);
  }
  g.globalAlpha=1;g.textAlign='left';
  /* rally flag */
  if(D.rally){
    const [sx,sy]=scr(D.rally.x,D.rally.y);
    const ph=(t/400)%1;
    g.strokeStyle='rgba(95,224,240,'+(0.8-ph*0.6)+')';
    g.beginPath();g.ellipse(sx,sy+4,8+ph*8,4+ph*4,0,0,6.29);g.stroke();
    g.fillStyle='#5FE0F0';g.fillRect(sx-1,sy-8,2,10);
  }
  g.restore();
  /* vignette */
  const vg=g.createRadialGradient(VW/2,VH*.44,VH*.30,VW/2,VH*.44,VH*.78);
  vg.addColorStop(0,'rgba(5,3,8,0)');vg.addColorStop(1,'rgba(5,3,8,.88)');
  g.fillStyle=vg;g.fillRect(0,0,VW,VH);
  drawMini();
}
function drawUnit(u,t){
  const [sx,sy]=scr(u.x,u.y);
  const c=u.char;
  let anim='idle',ph=Math.floor(t/520)%2;
  if(!u.alive){anim='dead';ph=0;}
  else if(u.castLock>0){anim='attack';ph=Math.min(3,Math.floor((560-u.castLock)/150));}
  else if(u.walking){anim='walk';ph=Math.floor(t/190)%4;}
  const fr=getFrame(c.recipe,c.pal,anim,ph,u.face);
  const k=c.boss?BAL.bossScale:1;                     // bosses are drawn big
  let cf=1,sink=0;
  if(!u.alive){cf=u.deadT!==undefined?Math.max(0,Math.min(1,u.deadT/BAL.corpseMs)):1;sink=(1-cf)*3;}
  g.globalAlpha=cf;
  g.fillStyle='rgba(0,0,0,.4)';
  g.beginPath();g.ellipse(sx,sy+2,8*cf*k,3*cf*k,0,0,6.29);g.fill();
  if(c.boss&&u.alive){                                 // menacing under-glow
    g.globalCompositeOperation='lighter';
    const gr=g.createRadialGradient(sx,sy-8*k,0,sx,sy-8*k,20*k);
    gr.addColorStop(0,'rgba(200,60,40,.22)');gr.addColorStop(1,'rgba(200,60,40,0)');
    g.fillStyle=gr;g.fillRect(sx-24*k,sy-30*k,48*k,44*k);g.globalCompositeOperation='source-over';
  }
  const dw=fr.width*k,dh=fr.height*k;
  const dx=sx-dw/2,dy=sy+6-dh+sink;
  if(u.flash>0){
    g.globalCompositeOperation='lighter';g.globalAlpha=.7;
    g.drawImage(fr,dx,dy,dw,dh);g.globalAlpha=cf;g.globalCompositeOperation='source-over';
  }
  g.drawImage(fr,dx,dy,dw,dh);
  g.globalAlpha=1;
  if(u.alive){
    const mh=c.stats?c.stats.hp:c.maxhp, frac=Math.max(0,u.hp/mh);
    const bw=c.boss?28:16;
    g.fillStyle='rgba(0,0,0,.6)';g.fillRect(sx-bw/2,dy-3,bw,c.boss?3:2);
    g.fillStyle=u.side==='party'?'#5FBE6A':(c.boss?'#E8402A':'#C4552B');
    g.fillRect(sx-bw/2,dy-3,Math.round(bw*frac),c.boss?3:2);
    for(const p of u.procsOn){
      g.fillStyle={burn:'#E8834E',poison:'#7CBE4A',slow:'#7FD8F8'}[p.k]||'#fff';
      g.fillRect(sx-bw/2+(u.procsOn.indexOf(p)*4),dy-6,3,2);
    }
    if(c.boss){g.fillStyle='#E8402A';g.font='7px monospace';g.textAlign='center';g.fillText('☠ BOSS',sx,dy-7);g.textAlign='left';}
    if(c.isPlayer){g.fillStyle='#E8C46A';g.fillRect(sx-1,dy-8,2,2);}
  }
}
function drawMini(){
  const MS=Math.round(VW*0.24),px2=MS/W.mw;
  const mx=VW-MS-6,my=6;
  g.fillStyle='rgba(5,4,10,.82)';g.fillRect(mx-2,my-2,MS+4,MS+4);
  g.strokeStyle='#332a3e';g.strokeRect(mx-2.5,my-2.5,MS+5,MS+5);
  for(let y=0;y<W.mh;y++)for(let x=0;x<W.mw;x++){
    const i=idx(x,y);
    if(!W.fog[i]||!W.tiles[i])continue;
    g.fillStyle=W.tiles[i]===FLOOR?'#3A3040':'#191521';
    g.fillRect(mx+x*px2,my+y*px2,Math.ceil(px2),Math.ceil(px2));
  }
  for(const u of D.units){
    if(!u.alive)continue;
    if(u.side==='foe'&&!W.fog[idx(u.x|0,u.y|0)])continue;
    g.fillStyle=u.side==='party'?(u.char.isPlayer?'#E8C46A':'#5FE0F0'):'#C4552B';
    g.fillRect(mx+u.x*px2-1,my+u.y*px2-1,2.5,2.5);
  }
  /* tap-to-expand affordance */
  g.fillStyle='rgba(232,196,106,.9)';g.font='7px monospace';g.textAlign='right';
  g.fillText('⤢ MAP',mx+MS,my+MS+9);g.textAlign='left';
}
/* is a client-space point inside the on-canvas minimap? */
export function minimapHitClient(clientX,clientY){
  if(!cv)return false;
  const r=cv.getBoundingClientRect();
  const px=(clientX-r.left)*VW/r.width, py=(clientY-r.top)*VH/r.height;
  const MS=Math.round(VW*0.24), mx=VW-MS-6, my=6;
  return px>=mx-6&&px<=mx+MS+6&&py>=my-6&&py<=my+MS+12;
}
/* full explored-map render into an arbitrary canvas (the overlay sheet) */
export function renderFullMap(canvas){
  if(!canvas||!W.tiles)return;
  const cell=6,pad=6;
  canvas.width=W.mw*cell+pad*2;canvas.height=W.mh*cell+pad*2;
  const x2=canvas.getContext('2d');x2.imageSmoothingEnabled=false;
  x2.fillStyle='#07060d';x2.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<W.mh;y++)for(let x=0;x<W.mw;x++){
    const i=idx(x,y),t=W.tiles[i];if(!t)continue;
    const seen=W.fog&&W.fog[i];
    let col;
    if(!seen)col=t===FLOOR?'#100d18':'#0b0912';
    else if(t===FLOOR){const l=W.light?W.light[i]:.4;
      col='rgb('+(38+l*78|0)+','+(32+l*58|0)+','+(42+l*44|0)+')';}
    else col='#231b2e';
    x2.fillStyle=col;x2.fillRect(pad+x*cell,pad+y*cell,cell,cell);
  }
  if(W.torches)for(const to of W.torches){
    const i=idx(to.x|0,to.y|0);
    if(W.fog&&W.fog[i]){x2.fillStyle='#E8A03C';x2.fillRect(pad+(to.x*cell|0)-1,pad+(to.y*cell|0)-1,2,2);}
  }
  for(const u of D.units){
    if(!u.alive)continue;
    if(u.side==='foe'&&!(W.fog&&W.fog[idx(u.x|0,u.y|0)]))continue;
    x2.fillStyle=u.side==='party'?(u.char.isPlayer?'#E8C46A':'#5FE0F0'):'#C4552B';
    const s=u.side==='party'?5:3.5;
    x2.fillRect(pad+u.x*cell-s/2,pad+u.y*cell-s/2,s,s);
  }
}
