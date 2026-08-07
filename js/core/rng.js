/* Seedable RNG (mulberry32) — deterministic sim groundwork for future multiplayer */
export function mulberry32(seed){
  let a=seed>>>0;
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
export const sysRng=mulberry32((Date.now()^0x9E3779B9)>>>0);
export const R=(rng,a,b)=>a+rng()*(b-a);
export const RI=(rng,a,b)=>Math.floor(R(rng,a,b+1));
export const pick=(rng,arr)=>arr[Math.floor(rng()*arr.length)];
