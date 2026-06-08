# Rule Beast

Rule Beast is a browser-based, VR-inspired asymmetric horror prototype exported from Rosebud. A 2-4 player lobby starts a 10-round match: one player is randomly assigned as the Monster and the remaining players are Survivors. Survivors complete active cyan puzzle stations in the default underground bunker/lab map while the Monster hunts them. Dead Survivors stay dead, and the Monster unlocks a new ability between rounds.

## Engine And Project Type

- Project type: static browser game using native ES modules.
- Rendering engine: Three.js `0.184.0` loaded from an import map CDN.
- Multiplayer/presence: InstantDB `@instantdb/core` loaded from CDN.
- Input helpers: local Rosie `PlayerController` and `FirstPersonCameraController`.
- Packaging reference: the Windows folder is Electron/Chromium build output and is not the editable source.

There is no Node package or build step in the current source. The game runs directly from `index.html` when served by a local web server.

## How The Game Works

Players create or join public/private lobbies through the main menu. The host can start once 2-4 players are present. The host chooses a random Monster, generates a map seed, publishes match state through InstantDB room topics/presence, and starts Round 1.

Each round activates a random set of puzzle stations. Survivors win a round by completing all active stations. If they finish Round 10 with at least one Survivor alive, Survivors win the match. The Monster wins by killing every living Survivor. Between rounds, the game enters an intermission menu where players can join and the host starts the next round. On each new round after Round 1, the Monster unlocks a random ability from the ability pool.

The default map is `default_bunker_lab`, a recreated top-down bunker/lab floorplan built from original Rule Beast geometry and materials. It is defined in `maps.js` as rooms, corridor slabs, wall colliders, doors, props, lights, puzzle station positions, and spawn points. Collision is simple 2D wall pushing against the map's wall boxes.

## Controls

Desktop:

- `WASD` or arrow keys: move.
- Mouse click on the canvas: pointer-lock first-person look.
- `E`: interact with nearby doors; Survivors hold `E` near an active cyan puzzle station to repair it.
- Left click, `F`, or `Space`: Monster grab/attack.
- `Q`: Monster activates the selected active ability.
- `R`: Monster cycles unlocked abilities.
- `Esc`: open/close the server menu.

VR:

- Enter VR from the main menu if WebXR is available.
- Left stick: move.
- VR interact button: repair/use.
- VR ability button: use the selected Monster power.
- Right stick: cycle Monster abilities.
- VR controller pointer/select: interact with VR menu buttons.

## Enemy And Monster Behavior

The Monster is controlled by a player, not by AI. Its base movement is slightly slower than Survivors, but passive and active abilities can increase speed, range, sensing, fog/blackout pressure, door manipulation, puzzle interference, slows, lunges, teleports, or warning/illusion effects. The Monster kills by attacking a living remote Survivor within grab range. Some abilities immediately affect nearby Survivors, puzzle progress, doors, lighting, fog, or remote marker visibility.

## Menu And UI System

`ui.js` builds the DOM UI inside `#ui-container`. It manages:

- Main menu: player name, public lobby list, private code join, public/private creation, and VR entry.
- Lobby screen: player list, host controls, kick/ban buttons, private code copy, and start button.
- HUD: role badge, round status, ability text, objective text, puzzle count, progress meter, prompts, warnings, and mute button.
- Round intermission menu: between-round player list and host next-round control.
- Server menu: status/player list while in a lobby or match.
- End screen: match winner and return-to-menu action.

`main.js` also creates a VR menu layer in Three.js so menu choices can be selected from inside WebXR.

## Main Files

- `index.html`: page shell, import map, CSS, containers, and script loading.
- `main.js`: Three.js renderer/bootstrap, WebXR setup, InstantDB lobby/presence/topic handling, match rules, map rebuilds, round flow, movement/collision, puzzle completion, attacks, monster ability effects, HUD updates, and render loop.
- `entities.js`: materials, default map loading, world geometry, rooms, corridors, walls, doors, lights, props, player/monster models, local hands, puzzle station meshes, remote markers, corpses, and distance helpers.
- `maps.js`: `default_bunker_lab` definition. Adjust room sizes, corridor slabs, wall colliders, doors, spawn points, puzzle station points, props, and light positions here.
- `data.js`: lobby state constants, monster ability pool, puzzle type definitions, and game tuning constants.
- `ui.js`: DOM menu, lobby, HUD, round menu, server menu, end screen, player rows, lobby browser, and flash messages.
- `audio.js`: music/SFX path map, gesture-gated audio unlock, mute behavior, one-shot SFX, and procedural heartbeat.
- `instant_db_config.js`: InstantDB app id used by the exported game.
- `rosie/controls/rosieControls.js`: first-person and player movement helpers.
- `rosie/controls/rosieMobileControls.js`: mobile control helper imported by Rosie controls.
- `assets/audio/`: generated music and sound effects used by `audio.js`.
- `art_direction.md`, `sound_direction.md`, `instant_db.md`, `AGENTS.md`: project notes from the export.

## Known Bugs And Risks

- The current source depends on network CDNs for Three.js, InstantDB, Google Fonts, and Rosebud scripts. Offline local runs will fail unless those dependencies are vendored or replaced.
- `tone` appears in the import map but is not currently imported by source code.
- Several UI lists are rendered with `innerHTML` using player/lobby names from local or network presence. This is a potential XSS risk in multiplayer contexts and should be escaped before accepting untrusted players.
- `instant_db_config.js` contains a public InstantDB app id from the export. Confirm whether this app id should remain public for the migrated repo.
- `audio.js` creates a new `AudioContext` for each heartbeat pulse. This is simple but may be wasteful over long sessions.
- The exported `public/index.html` redirects to `../index.html`; this is fine as a helper from the current structure but may be wrong if a future deploy uses `public/` as the web root.
- The Windows build output is Electron packaging, not source. Do not edit or upload it as the primary project.
- There are no automated tests or package scripts yet.

## Run Locally

Serve the repo root with any static HTTP server, then open the shown localhost URL.

```powershell
py -m http.server 8080
```

Open:

```text
http://localhost:8080/
```

The browser needs internet access for CDN imports and InstantDB multiplayer.

## Notes For Future Codex Work

- Treat the root source files as the editable game source.
- Do not use the Windows build output as source.
- Keep gameplay migrations separate from mechanics changes.
- Before changing visual style, read `art_direction.md`.
- Before changing audio, read `sound_direction.md`.
- Before changing input helpers, inspect the files under `rosie/controls/`.
- Prefer small, focused changes with a browser smoke test after each gameplay/UI edit.
