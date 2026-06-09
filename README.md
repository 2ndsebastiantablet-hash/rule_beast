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

## Map Maker And Admin Editor

Rule Beast includes a desktop-first, local-only Admin Asset Editor and a dedicated Map Maker entry from the main menu. The normal in-map editor is still hidden by default and unlocks with the prototype admin code `edit`. This code is only a local prototype gate, not production security.

Open Map Maker from the main menu to create a local editable workspace without starting a multiplayer lobby. The setup screen offers `Create New Map` and `Edit Existing Map`. New maps ask for a map id and display name, then open a blank flat workspace. Existing maps load the selected official map with editor tools enabled. Closing Map Maker returns to the main menu and resets normal map selection so draft maps do not affect multiplayer unless exported and imported later.

Open the normal editor in any running map with the small Admin / Editor unlock box and code `edit`. The right-side panel appears with the indicator `EDITOR MODE - LOCAL TESTING ONLY`. Close Editor hides the panel and returns normal gameplay controls. The editor does not upload files, use the GitHub API, use Cloudflare R2, expose secrets, or sync imported files through InstantDB.

Current maps register floors, room slabs, paths, grass, walls, doors, and simple props where available. While editor mode is open, click a registered surface or editor-created object in the 3D scene; selected items get a yellow bounding-box highlight.

Texture workflow:

- Import `.png`, `.jpg`, `.jpeg`, or `.webp` from your computer.
- Upload validation accepts valid extensions even when the browser reports an empty or generic MIME type.
- Uploaded textures appear in `My Textures` with the file name and preview thumbnail.
- Click a texture to enter Paint Texture Mode, then click a wall, floor, path, grass patch, door, or simple prop.
- You can also drag a texture card from `My Textures` onto the game canvas.
- Texture warnings appear for files over 5 MB or detected images above 2048x2048.
- The selected surface can adjust brightness, repeat X/Y, apply the selected texture, or reset to its original material.

GLB workflow:

- Import `.glb` files only.
- Uploaded models appear in `My Models`.
- Click a model, then click the map where it should appear.
- You can also drag a model card from `My Models` into the game canvas.
- Placed GLBs use simple box collision by default. Select one and use Collision ON/OFF to toggle it.
- Animated GLBs are detected. If clips exist, the first animation autoplays on placed copies through `THREE.AnimationMixer`; static GLBs still load normally.
- The selected model has a brightness slider from 0.25 to 2.5 and updates immediately.

Images / GIFs:

- Import `.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif`.
- Uploaded images appear in `Images / GIFs`.
- Click or drag an image/GIF to place it as a flat billboard plane.
- Image/GIF planes can be moved, rotated, resized, brightened, duplicated, deleted, and exported.
- GIFs are accepted, appear in `My Images/GIFs`, and can be placed. This version uses the safe fallback warning `GIF loaded as static image in this version.` when GIF animation is unreliable.
- Image/GIF planes default collision OFF, but can be toggled ON.

Shape Library:

- Map Maker includes exactly 100 built-in shape choices for this task.
- Only these sections are included: `Basic shapes`, `Architecture`, and `Decorative shapes`.
- Horror/lab, theme park, and bonus shape sections are intentionally not included.
- Shapes are searchable and listed in the editor panel.
- Click or drag a shape, then click the map to place it.
- Placed shapes are selectable, texture-capable, brightness-capable, duplicate/delete-capable, and collision-enabled by default.
- Shapes are data-driven in `editor/shapeLibrary.js`; add more by adding a definition with id, name, category, kind, dimensions, and collision defaults.

Map markers:

- The compact marker buttons place Survivor Spawn, Monster Spawn, Puzzle Station, and Point Light markers.
- New-map Codex Packages should include survivor spawn, monster spawn, and puzzle station marker data. The importer refuses to create a broken new map if required marker data is missing.

Liquid volumes:

- `Liquids` places water, acid, slime, lava, oil, toxic waste, black goo, blood pool, deep water, or custom liquid volumes.
- Liquids are transparent box volumes that can be moved, rotated, resized, colored, brightened, duplicated, deleted, and exported.
- Defaults are safe: blue, 0.5 opacity, no damage, no instant kill, no sink, movement multiplier 0.8, and collision OFF as volume-only gameplay data.
- Selected liquids expose settings for color, opacity, damage per second, movement multiplier, sink speed, hurts ON/OFF, instant kill, sink, and slime behavior.

Gas / fog volumes:

- `Gas/Fog Settings` places fog cloud, poison gas, smoke, black fog, green toxic gas, blue cold mist, red danger gas, low-gravity field, heavy-gravity field, or custom gas volumes.
- Gas/fog volumes use lightweight transparent boxes rather than heavy particle systems.
- Selected gas/fog exposes color, opacity, density, damage per second, movement multiplier, gravity multiplier, upward force, downward force, vision, and gravity toggles.
- Gas/fog can slow, hurt, instant-kill, affect fog/vision, or modify gravity while the local player is inside.

Map gravity and Sun/Main Light:

