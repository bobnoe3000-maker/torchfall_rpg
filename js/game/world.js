/* Dungeon: rooms+corridors, baked light, pathing, flowfield — from the prototype */
import {RI,R} from '../core/rng.js';
export const TW=32,TH=16,WH=30,WH_NEAR=7;
export const VOID=0,FLOOR=1,WALL=2;
export const W={mw:0,mh:0,tiles:null,rooms:[],torches:[],props:[],light:null,
  cFloor:null,cTop:null,cLeft:null,cRight:null,wallH:null,fKind:null,fog:null,
  flow:null,flowT:0};
const FLOORR=['#0A0910','#151220','#221D2A','#32262B','#45352F','#5B4638','#745A44','#8D7154'];
const WALLT =['#0B0A12','#181422','#26202D','#382A33','#4C3A3A','#644B44','#7E6250','#9C7B60'];
const WALLL =['#06050B','#100D17','#191521','#251C26','#332728','#43332e','#584737','#6E5943'];
const WALLR2=['#080810','#141020','#1F1927','#2D212D','#3E2F31','#523E37','#6A5143','#846A51'];
const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]].map(r=>r.map(v=>v/16));
function band(v,x,y,ramp){const lv=v*(ramp.length-1);let i=Math.floor(lv);
  if(lv-i>BAYER[((y|0)%4+4)%4][((x|0)%4+4)%4])i++;
  return ramp[Math.max(0,Math.min(ramp.length-1,i))];}
export const idx=(x,y)=>y*W.mw+x;
export const inB=(x,y)=>x>=0&&y>=0&&x<W.mw&&y<W.mh;
export const tileAt=(x,y)=>inB(x|0,y|0)?W.tiles[idx(x|0,y|0)]:VOID;
export const solid=(x,y)=>tileAt(x,y)!==FLOOR;

