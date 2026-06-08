export const DEFAULT_MAP_ID = 'default_bunker_lab';
export const AMUSEMENT_PARK_MAP_ID = 'amusement_park';
export const HOTEL_MAP_ID = 'hotel';
export const WALL_GRID_SIZE = 0.5;
export const WALL_THICKNESS = 0.55;
export const WALL_OVERLAP = 0.08;

export const MAP_OPTIONS = [
  { id: DEFAULT_MAP_ID, name: 'Bunker Lab' },
  { id: AMUSEMENT_PARK_MAP_ID, name: 'Amusement Park' },
  { id: HOTEL_MAP_ID, name: 'Hotel' }
];

export function snapToGrid(value, gridSize = WALL_GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

// Future maps should create walls through this helper. Wall boxes are snapped to a
// shared grid and slightly extended along their long axis, so touching segments
// overlap visually and physically instead of leaving tiny walkable seams.
export function createWallSegment(id, x, z, w, d, y = 0, floor = 'ground') {
  const snapped = {
    id,
    x: snapToGrid(x),
    z: snapToGrid(z),
    y,
    floor,
    w: Math.max(WALL_THICKNESS, snapToGrid(w)),
    d: Math.max(WALL_THICKNESS, snapToGrid(d))
  };
  if (snapped.w >= snapped.d) snapped.w += WALL_OVERLAP;
  else snapped.d += WALL_OVERLAP;
  return snapped;
}

const room = (name, x, z, w, d, color = 0x111824, y = 0, floor = 'ground') => ({ name, x, z, y, floor, w, d, color });
const corridor = (name, x, z, w, d, color = 0x0f1722, y = 0, floor = 'ground') => ({ name, x, z, y, floor, w, d, color });
const grass = (name, x, z, w, d, color = 0x102817, y = 0, floor = 'ground') => ({ name, x, z, y, floor, w, d, color });
const wall = (...args) => createWallSegment(...args);
const door = (id, x, z, roomName, rotation = 0, y = 0, floor = 'ground') => ({ id, x, z, y, floor, room: roomName, rotation });
const puzzle = (x, z, roomName, typeIndex, zone = roomName, floor = 'ground', y = 0) => ({ x, z, y, floor, zone, room: roomName, typeIndex });
const light = (x, z, color = 0x6eeeff, intensity = 0.72, distance = 7.2, flicker = false, y = 0, floor = 'ground') => ({ x, z, y, floor, color, intensity, distance, flicker });

export function createDefaultBunkerLabLayout(seed = 0) {
  // Recreated from the supplied bunker reference as an original Rule Beast layout.
  const rooms = [
    room('Northwest Top Corridor Strip', -11.5, -15, 21, 4, 0x1a1d18),
    room('Upper Control Corridor', 1.5, -11, 12, 4.5, 0x151e24),
    room('West Storage Block', -18.5, -5.5, 8.5, 8, 0x171d18),
    room('West Generator Pocket', -19, 2.5, 7, 5, 0x1e1a14),
    room('Southwest Utility Room', -18.5, 12, 8.5, 6.5, 0x142533),
    room('Central Connector Rooms', -5.5, 5.5, 5.2, 11, 0x141c24),
    room('Central Bunker Hall', 4, -2.5, 10.5, 12, 0x131a20),
    room('Central South Lock', 2, 7.5, 5, 5, 0x111820),
    room('Northeast Lab Wing', 15.5, -11, 8, 5, 0x172129),
    room('Large East Chamber', 16.5, -3.5, 10, 10, 0x171b18),
    room('East Airlock', 14.5, 5.5, 6, 5, 0x18181a),
    room('Southeast Utility Room', 21, 12, 7, 7, 0x1c1712),
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
    wall('north-shell-a', -11, -18.2, 27, 1.1), wall('north-shell-b', 14, -14.2, 15, 1.1),
    wall('south-shell-a', -10, 18.4, 30, 1.1), wall('south-shell-b', 18, 16.2, 12, 1.1),
    wall('west-shell-a', -24.6, -5, 1.1, 27), wall('west-shell-b', -22.4, 10, 1.1, 10),
    wall('east-shell-a', 24.4, -3, 1.1, 14), wall('east-shell-b', 25.2, 11.5, 1.1, 9),
    wall('se-south-shell', 21, 15.7, 7.6, 1.1),
    wall('nw-strip-south-left', -16, -12.1, 9, 1), wall('nw-strip-south-center', -3, -12.1, 7, 1),
    wall('nw-annex-cap', -20.2, -9.2, 7, 1), wall('upper-control-north', 2, -13.5, 11, 1),
    wall('upper-control-south', 2, -8.1, 8, 1), wall('west-storage-north', -18.5, -9.8, 8.5, 1),
    wall('west-storage-east', -13.6, -5.5, 1, 5.2), wall('west-storage-south-gap', -19.8, -1.2, 5, 1),
    wall('generator-pocket-east', -15.1, 2.5, 1, 4.2), wall('generator-pocket-south', -19, 5.8, 6, 1),
    wall('southwest-utility-north', -18.5, 8.3, 8.5, 1), wall('southwest-utility-east', -13.8, 11.8, 1, 4.5),
    wall('central-hall-west-upper', -1.8, -6.8, 1, 5), wall('central-hall-west-lower', -1.8, 2.5, 1, 5),
    wall('central-hall-north', 4, -8.8, 9, 1), wall('central-hall-east-upper', 9.7, -4.7, 1, 5),
    wall('central-hall-east-lower', 9.7, 1.2, 1, 4.2), wall('central-void-nw', -7.8, -7.5, 6.8, 5.8),
    wall('central-void-south', 2.8, 10.9, 8.5, 4.2), wall('central-connector-west', -8.6, 5.6, 1, 9),
    wall('central-connector-east-lower', -2.5, 8.3, 1, 5), wall('central-lock-east', 5.3, 7.5, 1, 4.2),
    wall('east-chamber-north', 16.5, -9.2, 8, 1), wall('east-chamber-west-upper', 11.1, -5.3, 1, 4.8),
    wall('east-chamber-west-lower', 11.1, 2.3, 1, 3.5), wall('east-chamber-south', 17, 1.8, 7.6, 1),
    wall('ne-lab-south-left', 14.6, -8.1, 4.3, 1), wall('ne-lab-east', 20, -11, 1, 4.5),
    wall('east-airlock-south', 15.2, 8.4, 6, 1), wall('east-airlock-west', 11.2, 5.8, 1, 4.5),
    wall('se-room-west', 17, 12, 1, 5.3), wall('se-room-north', 21, 8.4, 6.2, 1),
    wall('lower-corridor-north-a', -7.5, 12.9, 10, 1), wall('lower-corridor-north-b', 7.2, 12.9, 11, 1),
    wall('lower-corridor-south-a', -5, 17.8, 19, 1), wall('lower-corridor-south-b', 14, 17.8, 10, 1),
    wall('lower-east-notch', 13.5, 11.8, 1, 4.5), wall('west-service-inner', -21, 1.4, 1, 14),
    wall('northwest-black-pocket', -11.5, -10, 5, 4.2), wall('east-black-pocket', 10.5, 8.8, 6.5, 4.2)
  ];

  const doors = [
    door('west_storage_gate', -14.4, -1.1, 'West Storage Block', Math.PI / 2),
    door('generator_gate', -16, 0.5, 'West Generator Pocket'),
    door('sw_safe_gate', -13.7, 14.2, 'Southwest Utility Room', Math.PI / 2),
    door('upper_control_gate', -2.8, -10.5, 'Upper Control Corridor'),
    door('central_west_gate', -1.8, -0.7, 'Central Bunker Hall', Math.PI / 2),
    door('east_chamber_gate', 10.4, -4.8, 'Large East Chamber', Math.PI / 2),
    door('east_airlock_gate', 14.6, 7.9, 'East Airlock'),
    door('se_utility_gate', 18.2, 9.2, 'Southeast Utility Room', Math.PI / 2),
    door('lower_corridor_gate', -1.8, 13, 'Lower Maintenance Corridor')
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
    grass: [],
    walls,
    doors,
    props: [],
    lights,
    lighting: {
      fogColor: 0x070a13,
      fogDensity: 0.034,
      ambientIntensity: 0.36,
      hemiIntensity: 0.52,
      keyIntensity: 0.82,
      pointIntensityMultiplier: 1.28
    },
    puzzles,
    puzzleSlots: puzzles,
    survivorSpawn: { x: -18.8, z: 12.3 },
    monsterSpawn: { x: 18.8, z: -11.2 }
  };
}

export function createAmusementParkLayout(seed = 0) {
  // Basic path network only: no rides, stores, or detailed objects yet.
  const rooms = [
    room('Open Midway', 0, 0, 19, 13, 0x1a2418),
    room('North Park Plaza', -4, -13, 18, 7, 0x172519),
    room('East Picnic Loop', 15, -4, 11, 9, 0x172a18),
    room('South Waterfront Walk', -1, 14, 23, 6, 0x152619),
    room('West Entrance Green', -18, 3, 10, 12, 0x152619)
  ];

  const corridors = [
    corridor('Main Curved Walk A', -11, -6, 14, 3.8, 0xd9c99b),
    corridor('Main Curved Walk B', 1, -8, 13, 3.8, 0xd9c99b),
    corridor('Main Curved Walk C', 12, -5, 12, 3.8, 0xd9c99b),
    corridor('East Loop North', 17, -10, 7, 3.2, 0xd9c99b),
    corridor('East Loop South', 18, 2, 8, 3.2, 0xd9c99b),
    corridor('Central S Curve', 4, 4, 13, 3.6, 0xd9c99b),
    corridor('West Loop Path', -16, 4, 12, 3.4, 0xd9c99b),
    corridor('South Sweep West', -11, 12, 13, 3.6, 0xd9c99b),
    corridor('South Sweep East', 7, 13, 17, 3.6, 0xd9c99b),
    corridor('Waterfront Bend', 17, 16, 11, 3.4, 0xd9c99b),
    corridor('North Connector', -3, -2, 4, 13, 0xd9c99b),
    corridor('South Connector', -3, 7, 4, 9, 0xd9c99b),
    corridor('West Entrance Connector', -22, 0, 6, 3.2, 0xd9c99b)
  ];

  const grassSections = [
    grass('Northwest Grass', -17, -13, 9, 8), grass('North Central Grass', 5, -15, 11, 5),
    grass('Northeast Grass', 20, -11, 8, 7), grass('East Grove', 21, 6, 7, 8),
    grass('Central Lawn', 7, 0, 8, 7), grass('West Lawn', -17, -2, 8, 7),
    grass('Southwest Lawn', -15, 13, 9, 6), grass('South Central Lawn', 2, 16, 9, 5),
    grass('Southeast Lawn', 18, 13, 8, 5)
  ];

  const walls = [
    wall('park-north-boundary', 0, -22, 52, 1.1), wall('park-south-boundary', 0, 22, 52, 1.1),
    wall('park-west-boundary', -26, 0, 1.1, 44), wall('park-east-boundary', 26, 0, 1.1, 44),
    wall('northwest-tree-line', -21, -12, 1.1, 9), wall('northeast-tree-line', 22, -12, 1.1, 8),
    wall('east-corner-fence', 22, 8, 1.1, 10), wall('southwest-water-edge', -15, 18, 14, 1.1),
    wall('south-water-edge', 4, 18, 12, 1.1), wall('southeast-water-edge', 19, 18, 10, 1.1),
    wall('west-entry-rail-top', -21, -2, 7, 1.1), wall('west-entry-rail-bottom', -21, 3, 7, 1.1)
  ];

  const puzzles = [
    puzzle(-20, 0, 'West Entrance Green', 0), puzzle(-16, 7, 'West Entrance Green', 1),
    puzzle(-12, -7, 'Main Curved Walk A', 2), puzzle(-5, -14, 'North Park Plaza', 3),
    puzzle(5, -12, 'North Park Plaza', 4), puzzle(13, -7, 'Main Curved Walk C', 5),
    puzzle(19, -10, 'East Picnic Loop', 6), puzzle(20, 1, 'East Picnic Loop', 7),
    puzzle(8, 2, 'Open Midway', 8), puzzle(-1, 1, 'Open Midway', 9),
    puzzle(-4, 7, 'South Connector', 10), puzzle(-13, 13, 'South Sweep West', 11),
    puzzle(2, 14, 'South Waterfront Walk', 12), puzzle(10, 14, 'South Sweep East', 13),
    puzzle(19, 15, 'Waterfront Bend', 14), puzzle(0, -5, 'North Connector', 15)
  ];

  const lights = [
    light(-18, 0, 0xd7ffc0, 0.48, 8), light(-8, -7, 0xd7ffc0, 0.45, 8),
    light(0, -12, 0xd7ffc0, 0.48, 8), light(10, -6, 0xd7ffc0, 0.45, 8),
    light(19, -4, 0xd7ffc0, 0.5, 8), light(4, 2, 0xd7ffc0, 0.46, 8),
    light(-8, 10, 0xd7ffc0, 0.44, 8), light(8, 13, 0xd7ffc0, 0.48, 8),
    light(19, 15, 0x84e8ff, 0.42, 8)
  ];

  return {
    id: AMUSEMENT_PARK_MAP_ID,
    seed,
    bounds: { x: 0, z: 0, w: 54, d: 48 },
    rooms,
    corridors,
    grass: grassSections,
    walls,
    doors: [],
    props: [],
    lights,
    lighting: {
      fogColor: 0x09120f,
      fogDensity: 0.028,
      ambientIntensity: 0.44,
      hemiIntensity: 0.62,
      keyIntensity: 1.02,
      pointIntensityMultiplier: 1.15
    },
    puzzles,
    puzzleSlots: puzzles,
    survivorSpawn: { x: -21, z: 1 },
    monsterSpawn: { x: 20, z: -11 }
  };
}

export function createHotelLayout(seed = 0) {
  const floors = [
    { id: 'basement', name: 'Basement', y: -4, bounds: { x: 0, z: 0, w: 54, d: 48 } },
    { id: 'floor1', name: 'Floor 1 / Lobby', y: 0, bounds: { x: 0, z: 0, w: 54, d: 48 } },
    { id: 'floor2', name: 'Floor 2 / Guest Suites', y: 4, bounds: { x: 0, z: 0, w: 54, d: 48 } },
    { id: 'floor3', name: 'Floor 3 / Event Lounge', y: 8, bounds: { x: 0, z: 0, w: 54, d: 48 } }
  ];
  const floorY = Object.fromEntries(floors.map((floorInfo) => [floorInfo.id, floorInfo.y]));
  const r = (floor, name, x, z, w, d, color) => room(name, x, z, w, d, color, floorY[floor], floor);
  const c = (floor, name, x, z, w, d, color) => corridor(name, x, z, w, d, color, floorY[floor], floor);
  const w = (floor, id, x, z, width, depth) => wall(`${floor}-${id}`, x, z, width, depth, floorY[floor], floor);
  const d = (floor, id, x, z, roomName, rotation = 0) => door(`${floor}-${id}`, x, z, roomName, rotation, floorY[floor], floor);
  const p = (floor, zone, x, z, roomName, typeIndex) => puzzle(x, z, roomName, typeIndex, zone, floor, floorY[floor]);
  const l = (floor, x, z, color, intensity, distance, flicker = false) => light(x, z, color, intensity, distance, flicker, floorY[floor], floor);

  const rooms = [
    r('basement', 'Basement Central Lounge', 0, 0, 20, 14, 0x11151c),
    r('basement', 'Basement West Dead-End Room', -18, -4, 8, 10, 0x10131a),
    r('basement', 'Basement Bath Utility', -18, 12, 8, 7, 0x101923),
    r('basement', 'Basement Security Room', 16, -2, 10, 8, 0x101923),
    r('basement', 'Basement Staff Utility', 18, 10, 10, 9, 0x17150f),
    r('basement', 'Basement Angled Service Hall', 14, -13, 14, 5, 0x121922),
    r('floor1', 'Ground Lobby Hall', 0, 2, 20, 13, 0x1c1712),
    r('floor1', 'Front Desk Reception', -9, -7, 10, 6, 0x1f1512),
    r('floor1', 'Lobby Lounge', 13, -5, 10, 7, 0x181e1a),
    r('floor1', 'Service Hallway', -15, 8, 13, 4, 0x101820),
    r('floor1', 'Back Office', -21, 10, 7, 8, 0x111923),
    r('floor1', 'Ground Bath Utility', 18, 10, 8, 7, 0x101923),
    r('floor1', 'Main Entrance Vestibule', 0, 16, 16, 5, 0x1d1a13),
    r('floor2', 'Floor 2 Central Common', 0, 0, 15, 15, 0x1d1913),
    r('floor2', 'Floor 2 Left Guest Wing', -17, 0, 12, 22, 0x171b16),
    r('floor2', 'Floor 2 Right Guest Wing', 17, 0, 12, 22, 0x171b16),
    r('floor2', 'Floor 2 North Baths', 0, -13, 16, 6, 0x111923),
    r('floor2', 'Floor 2 South Balcony Hall', 0, 13, 16, 6, 0x171510),
    r('floor2', 'Floor 2 West Suite Loop', -20, 11, 8, 8, 0x151b20),
    r('floor2', 'Floor 2 East Suite Loop', 20, 11, 8, 8, 0x151b20),
    r('floor3', 'Floor 3 Banquet Lounge', 0, 2, 23, 14, 0x20170f),
    r('floor3', 'Floor 3 Curved Hall', 0, -13, 22, 8, 0x1c1712),
    r('floor3', 'Floor 3 Left Suite', -20, 3, 9, 12, 0x151b20),
    r('floor3', 'Floor 3 Right Chamber', 20, 2, 10, 12, 0x151b20),
    r('floor3', 'Floor 3 South Gallery', 0, 14, 14, 5, 0x171510)
  ];

  const corridors = [
    c('basement', 'Basement West Loop', -10, 7, 9, 3.5, 0x111820),
    c('basement', 'Basement East Connector', 9, 7, 11, 3.5, 0x111820),
    c('basement', 'Basement South Service Run', -4, 14, 12, 3, 0x101820),
    c('floor1', 'Lobby West Service Connector', -11, 2, 8, 3.4, 0x121a20),
    c('floor1', 'Lobby East Utility Connector', 12, 4, 9, 3.4, 0x121a20),
    c('floor1', 'Lobby Back Hall Connector', -10, 12, 12, 3.2, 0x101820),
    c('floor2', 'Floor 2 Left Hall Loop', -12, 0, 4, 18, 0x111820),
    c('floor2', 'Floor 2 Right Hall Loop', 12, 0, 4, 18, 0x111820),
    c('floor2', 'Floor 2 North Connector', 0, -8, 24, 3.5, 0x111820),
    c('floor2', 'Floor 2 South Connector', 0, 8, 24, 3.5, 0x111820),
    c('floor3', 'Floor 3 West Connector', -13, 2, 8, 3.5, 0x111820),
    c('floor3', 'Floor 3 East Connector', 13, 2, 8, 3.5, 0x111820),
    c('floor3', 'Floor 3 Curved Left Chord', -10, -9, 8, 3.4, 0x1d1712),
    c('floor3', 'Floor 3 Curved Right Chord', 10, -9, 8, 3.4, 0x1d1712)
  ];

  const walls = [
    w('basement', 'north-boundary', 0, -20, 48, 1.1), w('basement', 'south-boundary', 0, 20, 48, 1.1),
    w('basement', 'west-boundary', -24, 0, 1.1, 40), w('basement', 'east-boundary', 24, 0, 1.1, 40),
    w('basement', 'west-room-east', -13.5, -4, 1.1, 10), w('basement', 'west-room-south', -18, 1.5, 8, 1.1),
    w('basement', 'bath-east', -13.5, 12, 1.1, 7), w('basement', 'central-north', 0, -7.5, 19, 1.1),
    w('basement', 'central-south', 0, 7.5, 18, 1.1), w('basement', 'security-west', 10.5, -2, 1.1, 8),
    w('basement', 'utility-west', 12.5, 10, 1.1, 9), w('basement', 'angled-hall-south', 15, -9.5, 14, 1.1),
    w('floor1', 'north-boundary', 0, -20, 48, 1.1), w('floor1', 'south-boundary', 0, 20, 48, 1.1),
    w('floor1', 'west-boundary', -24, 0, 1.1, 40), w('floor1', 'east-boundary', 24, 0, 1.1, 40),
    w('floor1', 'reception-south', -9, -3.7, 10, 1.1), w('floor1', 'lounge-south', 13, -1.2, 10, 1.1),
    w('floor1', 'service-east', -8.5, 8, 1.1, 4), w('floor1', 'back-office-east', -16.5, 10, 1.1, 8),
    w('floor1', 'bath-west', 13.5, 10, 1.1, 7), w('floor1', 'lobby-north', 0, -4.6, 12, 1.1),
    w('floor1', 'vestibule-north', 0, 13.4, 12, 1.1),
    w('floor2', 'north-boundary', 0, -21, 50, 1.1), w('floor2', 'south-boundary', 0, 21, 50, 1.1),
    w('floor2', 'west-boundary', -25, 0, 1.1, 42), w('floor2', 'east-boundary', 25, 0, 1.1, 42),
    w('floor2', 'left-wing-east-upper', -10.5, -7, 1.1, 9), w('floor2', 'left-wing-east-lower', -10.5, 8, 1.1, 9),
    w('floor2', 'right-wing-west-upper', 10.5, -7, 1.1, 9), w('floor2', 'right-wing-west-lower', 10.5, 8, 1.1, 9),
    w('floor2', 'central-north', 0, -7.7, 14, 1.1), w('floor2', 'central-south', 0, 7.7, 14, 1.1),
    w('floor2', 'left-suite-split-a', -17, -5, 10, 1.1), w('floor2', 'left-suite-split-b', -17, 5, 10, 1.1),
    w('floor2', 'right-suite-split-a', 17, -5, 10, 1.1), w('floor2', 'right-suite-split-b', 17, 5, 10, 1.1),
    w('floor2', 'bath-south', 0, -10, 15, 1.1), w('floor2', 'balcony-north', 0, 10, 15, 1.1),
    w('floor3', 'north-boundary-a', -12, -20, 24, 1.1), w('floor3', 'north-boundary-b', 12, -20, 24, 1.1),
    w('floor3', 'south-boundary', 0, 20, 48, 1.1), w('floor3', 'west-boundary', -24, 0, 1.1, 40),
    w('floor3', 'east-boundary', 24, 0, 1.1, 40), w('floor3', 'curved-left-facet', -14, -15.5, 1.1, 8),
    w('floor3', 'curved-right-facet', 14, -15.5, 1.1, 8), w('floor3', 'curved-hall-south', 0, -8.5, 20, 1.1),
    w('floor3', 'banquet-south', 0, 9, 20, 1.1), w('floor3', 'left-suite-east', -15, 3, 1.1, 10),
    w('floor3', 'right-chamber-west', 15, 2, 1.1, 10), w('floor3', 'gallery-north', 0, 11.5, 12, 1.1)
  ];

  const doors = [
    d('basement', 'west-dead-end-door', -13.5, -1, 'Basement West Dead-End Room', Math.PI / 2),
    d('basement', 'bath-door', -13.5, 10, 'Basement Bath Utility', Math.PI / 2),
    d('basement', 'security-door', 10.5, 1, 'Basement Security Room', Math.PI / 2),
    d('floor1', 'reception-door', -6, -3.7, 'Front Desk Reception'),
    d('floor1', 'back-office-door', -16.5, 7, 'Back Office', Math.PI / 2),
    d('floor1', 'bath-door', 13.5, 8.5, 'Ground Bath Utility', Math.PI / 2),
    d('floor2', 'left-upper-door', -10.5, -2, 'Floor 2 Left Guest Wing', Math.PI / 2),
    d('floor2', 'right-upper-door', 10.5, -2, 'Floor 2 Right Guest Wing', Math.PI / 2),
    d('floor2', 'left-suite-door', -12, 8, 'Floor 2 West Suite Loop'),
    d('floor2', 'right-suite-door', 12, 8, 'Floor 2 East Suite Loop'),
    d('floor3', 'left-suite-door', -15, 0, 'Floor 3 Left Suite', Math.PI / 2),
    d('floor3', 'right-chamber-door', 15, 0, 'Floor 3 Right Chamber', Math.PI / 2)
  ];

  const puzzles = [
    p('basement', 'basement_west', -18, -6, 'Basement West Dead-End Room', 0),
    p('basement', 'basement_security', 17, -4, 'Basement Security Room', 1),
    p('basement', 'basement_utility', 18, 10, 'Basement Staff Utility', 2),
    p('floor1', 'floor1_lobby', -2, 3, 'Ground Lobby Hall', 3),
    p('floor1', 'floor1_reception', -10, -7, 'Front Desk Reception', 4),
    p('floor1', 'floor1_service', -20, 10, 'Back Office', 5),
    p('floor2', 'floor2_left_wing', -18, -8, 'Floor 2 Left Guest Wing', 6),
    p('floor2', 'floor2_left_loop', -20, 11, 'Floor 2 West Suite Loop', 7),
    p('floor2', 'floor2_common', 0, 0, 'Floor 2 Central Common', 8),
    p('floor2', 'floor2_right_wing', 18, -8, 'Floor 2 Right Guest Wing', 9),
    p('floor2', 'floor2_right_loop', 20, 11, 'Floor 2 East Suite Loop', 10),
    p('floor3', 'floor3_lounge', -4, 2, 'Floor 3 Banquet Lounge', 11),
    p('floor3', 'floor3_curved_hall', 0, -13, 'Floor 3 Curved Hall', 12),
    p('floor3', 'floor3_left_suite', -20, 3, 'Floor 3 Left Suite', 13),
    p('floor3', 'floor3_right_chamber', 20, 2, 'Floor 3 Right Chamber', 14)
  ];

  const lights = [
    l('basement', -12, -4, 0x6aa9ff, 0.34, 6.2, true), l('basement', 0, 0, 0x5d8cff, 0.32, 7.2, true),
    l('basement', 17, -4, 0x67dfff, 0.36, 6.2), l('basement', 17, 10, 0xff3c55, 0.28, 5.5, true),
    l('floor1', -8, -6, 0xd5aa67, 0.48, 7), l('floor1', 0, 3, 0xd5aa67, 0.55, 8),
    l('floor1', 12, -5, 0xd5aa67, 0.45, 7), l('floor1', -18, 10, 0x6eeeff, 0.42, 6),
    l('floor2', -17, -7, 0xc6b37a, 0.46, 7), l('floor2', 0, 0, 0xe0b66c, 0.54, 8),
    l('floor2', 17, -7, 0xc6b37a, 0.46, 7), l('floor2', 0, 12, 0x6eeeff, 0.38, 6),
    l('floor3', 0, -13, 0xe0b66c, 0.56, 8), l('floor3', 0, 2, 0xffc172, 0.62, 9),
    l('floor3', -20, 3, 0x6eeeff, 0.38, 6), l('floor3', 20, 2, 0xff4967, 0.34, 6, true)
  ];

  // Stairs are currently explicit teleport stairwells. Each non-basement floor
  // keeps at most one upward and one downward stair endpoint, so routes stay
  // readable and the existing first-person controller does not need ramps yet.
  const stairConnections = [
    { id: 'main_guest_f1_f2', name: 'Main guest stairs', from: { x: 1, y: 0, z: 3, floor: 'floor1', label: 'Floor 1' }, to: { x: 0, y: 4, z: 0, floor: 'floor2', label: 'Floor 2' } },
    { id: 'emergency_c_f2_f3', name: 'Emergency stairs', from: { x: 18, y: 4, z: -4, floor: 'floor2', label: 'Floor 2' }, to: { x: 18, y: 8, z: -2, floor: 'floor3', label: 'Floor 3' } },
    { id: 'basement_access_d', name: 'Basement access stairs', from: { x: -5, y: -4, z: 14, floor: 'basement', label: 'Basement' }, to: { x: -8, y: 0, z: 16, floor: 'floor1', label: 'Floor 1' } }
  ];

  return {
    id: HOTEL_MAP_ID,
    seed,
    bounds: { x: 0, z: 0, w: 54, d: 48 },
    floors,
    rooms,
    corridors,
    grass: [],
    walls,
    doors,
    props: [],
    lights,
    lighting: {
      fogColor: 0x080711,
      fogDensity: 0.032,
      ambientIntensity: 0.4,
      hemiIntensity: 0.56,
      keyIntensity: 0.74,
      pointIntensityMultiplier: 1.34
    },
    puzzles,
    puzzleSlots: puzzles,
    stairConnections,
    survivorSpawns: [
      { x: -3, y: 0, z: 15, floor: 'floor1' },
      { x: 3, y: 0, z: 15, floor: 'floor1' },
      { x: -16, y: 4, z: 12, floor: 'floor2' },
      { x: 16, y: 4, z: 12, floor: 'floor2' }
    ],
    survivorSpawn: { x: -3, y: 0, z: 15, floor: 'floor1' },
    monsterSpawn: { x: 18, y: -4, z: -12, floor: 'basement' }
  };
}

export function createMapLayout(mapId = DEFAULT_MAP_ID, seed = 0) {
  if (mapId === AMUSEMENT_PARK_MAP_ID) return createAmusementParkLayout(seed);
  if (mapId === HOTEL_MAP_ID) return createHotelLayout(seed);
  return createDefaultBunkerLabLayout(seed);
}
