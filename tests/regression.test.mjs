import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const entities = readFileSync(new URL('../entities.js', import.meta.url), 'utf8');
const assetEditor = readFileSync(new URL('../editor/assetEditor.js', import.meta.url), 'utf8');
const editorRegistry = readFileSync(new URL('../editor/editorRegistry.js', import.meta.url), 'utf8');
const editorState = readFileSync(new URL('../editor/editorState.js', import.meta.url), 'utf8');
const editorExport = readFileSync(new URL('../editor/editorExport.js', import.meta.url), 'utf8');
const editorPackage = readFileSync(new URL('../editor/editorPackage.js', import.meta.url), 'utf8');
const editorOverrides = readFileSync(new URL('../editor/editorOverrides.js', import.meta.url), 'utf8');
const editorUI = readFileSync(new URL('../editor/editorUI.js', import.meta.url), 'utf8');
const importerScript = readFileSync(new URL('../tools/import-editor-package.mjs', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const { SHAPE_LIBRARY, SHAPE_CATEGORIES } = await import('../editor/shapeLibrary.js');
const {
  DEFAULT_MAP_ID,
  MAP_OPTIONS,
  WALL_OVERLAP,
  createDefaultBunkerLabLayout,
  createMapLayout
} = await import('../maps.js');

const updateVrInput = main.match(/function updateVRInput\(delta\) \{([\s\S]*?)\n\}/);
assert.ok(updateVrInput, 'main.js should define updateVRInput');

const nonVrBranch = updateVrInput[1].match(/if \(!renderer\.xr\.isPresenting\) \{([\s\S]*?)return;\n  \}/);

assert.ok(nonVrBranch, 'main.js should keep a non-VR branch in updateVRInput');
assert.ok(
  !nonVrBranch[1].includes("keys.delete('KeyE')"),
  'desktop non-VR frames must not clear KeyE before puzzle repair runs'
);
assert.ok(
  main.includes('const INTERACT_KEY =') &&
    main.includes('event.code === INTERACT_KEY') &&
    main.includes("event.key?.toLowerCase() === 'e'"),
  'interact input should accept both event.code and lowercase event.key'
);
assert.ok(
  !index.includes('rosebud-exported-splash') && !index.includes('Rosebud.AI'),
  'index.html should not render the Rosebud startup splash'
);

const bunker = createDefaultBunkerLabLayout(12345);
const amusement = createMapLayout('amusement_park', 12345);
const hotel = createMapLayout('hotel', 12345);
const requiredZones = [
  'Northwest Top Corridor Strip',
  'West Storage Block',
  'Southwest Utility Room',
  'Central Bunker Hall',
  'Central Connector Rooms',
  'Upper Control Corridor',
  'Northeast Lab Wing',
  'Large East Chamber',
  'Southeast Utility Room',
  'Lower Maintenance Corridor'
];
const roomNames = new Set(bunker.rooms.map((room) => room.name));
assert.equal(DEFAULT_MAP_ID, 'default_bunker_lab');
assert.equal(bunker.id, DEFAULT_MAP_ID);
assert.ok(MAP_OPTIONS.some((map) => map.id === 'amusement_park' && map.name === 'Amusement Park'), 'map options should include Amusement Park');
assert.ok(MAP_OPTIONS.some((map) => map.id === 'hotel' && map.name === 'Hotel'), 'map options should include Hotel');
requiredZones.forEach((zone) => assert.ok(roomNames.has(zone), `default bunker map should include ${zone}`));
assert.ok(bunker.walls.length >= 34, 'default bunker map should define enough wall colliders for the floorplan');
assert.ok(bunker.doors.length >= 8, 'default bunker map should include several usable gates/doors');
assert.equal(bunker.props.length, 0, 'default bunker map should not render non-collidable orange rectangle props');
assert.ok(bunker.lights.length >= 14, 'default bunker map should include dim industrial lights');
assert.ok(bunker.puzzles.length >= 24, 'default bunker map should keep puzzle stations distributed across the map');
assert.ok(bunker.survivorSpawn.x < -12 && bunker.survivorSpawn.z > 6, 'survivors should spawn in the southwest/left safe area');
assert.ok(bunker.monsterSpawn.x > 12 && bunker.monsterSpawn.z < -6, 'monster should spawn away from survivors in the east/northeast');
assert.equal(amusement.id, 'amusement_park');
assert.ok(amusement.rooms.some((room) => room.name === 'Open Midway'), 'amusement park should include a wide open area');
assert.ok(amusement.corridors.length >= 10, 'amusement park should include a connected curved-looking path network');
assert.ok(amusement.grass.length >= 6, 'amusement park should include grass sections around paths');
assert.equal(amusement.props.length, 0, 'amusement park should not include rides, stores, props, or detailed objects yet');
assert.ok(amusement.walls.every((wall) => wall.w >= 0.45 + WALL_OVERLAP || wall.d >= 0.45 + WALL_OVERLAP), 'map wall segments should include overlap to prevent seam gaps');
assert.equal(hotel.id, 'hotel');
assert.deepEqual(hotel.floors.map((floor) => [floor.id, floor.y]), [['basement', -4], ['floor1', 0], ['floor2', 4], ['floor3', 8]], 'hotel should define the requested four stacked floors');
assert.ok(hotel.rooms.some((room) => room.name === 'Ground Lobby Hall'), 'hotel should include a ground-floor lobby layout');
assert.ok(hotel.rooms.some((room) => room.name === 'Floor 2 Central Common'), 'hotel should include the balanced second-floor common area');
assert.ok(hotel.rooms.some((room) => room.name === 'Floor 3 Curved Hall'), 'hotel should approximate the third-floor curved hall');
assert.equal(hotel.stairConnections.length, 3, 'hotel should avoid extra stair route segments');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'main_guest_f1_f2' && stair.from.floor === 'floor1' && stair.to.floor === 'floor2'), 'hotel should connect Floor 1 to Floor 2 via main guest stairs');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'emergency_c_f2_f3' && stair.from.floor === 'floor2' && stair.to.floor === 'floor3'), 'hotel should connect Floor 2 to Floor 3 via emergency stairs');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'basement_access_d' && stair.from.floor === 'basement' && stair.to.floor === 'floor1'), 'hotel should connect Basement to Floor 1 via basement access stairs');
const stairEndpointsByFloor = new Map();
hotel.stairConnections.forEach((stair) => {
  [stair.from, stair.to].forEach((point) => {
    stairEndpointsByFloor.set(point.floor, (stairEndpointsByFloor.get(point.floor) || 0) + 1);
  });
});
assert.ok((stairEndpointsByFloor.get('basement') || 0) <= 2, 'basement should not have extra stair endpoints');
assert.equal(stairEndpointsByFloor.get('floor1'), 2, 'Floor 1 should have only one up stair and one down stair endpoint');
assert.equal(stairEndpointsByFloor.get('floor2'), 2, 'Floor 2 should have only one up stair and one down stair endpoint');
assert.ok((stairEndpointsByFloor.get('floor3') || 0) <= 2, 'Floor 3 should not have extra stair endpoints');
assert.ok(main.includes('setControllerGroundLevel'), 'stair and spawn movement should update controller ground level for multi-floor maps');
assert.ok(new Set(hotel.puzzleSlots.map((slot) => slot.floor)).size === 4, 'hotel puzzle slots should cover basement, Floor 1, Floor 2, and Floor 3');
assert.ok(new Set(hotel.puzzleSlots.map((slot) => `${slot.floor}:${slot.zone}`)).size >= 12, 'hotel puzzle slots should define many reusable floor/zone groups');
assert.ok(hotel.survivorSpawns.some((spawn) => spawn.floor === 'floor1') && hotel.survivorSpawns.some((spawn) => spawn.floor === 'floor2'), 'hotel survivor spawns should be spread between Floor 1 and Floor 2');
assert.equal(hotel.monsterSpawn.floor, 'basement', 'hotel monster should spawn away from survivors in the basement');
assert.ok(main.includes('selectedMapId'), 'main should track the host selected map id');
assert.ok(main.includes('mapId'), 'multiplayer events and presence should carry map ids');
assert.ok(main.includes('generateMapLayout(seed, mapId)'), 'matches should rebuild the selected map through generateMapLayout');
assert.ok(main.includes('function spreadPuzzleStations'), 'round puzzle station selection should spread stations across floor/zone groups');
assert.ok(main.includes('distance3D'), 'multi-floor interaction should use 3D distance checks');
assert.ok(main.includes('useStairs'), 'hotel stair endpoints should be usable during gameplay');
assert.ok(entities.includes("from './maps.js'"), 'entities should use the dedicated default bunker map definition');
assert.ok(index.includes('editor/assetEditor.js'), 'index should load the organized asset editor entry module');
assert.ok(index.indexOf('type="importmap"') < index.indexOf('editor/assetEditor.js'), 'editor preload should stay after the importmap so bare Three.js imports resolve');
assert.ok(main.includes("const EDITOR_ADMIN_CODE = 'edit'") || main.includes('const EDITOR_ADMIN_CODE = "edit"'), 'main should use the simple prototype editor code edit');
assert.ok(main.includes('initAssetEditor'), 'main should initialize the local-only asset editor');
assert.ok(main.includes('AmbientLight') && main.includes('setEditorBrightnessBoost') && main.includes('BASE_FOG_DENSITY'), 'main should include brighter baseline lighting and an editor brightness boost');
assert.ok(entities.includes('pointIntensityMultiplier'), 'map lights should support a per-map brightness multiplier');
assert.ok(bunker.lighting && amusement.lighting && hotel.lighting, 'all maps should define readable lighting settings');
assert.ok(editorRegistry.includes('registerEditableObject') && editorRegistry.includes('selectEditableObject') && editorRegistry.includes('THREE.BoxHelper'), 'editor registry should expose selectable object helpers and highlighting');
assert.ok(editorState.includes('EDITOR_DRAFT_STORAGE_KEY') && editorState.includes('surfaceBrightness') && editorState.includes('modelBrightness') && !editorState.includes('base64'), 'editor state should save metadata-only drafts with brightness data');
assert.ok(editorExport.includes('buildEditorExport') && editorExport.includes('Local files are temporary') && editorExport.includes('downloadEditorJson'), 'editor export should be simple local editor JSON');
assert.ok(index.includes('"fflate"'), 'index import map should expose a lightweight browser ZIP dependency');
assert.ok(assetEditor.includes('GLTFLoader') && assetEditor.includes('URL.createObjectURL') && assetEditor.includes('visualOnly'), 'asset editor should support local GLB imports as visual-only placements');
assert.ok(assetEditor.includes('toolMode') && assetEditor.includes('paintTextureOnSurface') && assetEditor.includes('placeModelAtPoint'), 'asset editor should provide simple paint/place click modes');
assert.ok(assetEditor.includes('applyBrightnessToMaterial') && assetEditor.includes('applyModelBrightness') && assetEditor.includes('applySurfaceBrightness'), 'asset editor should provide surface and model brightness controls');
assert.ok(assetEditor.includes('handleEditorKeyboard') && assetEditor.includes('toggleEditorCollision') && assetEditor.includes('editorCollisionEnabled') && assetEditor.includes('isTypingInInput'), 'asset editor should handle keyboard editing, fly mode, and collision state');
assert.ok(main.includes('isEditorModeActive') && main.includes('updateEditorFlyMovement') && main.includes('assetEditor?.handleEditorKeyboard') && main.includes('assetEditor?.shouldUseEditorMovement'), 'main should route editor keyboard/fly movement before normal gameplay controls');
assert.ok(main.includes('applyPermanentEditorOverrides') && main.includes('clearPermanentEditorOverrides'), 'main should load and clear permanent editor map overrides');
assert.ok(editorPackage.includes('zipSync') && editorPackage.includes('buildCodexPackage') && editorPackage.includes('codex_import_prompt.txt') && editorPackage.includes('manifest.json') && editorPackage.includes('manifest.assets'), 'editor package export should create a real ZIP with manifest, assets, and prompt');
assert.ok(editorOverrides.includes('loadPermanentEditorOverrides') && editorOverrides.includes('applyPermanentEditorOverrides') && editorOverrides.includes('assets/editor_maps') && editorOverrides.includes('latest.json') && editorOverrides.includes('registerEditableObject') && editorOverrides.includes('data.assets?.textures') && editorOverrides.includes('placement.modelId'), 'permanent override loader should fetch static latest.json and register visual-only models');
assert.ok(importerScript.includes('import-editor-package') && importerScript.includes('assets/editor_maps') && importerScript.includes('latest.json') && importerScript.includes('inflateRawSync') && importerScript.includes('manifest.json') && importerScript.includes('manifest.assets?.textures'), 'importer script should unpack editor ZIPs and write permanent latest.json');
assert.ok(gitignore.includes('editor_imports/inbox/*.zip') && gitignore.includes('!editor_imports/inbox/.gitkeep'), 'gitignore should keep the inbox folder but ignore package ZIPs');
assert.equal(SHAPE_LIBRARY.length, 100, 'shape library should expose exactly 100 placeable choices for this request');
assert.deepEqual(SHAPE_CATEGORIES, ['Basic shapes', 'Architecture', 'Decorative shapes'], 'shape library should only include the requested three sections');
assert.deepEqual([...new Set(SHAPE_LIBRARY.map((shape) => shape.category))].sort(), ['Architecture', 'Basic shapes', 'Decorative shapes'].sort(), 'shape library should not include horror/lab, theme park, or bonus sections');
assert.ok(SHAPE_LIBRARY.every((shape) => shape.id && shape.name && shape.category && shape.defaultCollision === true), 'every built-in shape should be selectable and collision-enabled by default');
assert.ok(ui.includes('Map Maker') && ui.includes('Create New Map') && ui.includes('Edit Existing Map') && ui.includes('onOpenMapMaker'), 'main menu should expose a dedicated Map Maker setup flow');
assert.ok(main.includes('enterMapMaker') && main.includes('createBlankMapMakerLayout') && main.includes('mapMakerMode') && main.includes('assetEditor?.startMapMakerSession'), 'main should support a local-only map maker mode without a multiplayer lobby');
assert.ok(main.includes('getEditorCollisionColliders') && main.includes('assetEditor?.collisionColliders'), 'main wall resolution should include editor-created object collision boxes');
assert.ok(assetEditor.includes('importImage') && assetEditor.includes('placeImageAtPoint') && assetEditor.includes('image/gif') && assetEditor.includes('GIFs display as static'), 'asset editor should import images/GIFs as placeable planes and warn for static GIF display');
assert.ok(assetEditor.includes('isSupportedMime') && assetEditor.includes('loadImageElement') && assetEditor.includes('GIF loaded as static image in this version.'), 'asset upload validation should tolerate browser MIME quirks and use a clear GIF static fallback warning');
assert.ok(editorUI.includes('editor-texture-file') && editorUI.includes('editor-image-file') && editorUI.includes('editor-model-file') && editorUI.includes('resetFileInput') && editorUI.includes('My Textures') && editorUI.includes('My Images/GIFs') && editorUI.includes('My Models'), 'editor upload inputs should be wired to visible upload lists and reset after each import');
assert.ok(assetEditor.includes('selectShape') && assetEditor.includes('placeShapeAtPoint') && assetEditor.includes('SHAPE_LIBRARY') && assetEditor.includes('createShapeObject'), 'asset editor should expose a built-in shape placement workflow');
const removedEditableVolumePatterns = [
  'LIQUID_TYPES',
  'GAS_TYPES',
  'placeLiquidVolume',
  'placeGasVolume',
  'updateSelectedLiquidSettings',
  'updateSelectedGasSettings',
  'Liquid Settings',
  'Gas/Fog Settings',
  'placedLiquidVolumes',
  'placedGasVolumes',
  'createLiquidVolumeObject',
  'createGasVolumeObject',
  'getPermanentEditorVolumeEffects',
  'setPermanentEditorVolumeEffects',
  'updateVolumeEffects',
  'pointInsideVolume'
];
[assetEditor, editorUI, editorExport, editorPackage, editorOverrides, importerScript, main, readme].forEach((source) => {
  removedEditableVolumePatterns.forEach((pattern) => assert.ok(!source.includes(pattern), `editable liquid/gas volume feature should be removed: ${pattern}`));
});
assert.ok(assetEditor.includes('placeSunLight') && assetEditor.includes('updateSelectedSunSettings') && editorUI.includes('Sun / Main Light') && editorUI.includes('The Sun/Main Light is the main map light source'), 'asset editor should expose a movable/editable Sun/Main Light object');
assert.ok(editorState.includes('mapSettings') && editorUI.includes('Map Settings') && editorUI.includes('gravityMultiplier'), 'editor state and UI should include map-level gravity settings');
assert.ok(assetEditor.includes('AnimationMixer') && assetEditor.includes('animationMixers') && assetEditor.includes('autoplay'), 'asset editor should detect and autoplay animated GLBs where possible');
assert.ok(assetEditor.includes('toggleSelectedObjectCollision') && assetEditor.includes('collisionHelpersVisible') && assetEditor.includes('enterCollisionEditMode') && assetEditor.includes('resetSelectedCollisionBoxToObjectBounds') && assetEditor.includes('0x20ff66'), 'asset editor should support collision toggles, green helper boxes, and collision-box edit mode');
assert.ok(assetEditor.includes('copySelectedObject') && assetEditor.includes('event.ctrlKey') && assetEditor.includes("code === 'KeyC'"), 'Ctrl+C should duplicate the selected editor object with a new id');
assert.ok(assetEditor.includes("if (code === 'KeyS') return this.modelAction('move-forward'") && assetEditor.includes("if (code === 'KeyW') return this.modelAction('move-back'") && assetEditor.includes("if (code === 'KeyR') return this.modelAction('taller'") && assetEditor.includes("if (code === 'KeyG') return this.modelAction('thinner'"), 'selected object keyboard controls should match the requested PowerPoint-style mapping');
assert.ok(!editorUI.includes('<h3>Current Tool Mode</h3>') && !editorUI.includes('<h3>Placed Objects</h3>') && !editorUI.includes('<h3>Model Edit Controls</h3>'), 'editor UI should remove old bulky tool mode, placed objects, and model edit sections');
assert.ok(editorUI.includes('Shape Library') && editorUI.includes('Images / GIFs') && editorUI.includes('Map Package Type') && editorUI.includes('Selected Object') && editorUI.includes('Collision') && editorUI.includes('Editing: Collision Box'), 'editor UI should use simplified Map Maker sections and show object/collision editing status');
assert.ok(editorExport.includes('packageType') && editorExport.includes('displayName') && editorExport.includes('placedShapes') && editorExport.includes('placedImagePlanes') && editorExport.includes('sunLights') && editorExport.includes('mapSettings') && editorExport.includes('collisionBoxTransforms') && editorExport.includes('animation'), 'editor export should include map/update metadata and remaining placed object types/settings');
assert.ok(editorPackage.includes('images/') && editorPackage.includes('gifs/') && editorPackage.includes('packageType is newMap') && editorPackage.includes('map gravity settings') && editorPackage.includes('Sun/Main Light'), 'Codex package should include remaining systems and mention new-map/update behavior');
assert.ok(importerScript.includes('packageType') && importerScript.includes('newMap') && importerScript.includes('updateExistingMap') && importerScript.includes('images') && importerScript.includes('gifs') && importerScript.includes('mapSettings') && importerScript.includes('sunLights'), 'importer should preserve new-map/update packages and remaining light/map arrays');
assert.ok(editorOverrides.includes('applySunLightSettings') && editorOverrides.includes('mapSettings'), 'permanent override loader should keep sun lights and map settings');
assert.ok(main.includes('mapGravityMultiplier') && main.includes('mapGravityMoveMultiplier'), 'main should keep map gravity support without editable liquid/gas volume effects');
['Rule Beast Asset Editor', 'EDITOR MODE - LOCAL TESTING ONLY', 'Editor Mode: ON', 'Fly Mode: ON', 'Collision', 'Editor Fly Controls', 'Selected Model Controls', 'Export Editor JSON', 'Export Codex Package'].forEach((text) => {
  assert.ok(editorUI.includes(text), `editor UI should include ${text}`);
});
assert.ok(!`${assetEditor}\n${editorRegistry}\n${editorState}\n${editorExport}\n${editorPackage}\n${editorOverrides}\n${editorUI}`.match(/Cloudflare|R2|GitHub API|publishPresence|publishTopic/), 'editor modules must stay local-only and avoid cloud or multiplayer publishing');
