/* Guarded persistence — localStorage on real deploys, silent no-op if sandboxed.
   Three save slots + a lightweight login session live under their own keys. */
const BASE='torchfall-save-v1';                 // legacy single-save key (migrated → slot 0)
const SESSION_KEY='torchfall-session-v1';
export const SLOT_COUNT=3;
let activeSlot=0;
function store(){ try{ return window.localStorage; }catch(e){ return null; } }
const slotKey=i=>BASE+'-slot'+i;

/* one-time: fold an old single-key save into slot 0 so returning players keep it */
(function migrate(){
  const s=store(); if(!s)return;
  try{
    const old=s.getItem(BASE);
    if(old&&!s.getItem(slotKey(0))){ s.setItem(slotKey(0),old); s.removeItem(BASE); }
  }catch(e){}
})();

export function setSlot(i){ activeSlot=Math.max(0,Math.min(SLOT_COUNT-1,i|0)); }
export function getSlot(){ return activeSlot; }

export function saveGame(state){
  const s=store(); if(!s) return false;
  try{ s.setItem(slotKey(activeSlot),JSON.stringify(state)); return true; }catch(e){ return false; }
}
export function loadGame(){ return loadSlot(activeSlot); }
export function loadSlot(i){
  const s=store(); if(!s) return null;
  try{ const v=s.getItem(slotKey(i)); return v?JSON.parse(v):null; }catch(e){ return null; }
}
export function wipeSave(){ wipeSlot(activeSlot); }
export function wipeSlot(i){
  const s=store(); if(!s) return;
  try{ s.removeItem(slotKey(i)); }catch(e){}
}

/* login session (email or guest) — cosmetic, device-local */
export function saveSession(info){
  const s=store(); if(!s) return false;
  try{ s.setItem(SESSION_KEY,JSON.stringify(info)); return true; }catch(e){ return false; }
}
export function loadSession(){
  const s=store(); if(!s) return null;
  try{ const v=s.getItem(SESSION_KEY); return v?JSON.parse(v):null; }catch(e){ return null; }
}
export function clearSession(){
  const s=store(); if(!s) return;
  try{ s.removeItem(SESSION_KEY); }catch(e){}
}
