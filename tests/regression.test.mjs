import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const entities = readFileSync(new URL('../entities.js', import.meta.url), 'utf8');
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
assert.ok(main.includes('selectedMapId'), 'main should track the host selected map id');
assert.ok(main.includes('mapId'), 'multiplayer events and presence should carry map ids');
assert.ok(main.includes('generateMapLayout(seed, mapId)'), 'matches should rebuild the selected map through generateMapLayout');
assert.ok(entities.includes("from './maps.js'"), 'entities should use the dedicated default bunker map definition');
