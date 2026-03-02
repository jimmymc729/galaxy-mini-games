# Microcosm

Microcosm is a browser arcade survival game set in a stylized microscopic world. You control a protozoan-like organism inspired by ciliated single-celled life, absorb nutrients, and survive against rival cells.

## Rules
- Your organism moves forward continuously.
- Collect nutrients to gain mass and body length:
  - `Glucose`: common, small growth
  - `Amino`: less common, medium growth
  - `ATP`: frequent, tiny growth
- Hold `Space` to boost. Boosting increases speed but drains mass.
- You die on head collision with:
  - Any other organism body segment (your own body is pass-through)
  - Lethal hazards (predatory protozoa)
- Slow hazards are viscous gel pools that reduce movement speed but do not kill.
- Arena edges wrap around for endless traversal (no boundary death).
- On death, your cell ruptures into collectible nutrient particles.
- Player respawns after 2 seconds (or immediately with **Culture Again**).

## Controls
- Move (default): mouse steering
- Keyboard mode: `A/D` or `Left/Right` to steer (relative turn)
- Boost: `Space`
- Pause/Resume: `Escape`
- Debug panel: `` ` `` (backquote)

## HUD and UI
- HUD shows current mass, best mass this session, rival cell count, score, and chain multiplier.
- Settings include control scheme, quality (`Auto/High/Low`), and mute.
- Audio cues cover pickups, combo streaks, near-misses, boost bursts, respawn, lysis, and UI interactions.
- Mute works from both the HUD mute button and Settings toggle.
- Start menu includes Start, Controls, and Settings.
- Death overlay shows final mass and score with quick restart.

## Performance Techniques Used
- Fixed timestep simulation (`60 Hz`) with `requestAnimationFrame` rendering.
- Spatial hash grids for nearby body/collectible collision checks.
- Object pooling for particles and short-lived nutrient drops.
- Reduced per-frame allocations by reusing query arrays and pooled entities.
- Adaptive quality mode that drops heavy effects when FPS/entity load is high.

## Current Systems
- Entity classes: `Organism`, `BotOrganism`, `Collectible`, `Hazard`, `Particle`
- Game systems: `InputSystem`, `SpawnSystem`, `CollisionSystem`, `AISystem`, `UISystem`, `AudioSystem`, `SpatialHash`

## Known Limitations
- No touch controls yet (mobile viewport scales correctly, but touch steering is TODO).
- AI is heuristic-based and can still make occasional risky turns in crowded fights.
- Sound effects use WebAudio synthesis, not authored sound assets.
- No saved leaderboard yet; score is session-local.

## TODO
- Additional cell skins and species variants
- Biome variants (deep ocean microscopy, toxic biofilm, crystal culture)
- Touch controls and mobile-specific UI tuning
- Real multiplayer networking mode
- Persistent high score tracking