export function genDungeon(rng){
  W.mw=48;W.mh=48;
  W.tiles=new Uint8Array(W.mw*W.mh);
  W.rooms=[];W.torches=[];W.props=[];
  for(let t=0;t<140&&W.rooms.length<10;t++){
    const w=RI(rng,6,10),h=RI(rng,6,10),x=RI(rng,2,W.mw-w-3),y=RI(rng,2,W.mh-h-3);
    if(W.rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;
    W.rooms.push({x,y,w,h,cx:(x+w/2)|0,cy:(y+h/2)|0});
  }
  for(const r of W.rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)W.tiles[idx(x,y)]=FLOOR;
  for(let i=1;i<W.rooms.length;i++){
    const a=W.rooms[i-1],b=W.rooms[i],wd=rng()<.4?2:1;
    for(let x=Math.min(a.cx,b.cx);x<=Math.max(a.cx,b.cx);x++)for(let k=0;k<wd;k++)if(inB(x,a.cy+k))W.tiles[idx(x,a.cy+k)]=FLOOR;
    for(let y=Math.min(a.cy,b.cy);y<=Math.max(a.cy,b.cy);y++)for(let k=0;k<wd;k++)if(inB(b.cx+k,y))W.tiles[idx(b.cx+k,y)]=FLOOR;
  }
  for(let y=0;y<W.mh;y++)for(let x=0;x<W.mw;x++){
    if(W.tiles[idx(x,y)]!==VOID)continue;
    let n=false;
    for(let dy=-1;dy<=1&&!n;dy++)for(let dx=-1;dx<=1;dx++)
      if(inB(x+dx,y+dy)&&W.tiles[idx(x+dx,y+dy)]===FLOOR){n=true;break;}
    if(n)W.tiles[idx(x,y)]=WALL;
  }
  for(let y=1;y<W.mh-1;y++)for(let x=1;x<W.mw-1;x++){
    if(W.tiles[idx(x,y)]!==WALL)continue;
    if(W.tiles[idx(x,y+1)]!==FLOOR&&W.tiles[idx(x+1,y)]!==FLOOR)continue;
    if(rng()<.11)W.torches.push({x:x+.5,y:y+.5,ph:R(rng,0,6.3)});
  }
  for(const r of W.rooms)for(let i=0;i<RI(rng,2,5);i++){
    const x=RI(rng,r.x,r.x+r.w-1),y=RI(rng,r.y,r.y+r.h-1);
    if(solid(x,y))continue;
    const k=['urn','crate','bones','rubble','pillar','brazier','statue'][RI(rng,0,6)];
    W.props.push({x:x+.5,y:y+.5,k});
    if(k==='brazier')W.torches.push({x:x+.5,y:y+.5,ph:R(rng,0,6.3)});
  }
  bake(rng);
  W.fog=new Uint8Array(W.mw*W.mh);
  W.flow=null;W.flowT=0;
}
function bake(rng){
  const n=W.mw*W.mh;
  W.light=new Float32Array(n);
  for(const t of W.torches){
    const r=6.5;
    for(let y=Math.max(0,(t.y-r)|0);y<=Math.min(W.mh-1,(t.y+r)|0);y++)
    for(let x=Math.max(0,(t.x-r)|0);x<=Math.min(W.mw-1,(t.x+r)|0);x++){
      const d=Math.hypot(x+.5-t.x,y+.5-t.y);
      if(d<r)W.light[idx(x,y)]+=(1-d/r)*.85;
    }
  }
  for(let i=0;i<n;i++)W.light[i]=Math.min(1,W.light[i]);
  W.cFloor=new Array(n);W.cTop=new Array(n);W.cLeft=new Array(n);W.cRight=new Array(n);
  W.wallH=new Uint8Array(n);W.fKind=new Uint8Array(n);
  for(let y=0;y<W.mh;y++)for(let x=0;x<W.mw;x++){
    const i=idx(x,y),l=W.light[i],t=W.tiles[i];
    if(t===FLOOR){
      W.cFloor[i]=band(l,x,y,FLOORR);
      const q=rng();
      W.fKind[i]=q<.07?1:q<.14?2:q<.21?3:q<.27?4:q<.32?5:0;
      continue;
    }
    if(t!==WALL)continue;
    W.cTop[i]=band(Math.min(1,l*1.12),x,y,WALLT);
    W.cLeft[i]=band(l*.66,x,y,WALLL);
    W.cRight[i]=band(l*.88,x,y,WALLR2);
    W.wallH[i]=(tileAt(x-1,y)===FLOOR||tileAt(x,y-1)===FLOOR)?WH_NEAR:WH;
  }
}
export function lightAt(x,y,lanterns){
  const b=inB(x|0,y|0)?W.light[idx(x|0,y|0)]:0;
  let l=0;
  for(const u of lanterns){
    const v=Math.max(0,1-Math.hypot(x-u.x,y-u.y)/4.2)*.55;
    if(v>l)l=v;
  }
  return Math.min(1,b+l);
}
export function los(x0,y0,x1,y1){
  const d=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(d/.3));
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    if(solid(x0+(x1-x0)*t,y0+(y1-y0)*t))return false;
  }
  return true;
}
export function astar(sx,sy,tx,ty){
  if(solid(tx+.5,ty+.5))return null;
  const open=[[sx,sy]],came=new Map(),gs=new Map(),fs=new Map();
  const K=(x,y)=>y*W.mw+x;
  gs.set(K(sx,sy),0);fs.set(K(sx,sy),Math.abs(tx-sx)+Math.abs(ty-sy));
  let guard=0;
  while(open.length&&guard++<600){
    let bi=0;
    for(let i=1;i<open.length;i++)
      if((fs.get(K(open[i][0],open[i][1]))||1e9)<(fs.get(K(open[bi][0],open[bi][1]))||1e9))bi=i;
    const [cx,cy]=open.splice(bi,1)[0];
    if(cx===tx&&cy===ty){
      const path=[[cx,cy]];let k=K(cx,cy);
      while(came.has(k)){const p=came.get(k);path.unshift(p);k=K(p[0],p[1]);}
      path.shift();return path;
    }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=cx+dx,ny=cy+dy;
      if(!inB(nx,ny)||W.tiles[idx(nx,ny)]!==FLOOR)continue;
      const ng=(gs.get(K(cx,cy))||0)+1,nk=K(nx,ny);
      if(ng<(gs.get(nk)??1e9)){
        came.set(nk,[cx,cy]);gs.set(nk,ng);
        fs.set(nk,ng+Math.abs(tx-nx)+Math.abs(ty-ny));
        if(!open.some(o=>o[0]===nx&&o[1]===ny))open.push([nx,ny]);
      }
    }
  }
  return null;
}
export function buildFlow(sources){
  const n=W.mw*W.mh;
  if(!W.flow||W.flow.length!==n)W.flow=new Int16Array(n);
  W.flow.fill(-1);
  const q=[];
  for(const u of sources){
    const i=idx(u.x|0,u.y|0);
    if(W.tiles[i]===FLOOR&&W.flow[i]<0){W.flow[i]=0;q.push([u.x|0,u.y|0]);}
  }
  let head=0;
  while(head<q.length){
    const [x,y]=q[head++],d=W.flow[idx(x,y)];
    if(d>=24)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(!inB(nx,ny))continue;
      const i=idx(nx,ny);
      if(W.tiles[i]!==FLOOR||W.flow[i]>=0)continue;
      W.flow[i]=d+1;q.push([nx,ny]);
    }
  }
}
export function revealFog(units){
  if(!W.fog)return;
  for(const u of units){
    const ux=u.x|0,uy=u.y|0;
    for(let y=Math.max(0,uy-5);y<=Math.min(W.mh-1,uy+5);y++)
    for(let x=Math.max(0,ux-5);x<=Math.min(W.mw-1,ux+5);x++)
      if(Math.hypot(x+.5-u.x,y+.5-u.y)<4.4)W.fog[idx(x,y)]=1;
  }
}
