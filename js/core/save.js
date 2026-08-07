/* Guarded persistence — localStorage on real deploys, silent no-op if sandboxed */
const KEY='torchfall-save-v1';
function store(){ try{ return window.localStorage; }catch(e){ return null; } }
export function saveGame(state){
  const s=store(); if(!s) return false;
  try{ s.setItem(KEY,JSON.stringify(state)); return true; }catch(e){ return false; }
}
export function loadGame(){
  const s=store(); if(!s) return null;
  try{ const v=s.getItem(KEY); return v?JSON.parse(v):null; }catch(e){ return null; }
}
export function wipeSave(){
  const s=store(); if(!s) return;
  try{ s.removeItem(KEY); }catch(e){}
}