- `Map Settings` stores map-level `gravityMultiplier`, `airControl`, and `drag` values. Defaults preserve normal gameplay.
- Gas/fog gravity volumes combine with the map gravity multiplier while the player is inside them.
- `Sun / Main Light` adds one movable directional main-light object with color, brightness, ambient boost metadata, and shadow toggle.
- If no sun is placed, maps keep their current default lighting.

Collision box editing:

- Toggle `Show Collision Boxes` to see editor-only collision helpers.
- Collision ON helpers are green; collision OFF helpers are gray/red; the selected collision box is highlighted yellow/green.
- `Edit Collision Box` switches keyboard controls to the selected object's collision box. `Return To Object Editing` switches back.
- `Reset Collision Box To Object Bounds` recalculates the box from the visual object.
- Collision box edits export as size/offset/min/max data and are used by editor-created collision in gameplay.

Editor Fly Mode:

- When Editor Mode is open and no placed model is selected, `W/A/S/D` flies around the map.
- `Space` flies up.
- `Shift` or `Ctrl` flies down.
- `C` toggles editor collision.
- Collision ON keeps the editor camera/player using normal wall collision.
- Collision OFF lets the editor camera/player pass through walls, floors, ceilings, objects, and map boundaries.
- Closing the editor clears editor movement keys, restores collision ON, and returns normal gameplay controls.

Keyboard Object Editing:

- Click a placed model, shape, image/GIF plane, marker, light, wall, floor, or platform object to select it.
- `A` moves the selected object left.
- `D` moves the selected object right.
- `S` moves the selected object forward.
- `W` moves the selected object backward.
- `Q` makes the selected object bigger.
- `E` makes the selected object smaller.
- `R` makes the selected object taller.
- `F` makes the selected object shorter.
- `Z` makes the selected object wider.
- `X` makes the selected object narrower.
- `T` makes the selected object deeper.
- `G` makes the selected object thinner.
- `Arrow Up` and `Arrow Down` move the selected object up/down.
- `Arrow Left` and `Arrow Right` rotate the selected object.
- `Delete` or `Backspace` deletes the selected object.
- `Esc` clears the selection.
- `C` toggles selected-object collision. When no object is selected, `C` toggles editor fly collision.
- `Ctrl+C` duplicates the selected object with a small offset; the copy becomes selected and can be moved away.
- While an object is selected, those keys edit the object and do not trigger normal movement, puzzle, attack, or monster ability controls.

Local drafts:

- Save Local Draft stores metadata in `localStorage` under `ruleBeastEditorDraftV1`.
- Drafts do not store binary texture/image/GIF/model files or base64 data.
- Loading a draft may show missing-file warnings because browser blob URLs are temporary and may not survive reloads.
- If the same browser session still has the uploaded files, loading a draft restores placed model transforms and brightness.

Export Editor JSON:

- Export Editor JSON downloads a readable JSON file and fills the export textarea.
- The JSON includes package type, map id/name, uploaded texture/image/GIF/model metadata, changed surfaces, placed shapes, placed image/GIF planes, placed GLBs, liquid volumes, gas/fog volumes, map gravity settings, Sun/Main Light data, marker/light data, brightness/color settings, collision settings, collision box transforms, animation settings, warnings, and a note that local blob URLs are temporary.

Export Codex Package:

- Export Codex Package downloads a real ZIP using the lightweight browser `fflate` dependency loaded from the import map.
- The ZIP contains `manifest.json`, `textures/`, `images/`, `gifs/`, `models/`, and `codex_import_prompt.txt`.
- The manifest includes liquid volumes, gas/fog volumes, map settings, Sun/Main Light data, copied/duplicated objects, collision enabled/disabled state, collision box transforms, image/GIF asset info, model animation settings, object transforms, color/brightness settings, and surface texture edits.
- Set `Map Package Type` to `New Map` or `Update Existing Map` before export.
- New-map manifests include `packageType: "newMap"`, `mapId`, and `displayName`.
- Existing-map update manifests include `packageType: "updateExistingMap"`, `mapId`, and `displayName`.
- The ZIP includes uploaded files only while those original browser `File` objects are still available in the current session.
- If package export warns that local files are missing, re-upload the missing texture/image/GIF/model files and export again.

Making Editor Changes Permanent:

- Edit the map in Editor Mode.
- Click Export Codex Package.
- Move the ZIP into `editor_imports/inbox/`.
- Open Codex in the Rule Beast repo.
- Tell Codex: `Import the latest editor package from editor_imports/inbox and make it permanent.`
- Codex runs `node tools/import-editor-package.mjs editor_imports/inbox/<package>.zip`.
- The importer copies assets to `assets/editor_maps/<mapId>/textures/`, `images/`, `gifs/`, and `models/`.
- The importer writes `assets/editor_maps/<mapId>/latest.json`.
- If `packageType` is `newMap`, the importer validates spawn/puzzle marker data and updates `assets/editor_maps/index.json` so the map can appear in the selector after reload.
- If `packageType` is `updateExistingMap`, the importer updates the existing map override.
- The game loads `assets/editor_maps/<mapId>/latest.json` after the built-in or blank editor map is created, including liquids, gas/fog, map settings, Sun/Main Light, collision edits, image/GIF planes, and animated GLB settings.
- Codex commits and pushes. Players refresh/reload to see the permanent map update.

