# Asset Licenses — Kindred Peaks

Kindred Peaks is an entirely original IP. This document tracks the provenance
of every asset in the project.

## Current build (v0.1.0)

| Asset type | Source | License |
| --- | --- | --- |
| 3D models (characters, buildings, props, spirits) | Generated procedurally in code (`src/player/CharacterFactory.ts`, `src/world/*`) | Original — project license |
| Terrain, water, sky, grass | Procedural shaders (`src/shaders/*`) | Original — project license |
| Textures (signs, name tags, notice board, map) | Drawn at runtime onto canvases | Original — project license |
| All sound effects | Synthesized at runtime with WebAudio (`src/core/AudioManager.ts`) | Original — project license |
| Music | Generative pentatonic motif, composed in code | Original — project license |
| UI icons | Unicode emoji rendered by the user's OS font | System fonts (no bundled emoji assets) |
| Fonts | System font stack only (no bundled font files) | N/A |
| Writing (dialogue, quests, lore) | Written for this project | Original — project license |

## Third-party runtime libraries (npm)

three (MIT), @dimforge/rapier3d-compat (Apache-2.0), howler (MIT),
socket.io-client (MIT). UI/camera transitions use hand-rolled exponential
damping (`src/utils/math.ts`) and CSS animations rather than a tween library.
Optional CDN decoders: Draco (Apache-2.0), Basis/KTX2 transcoder (Apache-2.0).

## Rules for adding assets

1. Only original work, procedurally generated content, CC0 assets, or assets
   with a license compatible with this project — with attribution recorded
   here **before** the asset is committed.
2. Never include, recreate, trace, or extract assets, names, creatures,
   dialogue, music, or UI from any commercial game.
3. Every new file in `public/models`, `public/textures`, `public/audio`,
   `public/icons`, or `public/fonts` requires a row in the table above.
