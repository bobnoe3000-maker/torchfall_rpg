/* Tiny event bus — UI listens, game emits; multiplayer later swaps the emitter */
const handlers={};
export function on(ev,fn){ (handlers[ev]=handlers[ev]||[]).push(fn); }
export function emit(ev,data){ (handlers[ev]||[]).forEach(fn=>fn(data)); }
