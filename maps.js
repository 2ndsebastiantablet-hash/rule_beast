export const DEFAULT_MAP_ID = 'default_bunker_lab';

const room = (name, x, z, w, d, color = 0x111824) => ({ name, x, z, w, d, color });
const corridor = (name, x, z, w, d, color = 0x0f1722) => ({ name, x, z, w, d, color });
const wall = (id, x, z, w, d) => ({ id, x, z, w, d });
const door = (id, x, z, roomName, rotation = 0) => ({ id, x, z, room: roomName, rotation });
const puzzle = (x, z, roomName, typeIndex) => ({ x, z, room: roomName, typeIndex });
const prop = (type, x, z, w, d, rotation = 0, height = 0.8) => ({ type, x, z, w, d, rotation, height });
const light = (x, z, color = 0x6eeeff, intensity = 0.72, distance = 7.2, flicker = false) => ({ x, z, color, intensity, distance, flicker });

export function createDefaultBunkerLabLayout(seed = 0) {
  // Recreated from the supplied top-down reference as an original Rule Beast bunker/lab.
  // Northwest top corridor strip: long upper run with a dead-end control pocket.
  const rooms = [
    room('Northwest Top Corridor Strip', -11.5, -15, 21, 4, 0x1a1d18),
    room('Upper Control Corridor', 1.5, -11, 12, 4.5, 0x151e24),

    // West storage block: stacked rooms and a tight vertical side route.
    room('West Storage Block', -18.5, -5.5, 8.5, 8, 0x171d18),
    room('West Generator Pocket', -19, 2.5, 7, 5, 0x1e1a14),
    room('Southwest Utility Room', -18.5, 12, 8.5, 6.5, 0x142533),

    // Central connector rooms: narrow rooms and bends between west, north, and lower loops.
    room('Central Connector Rooms', -5.5, 5.5, 5.2, 11, 0x141c24),
    room('Central Bunker Hall', 4, -2.5, 10.5, 12, 0x131a20),
    room('Central South Lock', 2, 7.5, 5, 5, 0x111820),

    // East wing: large right-side chamber and adjacent lab sections.
    room('Northeast Lab Wing', 15.5, -11, 8, 5, 0x172129),
    room('Large East Chamber', 16.5, -3.5, 10, 10, 0x171b18),
    room('East Airlock', 14.5, 5.5, 6, 5, 0x18181a),
    room('Southeast Utility Room', 21, 12, 7, 7, 0x1c1712),

    // Lower maintenance corridor: long bottom run that creates the lower loop from west to east.
    room('Lower Maintenance Corridor', 2, 15.5, 26, 3.5, 0x171510)
  ];

  const corridors = [
    corridor('West Vertical Service Run', -23, 1, 3, 22, 0x111820),
    corridor('West Block Cross Connector', -14, 0.5, 7, 3, 0x131a20),
    corridor('Upper Bend Into Hall', -5, -10.5, 4, 7, 0x121920),
    corridor('Central To East Chokepoint', 10.2, -4.8, 4.6, 3, 0x101820),
    corridor('East Chamber Lower Exit', 15.2, 7.2, 5.5, 3, 0x111920),
    corridor('Southeast Spur', 19, 9, 4, 5.5, 0x15140f),
    corridor('Southwest To Lower Run', -13, 14.2, 7, 3.2, 0x131820),
    corridor('Central Drop To Lower Run', -2, 11.3, 4, 7.2, 0x111820),
    corridor('Far Northeast Dead End', 22, -8.5, 4, 3.2, 0x121c20),
    corridor('Northwest Dead End Annex', -22, -12.5, 4, 4.5, 0x191a16)
  ];

  const walls = [
    // Outer bunker shell and silhouette blockers.
    wall('north-shell-a', -11, -18.2, 27, 1.1), wall('north-shell-b', 14, -14.2, 15, 1.1),
    wall('south-shell-a', -10, 18.4, 30, 1.1), wall('south-shell-b', 18, 16.2, 12, 1.1),
    wall('west-shell-a', -24.6, -5, 1.1, 27), wall('west-shell-b', -22.4, 10, 1.1, 10),
    wall('east-shell-a', 24.4, -3, 1.1, 14), wall('east-shell-b', 25.2, 11.5, 1.1, 9),
    wall('se-south-shell', 21, 15.7, 7.6, 1.1),

    // Northwest top strip and west block partitions.
    wall('nw-strip-south-left', -16, -12.1, 9, 1), wall('nw-strip-south-center', -3, -12.1, 7, 1),
    wall('nw-annex-cap', -20.2, -9.2, 7, 1), wall('upper-control-north', 2, -13.5, 11, 1),
    wall('upper-control-south', 2, -8.1, 8, 1), wall('west-storage-north', -18.5, -9.8, 8.5, 1),
    wall('west-storage-east', -13.6, -5.5, 1, 5.2), wall('west-storage-south-gap', -19.8, -1.2, 5, 1),
    wall('generator-pocket-east', -15.1, 2.5, 1, 4.2), wall('generator-pocket-south', -19, 5.8, 6, 1),
    wall('southwest-utility-north', -18.5, 8.3, 8.5, 1), wall('southwest-utility-east', -13.8, 11.8, 1, 4.5),

    // Central hall, connector rooms, and reference-like black voids.
    wall('central-hall-west-upper', -1.8, -6.8, 1, 5), wall('central-hall-west-lower', -1.8, 2.5, 1, 5),
    wall('central-hall-north', 4, -8.8, 9, 1), wall('central-hall-east-upper', 9.7, -4.7, 1, 5),
    wall('central-hall-east-lower', 9.7, 1.2, 1, 4.2), wall('central-void-nw', -7.8, -7.5, 6.8, 5.8),
    wall('central-void-south', 2.8, 10.9, 8.5, 4.2), wall('central-connector-west', -8.6, 5.6, 1, 9),
    wall('central-connector-east-lower', -2.5, 8.3, 1, 5), wall('central-lock-east', 5.3, 7.5, 1, 4.2),

    // East chamber, lab wing, and southeast utility structure.
    wall('east-chamber-north', 16.5, -9.2, 8, 1), wall('east-chamber-west-upper', 11.1, -5.3, 1, 4.8),
    wall('east-chamber-west-lower', 11.1, 2.3, 1, 3.5), wall('east-chamber-south', 17, 1.8, 7.6, 1),
    wall('ne-lab-south-left', 14.6, -8.1, 4.3, 1), wall('ne-lab-east', 20, -11, 1, 4.5),
    wall('east-airlock-south', 15.2, 8.4, 6, 1), wall('east-airlock-west', 11.2, 5.8, 1, 4.5),
    wall('se-room-west', 17, 12, 1, 5.3), wall('se-room-north', 21, 8.4, 6.2, 1),

    // Lower loop and dead-end blockers.
    wall('lower-corridor-north-a', -7.5, 12.9, 10, 1), wall('lower-corridor-north-b', 7.2, 12.9, 11, 1),
    wall('lower-corridor-south-a', -5, 17.8, 19, 1), wall('lower-corridor-south-b', 14, 17.8, 10, 1),
    wall('lower-east-notch', 13.5, 11.8, 1, 4.5), wall('west-service-inner', -21, 1.4, 1, 14),
    wall('northwest-black-pocket', -11.5, -10, 5, 4.2), wall('east-black-pocket', 10.5, 8.8, 6.5, 4.2)
  ];

  const doors = [
    door('west_storage_gate', -14.4, -1.1, 'West Storage Block', Math.PI / 2),
    door('generator_gate', -16, 0.5, 'West Generator Pocket', 0),
    door('sw_safe_gate', -13.7, 14.2, 'Southwest Utility Room', Math.PI / 2),
    door('upper_control_gate', -2.8, -10.5, 'Upper Control Corridor', 0),
    door('central_west_gate', -1.8, -0.7, 'Central Bunker Hall', Math.PI / 2),
    door('east_chamber_gate', 10.4, -4.8, 'Large East Chamber', Math.PI / 2),
    door('east_airlock_gate', 14.6, 7.9, 'East Airlock', 0),
    door('se_utility_gate', 18.2, 9.2, 'Southeast Utility Room', Math.PI / 2),
    door('lower_corridor_gate', -1.8, 13, 'Lower Maintenance Corridor', 0)
  ];

  const puzzles = [
    puzzle(-20.5, -6.6, 'West Storage Block', 0), puzzle(-17.4, -2.8, 'West Storage Block', 1),
    puzzle(-18.8, 2.3, 'West Generator Pocket', 2), puzzle(-19.8, 12.5, 'Southwest Utility Room', 3),
    puzzle(-15.8, 14.2, 'Southwest Utility Room', 4), puzzle(-16.2, -15.2, 'Northwest Top Corridor Strip', 5),
    puzzle(-5.4, -14.8, 'Northwest Top Corridor Strip', 6), puzzle(3.2, -10.8, 'Upper Control Corridor', 7),
    puzzle(-5.8, 5.1, 'Central Connector Rooms', 8), puzzle(-4.5, 9.4, 'Central Connector Rooms', 9),
    puzzle(1.5, -4.5, 'Central Bunker Hall', 10), puzzle(6.2, -1.6, 'Central Bunker Hall', 11),
    puzzle(3.2, 5.2, 'Central Bunker Hall', 12), puzzle(15.4, -11.6, 'Northeast Lab Wing', 13),
    puzzle(18.7, -11.2, 'Northeast Lab Wing', 14), puzzle(14.2, -4.8, 'Large East Chamber', 15),
    puzzle(18.9, -1.2, 'Large East Chamber', 16), puzzle(16.4, -0.2, 'Large East Chamber', 17),
    puzzle(15.5, 6.3, 'East Airlock', 18), puzzle(20.7, 10.5, 'Southeast Utility Room', 19),
    puzzle(22.3, 13.2, 'Southeast Utility Room', 20), puzzle(-3.2, 15.5, 'Lower Maintenance Corridor', 21),
    puzzle(5.6, 15.4, 'Lower Maintenance Corridor', 22), puzzle(11.4, 15.2, 'Lower Maintenance Corridor', 23)
  ];

  const props = [
    prop('generator', -20.5, 2.2, 1.8, 1.2, 0.25, 1.1), prop('pipe', -23, -4.5, 0.25, 8, 0, 0.35),
    prop('crate', -20.8, -7.6, 1.1, 1.1), prop('crate', -17.7, -7.4, 1.1, 1.1),
    prop('server', -18.8, -4.4, 0.9, 2.4, 0, 1.7), prop('server', -14.8, -15.3, 0.9, 2.5, Math.PI / 2, 1.6),
    prop('labTable', 1, -11.2, 3, 1.1, 0.08, 0.75), prop('warning', 5.5, -8.5, 1.1, 0.2, 0, 0.55),
    prop('containment', 4.8, -3.8, 1.5, 1.5, 0, 1.8), prop('labTable', 5.4, 1.8, 3, 1.1, Math.PI / 2, 0.75),
    prop('crate', -5.5, 7.3, 1.1, 1.1), prop('pipe', -8.4, 5, 0.22, 8, 0, 0.3),
    prop('server', 14.1, -12.1, 0.9, 2.8, Math.PI / 2, 1.7), prop('labTable', 17, -10.4, 3.4, 1, 0.2, 0.75),
    prop('containment', 17.2, -3.2, 2, 2, 0, 1.9), prop('labTable', 14.5, -0.5, 3.2, 1.2, Math.PI / 2, 0.75),
    prop('pipe', 20.6, -2.5, 0.22, 7.5, 0, 0.3), prop('warning', 11.6, -4.8, 1.1, 0.2, Math.PI / 2, 0.55),
    prop('crate', 13.5, 6.6, 1.2, 1.2), prop('server', 20.6, 11, 0.9, 2.2, 0, 1.6),
    prop('crate', 22.4, 14, 1.1, 1.1), prop('generator', 21.5, 12.8, 1.7, 1.2, -0.25, 1.1),
    prop('pipe', 2.5, 16.4, 9, 0.25, 0, 0.28), prop('crate', 8.5, 15.4, 1.1, 1.1)
  ];

  const lights = [
    light(-18, -15, 0xcfd6b2, 0.55, 6.2), light(-4, -14.5, 0xbfc9ad, 0.52, 6),
    light(2, -10.5, 0x65e7ff, 0.58, 6), light(-19, -5.5, 0x65e7ff, 0.58, 6.5),
    light(-20, 2.8, 0xff475d, 0.42, 5.5, true), light(-18, 12.3, 0x6eeeff, 0.62, 6.5),
    light(-5, 5.8, 0x9df6ff, 0.48, 5.6), light(3.6, -2.4, 0xd6d2ac, 0.62, 7.2),
    light(6.4, 3.5, 0x6eeeff, 0.45, 5.8, true), light(15.8, -10.5, 0x8cf4ff, 0.54, 6.2),
    light(17.2, -3.2, 0xd7d0a5, 0.58, 7.5), light(19.6, 1.2, 0xff3c55, 0.36, 5.5, true),
    light(14.4, 6.8, 0x6eeeff, 0.5, 5.6), light(21.8, 12.2, 0xd6c389, 0.58, 6.4),
    light(-3.5, 15.4, 0xb9c5aa, 0.48, 6.5), light(8.8, 15.4, 0xb9c5aa, 0.48, 6.5)
  ];

  return {
    id: DEFAULT_MAP_ID,
    seed,
    bounds: { x: 0, z: 0, w: 54, d: 48 },
    rooms,
    corridors,
    walls,
    doors,
    props,
    lights,
    puzzles,
    survivorSpawn: { x: -18.8, z: 12.3 },
    monsterSpawn: { x: 18.8, z: -11.2 }
  };
}
