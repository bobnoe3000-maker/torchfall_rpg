# TORCHFALL — MVP

Portrait-first dungeon-delving autobattler. Static ES modules, no build step.
Deploy: drag this folder into Netlify (or `netlify deploy`). Open `index.html`
via any static server locally (`npx serve .`) — module imports require http(s).

## Loop
Create a character (5 archetypes) → hire up to 2 companions at the tavern →
descend. Autobattle with manual skill firing (3-button bar, cooldown sweeps),
AUTO/MANUAL movement toggle (tap the floor to rally/move), floor ▲▼ to choose
risk. Loot is generated (`Fiery Warblade of Doom (+2)`), equipment renders on
the paper-doll, merge identical items to +N with rising destruction risk.
Death: gear and inventory are lost, levels/skills and a little silver remain.
Companions die forever; the tavern refills.

## Architecture
```
js/
  core/    rng (seeded mulberry32), save (guarded localStorage), bus (events)
  config/  balance.js skills.js gear.js enemies.js   ← ALL tuning lives here
  art/     parts.js (40 modular body parts + 16 gear sprites, string grids)
           assemble.js (socket paper-doll, pose articulation, frame cache)
  game/    state.js stats.js loot.js world.js combat.js
  render/  iso.js (banded-light isometric renderer, integer device scaling)
  ui/      ui.js (screens, sheets, HUD)
  main.js  boot + rAF loop
```
- **Characters are recipes** — indices into the part library plus a palette.
  Players, companions, and enemies all assemble through the same socket
  contract; equipped gear swaps the visible parts.
- **Combat is cooldown-driven** with per-unit jitter, cast locks, procs
  (burn/poison/slow/leech), buffs, flowfield pursuit and A* pathing —
  attacks never land in lockstep.
- **Enemies are config**: `ENEMY_TYPES × ENEMY_PREFIXES × level scaling`.
  Add a row, get a monster.
- **Multiplayer groundwork**: seeded RNG, serializable state (everything in
  `S`/`D` is plain data), and a bus separating sim from UI. A server-authoritative
  version runs `combat.step` on the host and broadcasts `S`/unit deltas.

## Roadmap hooks (from design)
Arena/wave towers = alternate `startDelve` world-gens. Town services = new
screens over the same state. Chat = bus channel. App Store = wrap with Capacitor.
