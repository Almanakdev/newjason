# JASON SHOW — The Kiriko Vale Startup Story

*Write code. Make friends. Put a village back on the map.*

An interactive, browser-based social exploration experience set in a
Japanese-inspired virtual village. You play a programmer who quits the city
to found a startup in Kiriko Vale — a mountain village whose Signal Tower
went dark years ago. Nothing ships from a place the internet forgot, so your
first launch is the village itself: restore the tower, befriend the locals
and the Echo spirits living in the old signals, and build a place to belong.

Built with Vite, TypeScript, Three.js, Rapier 3D physics and a
multiplayer-ready architecture. Entirely original IP — all models, audio,
writing and shaders are generated in code (see `ASSET_LICENSES.md`).

The game's title, subtitle and global tuning live in **one file**:
`src/config/GameConfig.ts`.

---

## Installation

Requires Node.js 18+.

```bash
cd kindred-peaks
npm install
```

## Development

```bash
npm run dev        # dev server with HMR (URL printed in terminal)
npm run typecheck  # strict TypeScript check
npm run lint       # ESLint
npm run format     # Prettier
```

## Production build

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Controls

| Desktop | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse drag | Rotate camera (wheel = zoom) |
| Shift | Jog |
| Space | Jump |
| E | Interact / advance dialogue / place furniture |
| F | Use equipped tool (lantern, fishing rod) / recolor in build mode |
| Q | Emote wheel |
| Tab | Inventory |
| M | Map · J Quest journal |
| H | Housing build mode (at your plot) |
| R / G / X | Build mode: rotate / snap toggle / remove |
| Esc | Menu / close / cancel |

Mobile: virtual joystick (lower-left), swipe right half to look, context
buttons (interact, jump, emote, inventory). Gamepad: left stick move, right
stick look, A jump, X interact.

## Vertical slice walkthrough

Customize a Wayfarer → arrive at Sunrise Waystation → talk to **Mira Vale** at
the silent tower → gather 3 wild fiber on the east path → craft a **Lantern
Lens** at the pavilion → meet **Piproot** in Whispergrass Valley → recover 3
lost seeds → soothe Piproot → restore the **Waylight** → return to Mira.
Progress autosaves every 60 s (and via Esc → Save now); reload and Continue.

## Project structure

```
src/
  config/GameConfig.ts   game identity + tuning (edit me)
  core/                  Game loop, renderer, input, audio, save, events, perf
  physics/               Rapier wrapper (trimesh terrain + character controller)
  world/                 terrain, village & valley builders, day/night, weather, waylights
  shaders/               toon ramp + rim, sky dome, wind grass, water
  player/                character factory, procedural animator, controller, inventory
  camera/                third-person camera with collision
  characters/            NPCs, schedules, dialogue engine, friendship
  spirits/               Echo spirits (FSM behaviors, bonds)
  quests/                JSON-driven quest engine
  crafting/              items, resource nodes, gathering, recipes
  housing/               furniture catalog + placement/validation
  minigames/             fishing
  social/                emotes
  multiplayer/           network abstraction (mock + socket adapters, interpolation)
  ui/                    HUD, dialogue, panels, title, customization, mobile controls
  data/                  items, recipes, npcs, spirits, furniture, quests, dialogue (JSON)
server/                  Socket.IO room server skeleton
```

## Extending the game

**Replace placeholder models with GLB files.** Drop `.glb` (Draco/KTX2
supported) into `public/models/` and load via
`assets.loadModel('models/foo.glb')` — it returns `null` if missing so you can
keep the procedural fallback. Character rigs can swap `CharacterAnimator` for
`THREE.AnimationMixer` clips behind the same API.

**Add an item.** Append to `src/data/items.json`. Fields: id, name,
description, category (`resource|tool|food|gift|fish|special|furniture`),
icon, stack.

**Add a recipe.** Append to `src/data/recipes.json`; reference item ids.
It appears in the pavilion UI automatically under its category.

**Add an NPC.** Append to `src/data/npcs.json` (appearance indices, home,
schedule windows) and add a dialogue array under the same key in
`src/data/dialogue/dialogues.json`. Spawning, scheduling, name tag, talk
interactable and journal entry are automatic.

**Add a quest.** Append to `src/data/quests/side.json` (or a new file
imported in `QuestManager`). Objective types: `talk`, `gather`, `craft`,
`calmEcho`, `restoreWaylight`, `interact`, `reach`. Start it from dialogue
with `"effects": { "startQuest": "your_quest_id" }`.

**Add an Echo.** Append to `src/data/spirits.json` (variant controls the
silhouette: meadow/river/hearth today; cloud/night/storm/guardian reserved).
Add a dialogue array keyed by the Echo's id for lantern-translated chats.

**Add a region.** Create `src/world/YourRegionBuilder.ts` following
`ValleyBuilder`, register it in `WorldManager.build()` with a region group +
center, extend `terrainHeight()` with any flattening/features, and add POIs
to `src/utils/constants.ts`.

## Multiplayer architecture

`NetworkManager` talks to a swappable `NetworkAdapter`:

- **mock** (default): a simulated Wayfarer wanders the plaza, exercising the
  full remote-player path — join/leave events, 10 Hz snapshots, 150 ms
  interpolation buffer (`StateInterpolation.ts`), emote relay.
- **socket**: Socket.IO transport matching the server in `server/`
  (`cd server && npm install && npm run dev`, then set
  `GameConfig.networkMode = 'socket'`).

Remote players never sync per-frame: local state is sampled at
`snapshotRateHz` and remote rigs render `interpolationDelayMs` in the past.
Social safety scaffolding (invite-only homes, mute/block lists, friends-only
chat) is designed to live in `WorldRoom` on the server, where it's
authoritative.

## Performance

Quality presets (Low/Medium/High/Auto) drive pixel-ratio caps, shadow map
size, grass density and fog distance (`PerformanceManager`). The build already
uses instanced vegetation (single draw call per field), shared toon materials,
one shadow-casting light, distance-culled region groups, pooled particle
bursts and an analytic terrain shared by rendering and physics. If you target
low-end mobile first: keep Auto, reduce `terrainSegments`, and prefer baked
vertex colors over textures (the art style is built for it).

## Known scope notes (honest list)

- Cloudstep Ruins, Moonwater Marsh and The Hollow Crown are designed
  (see quest/story data structure) but not yet built — chapter one and the
  first two regions are playable.
- Placed furniture has no physics colliders yet.
- Chat UI is intentionally absent until the real server ships (no dead
  buttons policy).
