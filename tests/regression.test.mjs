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
assert.ok(hotel.stairConnections.length >= 6, 'hotel should include all requested stair route segments');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'main_guest_f1_f2' && stair.from.floor === 'floor1' && stair.to.floor === 'floor2'), 'hotel should connect Floor 1 to Floor 2 via main guest stairs');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'main_guest_f2_f3' && stair.from.floor === 'floor2' && stair.to.floor === 'floor3'), 'hotel should connect Floor 2 to Floor 3 via main guest stairs');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'service_b_f0_f1' && stair.from.floor === 'basement' && stair.to.floor === 'floor1'), 'hotel should connect Basement to Floor 1 via service stairs');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'service_b_f1_f2' && stair.from.floor === 'floor1' && stair.to.floor === 'floor2'), 'hotel should connect Floor 1 to Floor 2 via service stairs');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'emergency_c_f2_f3' && stair.from.floor === 'floor2' && stair.to.floor === 'floor3'), 'hotel should connect Floor 2 to Floor 3 via emergency stairs');
assert.ok(hotel.stairConnections.some((stair) => stair.id === 'basement_access_d' && stair.from.floor === 'basement' && stair.to.floor === 'floor1'), 'hotel should connect Basement to Floor 1 via basement access stairs');
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
