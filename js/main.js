import {S,restore} from './game/state.js';
import {D,step} from './game/combat.js';
import {bindCanvas,render} from './render/iso.js';
import {initCreate,buildTown,show,initCanvasInput,syncHud} from './ui/ui.js';

const cv=document.getElementById('cv');
bindCanvas(cv);
initCanvasInput(cv);
initCreate();
if(restore()&&S.player){buildTown();show('scr-town');}
else show('scr-create');

let last=performance.now(),hudT=0;
function loop(now){
  const dt=Math.min(50,now-last);last=now;
  if(S.screen==='scr-delve'){
    step(dt);
    render(now);
    hudT-=dt;
    if(hudT<=0){syncHud();hudT=120;}
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
