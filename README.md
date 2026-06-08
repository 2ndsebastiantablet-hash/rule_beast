# Rule Beast

Rule Beast is a browser-based, VR-inspired asymmetric horror prototype exported from Rosebud. A 2-4 player lobby starts a 10-round match: one player is randomly assigned as the Monster and the remaining players are Survivors. Survivors complete active cyan puzzle stations on the host-selected map while the Monster hunts them. Dead Survivors stay dead, and the Monster unlocks a new ability between rounds.

## Engine And Project Type

- Project type: static browser game using native ES modules.
- Rendering engine: Three.js `0.184.0` loaded from an import map CDN.
- Multiplayer/presence: InstantDB `@instantdb/core` loaded from CDN.
- Input helpers: local Rosie `PlayerController` and `FirstPersonCameraController`.
- Packaging reference: the Windows folder is Electron/Chromium build output and is not the editable source.

There is no Node package or build step in the current source. The game runs directly from `index.html` when served by a local web server.

## How The Game Works

Players create or join public/private lobbies through the main menu. The host can choose the map before the match starts, then start once 2-4 players are present. The host chooses a random Monster, generates a map seed, publishes match state through InstantDB room topics/presence, and starts Round 1.

Each round activates a random set of puzzle stations. Survivors win a round by completing all active stations. If they finish Round 10 with at least one Survivor alive, Survivors win the match. The Monster wins by killing every living Survivor. Between rounds, the game enters an intermission menu where players can join, the host can change maps, and the host starts the next round. On each new round after Round 1, the Monster unlocks a random ability from the ability pool.

Available maps are `default_bunker_lab`, `amusement_park`, and `hotel`. The bunker/lab map is a recreated top-down floorplan built from original Rule Beast geometry and materials. The amusement park map is a basic open layout with connected walking paths, grass sections, boundaries, spawn points, and puzzle stations only. The hotel map is a four-level layout with Basement, Floor 1, Floor 2, and Floor 3 stacked at different heights. Maps are defined in `maps.js` as floors, rooms/path slabs, grass sections, wall colliders, doors, lights, stair connections, puzzle slot metadata, and spawn points. Current maps intentionally have no non-collidable decorative props. Collision is simple wall pushing against the current floor's wall boxes.

Wall segments are created through `createWallSegment`, which snaps wall boxes to a shared grid and slightly overlaps connected segments. Future maps should use that helper so visual walls and collision boxes connect without tiny seams.

Puzzle stations include `floor` and `zone` metadata. Round selection uses that metadata to pick unused floors/zones first, then repeats only after it has spread active stations as widely as the current map allows.

The hotel uses visible teleport stairwells as a reliable first pass for the existing first-person movement system. It intentionally avoids extra staircases: Basement connects to Floor 1, Floor 1 connects up to Floor 2, and Floor 2 connects up to Floor 3, leaving Floor 1 and Floor 2 with one up route and one down route each.

## Controls

Desktop:

- `WASD` or arrow keys: move.
- Mouse click on the canvas: pointer-lock first-person look.
- `E`: interact with nearby doors or stairwells; Survivors hold `E` near an active cyan puzzle station to repair it.
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
- Lobby screen: player list, host map selection, host controls, kick/ban buttons, private code copy, and start button.
- HUD: role badge, round status, ability text, objective text, puzzle count, progress meter, prompts, warnings, and mute button.
- Round intermission menu: between-round player list, host map selection, and host next-round control.
- Server menu: status/player list while in a lobby or match.
- End screen: match winner and return-to-menu action.

`main.js` also creates a VR menu layer in Three.js so menu choices can be selected from inside WebXR.

## Admin Asset Editor

Rule Beast includes a desktop-first, local-only Admin Asset Editor for building map drafts inside the running game. It is hidden by default and unlocks with the prototype admin code `rulebeast-editor`. This code is only a local prototype gate, not production security.

Open the game, use the small Admin / Editor unlock box, enter the code, and the right-side editor panel appears with the indicator `EDITOR MODE ENABLED - LOCAL ONLY`. Close Editor hides the panel and returns normal gameplay controls. The editor does not upload files, use the GitHub API, use Cloudflare R2, or sync imported files through InstantDB.

The object list is populated from the editable registry. Current maps register floors, room slabs, paths, grass, walls, doors, and simple props where available. Select an object from the dropdown or click a registered surface in the 3D scene while editor mode is enabled; selected objects get a yellow bounding-box highlight.

Texture workflow:

- Import `.png`, `.jpg`, `.jpeg`, or `.webp` from your computer.
- Select a surface that supports textures.
- Apply the texture, then adjust repeat X/Y, offset X/Y, and rotation in degrees.
- Remove texture clears the local surface edit.

GLB workflow:

- Import `.glb` files only.
- Choose the imported model and place it near the player.
- Placed models are visual-only for now and do not add collision.
- Use transform controls to move, rotate, scale, duplicate, delete, or move the selected model to the player.

Local drafts:

- Save Local Draft stores metadata in `localStorage` under `ruleBeastEditorDraftV1`.
- Drafts do not store binary texture/model files or base64 data.
- Loading a draft may show missing-file warnings because browser blob URLs are temporary and may not survive reloads.

Manifest export/import:

- Export Asset Manifest JSON downloads a readable manifest and fills the manifest textarea.
- Copy Manifest uses the clipboard when available.
- Import Manifest JSON is for local testing only. It applies edits only when the referenced local texture/model assets are present in the current browser session.
- The manifest contains map id/name, texture metadata, model metadata, surface edits, placed model transforms, warnings, intended repo paths, and instructions for making the draft permanent.

To make editor work permanent later, copy texture files into `assets/textures/`, copy GLB files into `assets/models/`, replace temporary blob URLs with repo asset paths, and give the exported manifest plus files to Codex for source integration. Imported assets remain local-only and are not visible to other multiplayer players until integrated into the repo.

## Main Files

- `index.html`: page shell, import map, CSS, containers, and script loading.
- `main.js`: Three.js renderer/bootstrap, WebXR setup, local admin editor initialization, InstantDB lobby/presence/topic handling, match rules, multiplayer map selection, map rebuilds, round flow, floor-aware movement/collision, stair interaction, spread puzzle selection, puzzle completion, attacks, monster ability effects, HUD updates, and render loop.
- `entities.js`: materials, map loading, editable surface registration, multi-floor world geometry, rooms, corridors, walls, doors, stairwell markers, lights, props, player/monster models, local hands, puzzle station meshes, remote markers, corpses, and distance helpers.
- `maps.js`: map IDs/options, `default_bunker_lab`, `amusement_park`, and `hotel` definitions, wall snapping/overlap helpers, map factory, floor heights, room/path sizes, grass sections, wall colliders, stair connections, doors, spawn points, puzzle station zones, and light positions.
- `editor/assetEditor.js`: local-only editor coordinator for admin unlock, texture imports, GLB imports, transforms, canvas selection, draft actions, and manifest actions.
- `editor/editorRegistry.js`: editable object registry, selection helpers, and BoxHelper highlighting.
- `editor/editorState.js`: editor runtime state and metadata-only local draft save/load.
- `editor/editorUI.js`: DOM editor unlock box and scrollable editor panel.
- `editor/editorManifest.js`: manifest export, download, JSON parse, and manifest metadata helpers.
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
- There is a small Node regression test file, but no package scripts or full gameplay automation yet.

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
