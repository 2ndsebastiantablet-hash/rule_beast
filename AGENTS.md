# Rule Beast VR Agent Guide

## Project Summary
Rule Beast VR is a Three.js r184 desktop, VR-inspired asymmetric horror prototype. A 2–4 player lobby starts a match where one player is randomly assigned Monster and the rest are Survivors. Survivors complete one active puzzle per round across a dark maze; the Monster hunts them. The match lasts 10 rounds, with a new Monster ability each round. Dead survivors stay dead.

## Important Files And Patterns
- `/index.html`: importmap, full-viewport `#game-container`, `#ui-container`, and CSS HUD/lobby styling. Keep the importmap and bottom scripts intact.
- `/main.js`: game bootstrap, Three.js renderer/loop, InstantDB room presence, local fallback lobby, match rules, bot simulation, collisions, puzzle solving, attacks, win/loss.
- `/entities.js`: world geometry, player/monster models, puzzle station creation, remote markers, corpses, helpers.
- `/data.js`: map walls, puzzle positions, monster ability text, tuning constants.
- `/ui.js`: lobby/HUD/end-screen DOM updates and audio/mute buttons.
- `/audio.js`: generated MP3 paths, gesture-gated playback, mute behavior, procedural heartbeat.

## Assets And Paths
Generated audio lives under `assets/audio/...` and is referenced directly from code:
- `assets/audio/rule-beast-drone-loop.mp3`
- `assets/audio/puzzle-solve-sigil.mp3`
- `assets/audio/monster-kill-growl.mp3`
- `assets/audio/round-rule-alarm.mp3`
Use `assets/...` paths in runtime code for new assets.

## Audio Notes
Audio starts only after a player gesture via lobby start, canvas click, or mute controls. `AudioSystem.setMuted()` controls music and SFX. Keep music quiet and SFX readable.

## Visual Direction
Read `/art_direction.md` before changing visual style, UI, generated art, models, lighting, colors, textures, or symbols. Current style is dark low-poly horror with cyan puzzle glows and crimson Monster accents.

## Sound Direction
Read `/sound_direction.md` before changing music, ambience, SFX, generated audio, or procedural audio. Current sound is minimal horror-electronic with puzzle chirps, ritual alarm, and monster stingers.

## Rosie Tools
Read `/rosie/README.md` before using injected Rosie helpers. This project uses `PlayerController` and `FirstPersonCameraController` from `/rosie/controls/rosieControls.js` for desktop first-person movement/look.

## Multiplayer Notes
InstantDB config is present (`/instant_db_config.js`, `/instant_db.md`). `/main.js` joins a room from `?room=` and publishes presence. The game remains playable with local filled bots if peers are absent or InstantDB is unavailable.

## Validation Notes
Smoke-test startup at full viewport. Check: lobby displays, Start / Fill Lobby begins a match, WASD moves, mouse look works after clicking canvas, survivors can hold E near the active cyan puzzle, Monster can click/F/Space to attack nearby survivors, HUD does not overlap critical controls at desktop and narrow widths.