Permanent Override System:

- Built-in maps remain in `maps.js`.
- Permanent editor overrides live in `assets/editor_maps/<mapId>/latest.json`.
- Missing `latest.json` is fine; the game continues with the built-in map.
- If `latest.json` or an asset fails to load, the loader logs a warning, skips that item, and keeps the map playable.
- Overrides can apply surface textures, surface brightness, placed GLB models, animated GLB playback, placed shapes, placed image/GIF planes, liquid volumes, gas/fog volumes, map gravity settings, Sun/Main Light, collision boxes, spawn markers, puzzle station markers, lights, transforms, and brightness.

Volume effects limitations:

- Volume effects use simple axis-aligned box checks against the local player.
- Effects are local-only for this pass and are not synced through multiplayer.
- Damage over time accumulates locally and kills at 100 accumulated damage; instant-kill volumes kill immediately.
- Multiple overlapping volumes combine conservatively: instant kill wins, damage adds, movement uses the slowest multiplier, and gravity multipliers combine.

Editor Imports Folder:

- Put future packages in `editor_imports/inbox/`.
- `editor_imports/inbox/*.zip` is gitignored so large temporary packages do not get committed by accident.
- `editor_imports/inbox/.gitkeep` keeps the folder convention in the repo.

Current limitations: local-only testing is not multiplayer synced, GIFs may display as static image planes in this version, collision and volume effects use simple bounding boxes rather than mesh physics, there is no cloud publishing, there is no GitHub upload from inside the game, exported packages must be imported by Codex, and large assets can hurt browser or VR performance.

## Main Files

- `index.html`: page shell, import map, `fflate` browser ZIP dependency, CSS, containers, and script loading.
- `main.js`: Three.js renderer/bootstrap, WebXR setup, brighter global/map lighting, local admin editor and Map Maker initialization, editor fly/collision routing, editor-created collision colliders, permanent override loading, volume effect checks, map gravity multiplier, InstantDB lobby/presence/topic handling, match rules, multiplayer map selection, map rebuilds, round flow, floor-aware movement/collision, stair interaction, spread puzzle selection, puzzle completion, attacks, monster ability effects, HUD updates, and render loop.
- `entities.js`: materials, map loading, editable surface registration, multi-floor world geometry, rooms, corridors, walls, doors, stairwell markers, boosted map lights, props, player/monster models, local hands, puzzle station meshes, remote markers, corpses, and distance helpers.
- `maps.js`: map IDs/options, blank Map Maker workspace layout, `default_bunker_lab`, `amusement_park`, and `hotel` definitions, map lighting profiles, wall snapping/overlap helpers, map factory, floor heights, room/path sizes, grass sections, wall colliders, stair connections, doors, spawn points, puzzle station zones, and light positions.
- `editor/assetEditor.js`: local-only editor coordinator for admin unlock, Map Maker sessions, texture imports, image/GIF imports, GLB imports, animated GLB mixers, built-in shape placement, liquid/gas volume placement, Sun/Main Light placement, marker/light placement, click/drag paint and place modes, editor fly/collision state, collision-box editing, selected-object keyboard editing, brightness, transforms, canvas selection, draft actions, and export actions.
- `editor/shapeLibrary.js`: data-driven 100-entry shape registry limited to Basic shapes, Architecture, and Decorative shapes, plus Three.js primitive/group shape factory.
- `editor/volumeObjects.js`: shared liquid/gas/sun definitions, default settings, Three.js object factories, visual updates, and volume containment checks.
- `editor/editorRegistry.js`: editable object registry, selection helpers, and BoxHelper highlighting.
- `editor/editorState.js`: editor runtime state and metadata-only local draft save/load.
- `editor/editorUI.js`: DOM editor unlock box, scrollable simplified editor panel, upload lists, shape library search, liquid/gas/map/sun panels, package type fields, selected object info, collision controls, save/export controls, and keyboard help.
- `editor/editorExport.js`: Export Editor JSON builder for new-map/update metadata, assets, placed objects, collision, animation, liquid/gas volumes, map settings, sun lights, markers, lights, and download helper.
- `editor/editorPackage.js`: Export Codex Package ZIP builder for textures, images, GIFs, models, manifest, and `codex_import_prompt.txt`.
- `editor/editorOverrides.js`: permanent static editor override loader for `assets/editor_maps/<mapId>/latest.json`, including placed shapes, image/GIF planes, GLBs, animations, collision, liquid/gas volumes, map settings, sun lights, markers, and lights.
- `tools/import-editor-package.mjs`: Node importer for `editor_imports/inbox/*.zip` packages, including new-map/update handling, asset copying, liquids, gas/fog, map gravity, sun lights, collision edits, required marker validation, and editor map index updates.
- `assets/editor_maps/`: permanent editor override assets and `latest.json` files by map id.
- `editor_imports/inbox/`: local inbox for future editor package ZIPs.
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
