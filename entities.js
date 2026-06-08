import * as THREE from 'three';
import { PUZZLE_TYPES } from './data.js';
import { createMapLayout } from './maps.js';

const cyan = new THREE.Color(0x40f6ff);
const red = new THREE.Color(0xff153e);

export function createMaterials() {
  return {
    floor: new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.82, metalness: 0.1 }),
    room: new THREE.MeshStandardMaterial({ color: 0x111824, roughness: 0.88, metalness: 0.05, transparent: true, opacity: 0.82 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x121827, roughness: 0.9, metalness: 0.05 }),
    wallTrim: new THREE.MeshStandardMaterial({ color: 0x2b1020, emissive: 0x210008, emissiveIntensity: 0.35, roughness: 0.65 }),
    survivor: new THREE.MeshStandardMaterial({ color: 0x24384b, emissive: 0x064955, emissiveIntensity: 0.45, roughness: 0.5 }),
    monster: new THREE.MeshStandardMaterial({ color: 0x21020a, emissive: 0x720015, emissiveIntensity: 0.85, roughness: 0.7 }),
    puzzle: new THREE.MeshStandardMaterial({ color: 0x102632, emissive: 0x064b56, emissiveIntensity: 0.85, roughness: 0.42 }),
    solved: new THREE.MeshStandardMaterial({ color: 0x0d4038, emissive: 0x4affc9, emissiveIntensity: 1.5, roughness: 0.35 }),
    activeRing: new THREE.MeshBasicMaterial({ color: 0x5ff8ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    dead: new THREE.MeshStandardMaterial({ color: 0x201820, emissive: 0x330000, emissiveIntensity: 0.2, roughness: 1 }),
    door: new THREE.MeshStandardMaterial({ color: 0x211b16, emissive: 0x241008, emissiveIntensity: 0.22, roughness: 0.7 }),
    hand: new THREE.MeshStandardMaterial({ color: 0x25394d, emissive: 0x073e4a, emissiveIntensity: 0.45, roughness: 0.48 })
  };
}

function makeLabel(text, color = '#7df8ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = 'bold 30px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 58);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(3.4, 0.65, 1);
  return sprite;
}

export function generateMapLayout(seed, mapId) {
  return createMapLayout(mapId, seed);
}

export function clearWorld(world) {
  world?.objects?.forEach((object) => object.parent?.remove(object));
}

export function createWorld(scene, materials, layout) {
  const objects = [];
  const colliders = [];
  const interactables = { doors: [], roomLabels: [] };
  const add = (object) => { scene.add(object); objects.push(object); return object; };
  const propMaterials = {
    crate: new THREE.MeshStandardMaterial({ color: 0x2b261d, roughness: 0.85, metalness: 0.05 }),
    server: new THREE.MeshStandardMaterial({ color: 0x0b1117, emissive: 0x032d36, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.45 }),
    labTable: new THREE.MeshStandardMaterial({ color: 0x28313a, roughness: 0.46, metalness: 0.35 }),
    generator: new THREE.MeshStandardMaterial({ color: 0x312719, emissive: 0x2b0a00, emissiveIntensity: 0.25, roughness: 0.58, metalness: 0.3 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0x343b3f, roughness: 0.42, metalness: 0.55 }),
    containment: new THREE.MeshStandardMaterial({ color: 0x18333a, emissive: 0x075963, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.15, transparent: true, opacity: 0.72 }),
    warning: new THREE.MeshStandardMaterial({ color: 0xffc928, emissive: 0x5a2400, emissiveIntensity: 0.45, roughness: 0.36, metalness: 0.15 })
  };

  const floorBounds = layout.bounds || { w: 54, d: 48 };
  const floor = add(new THREE.Mesh(new THREE.BoxGeometry(floorBounds.w, 0.28, floorBounds.d), materials.floor));
  floor.position.set(floorBounds.x || 0, -0.14, floorBounds.z || 0);
  floor.receiveShadow = true;

  (layout.grass || []).forEach((area) => {
    const mat = materials.room.clone();
    mat.color.setHex(area.color || 0x102817);
    mat.opacity = 0.9;
    const patch = add(new THREE.Mesh(new THREE.BoxGeometry(area.w, 0.03, area.d), mat));
    patch.position.set(area.x, 0.01, area.z);
    patch.receiveShadow = true;
  });

  layout.rooms.forEach((area) => {
    const mat = materials.room.clone();
    mat.color.setHex(area.color);
    const room = add(new THREE.Mesh(new THREE.BoxGeometry(area.w, 0.04, area.d), mat));
    room.position.set(area.x, 0.005, area.z);
    const label = add(makeLabel(area.name, area.name.includes('Monster') ? '#ff4967' : '#93faff'));
    label.position.set(area.x, 2.85, area.z);
    label.visible = false;
    interactables.roomLabels.push({ area, label });
  });

  layout.corridors.forEach((path) => {
    if (path.from && path.to) {
      const { from, to } = path;
      const midX = (from.x + to.x) / 2;
      const midZ = (from.z + to.z) / 2;
      const hallX = add(new THREE.Mesh(new THREE.BoxGeometry(Math.abs(from.x - to.x) + 4, 0.035, 3.2), materials.room.clone()));
      hallX.position.set(midX, 0.012, from.z);
      const hallZ = add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.035, Math.abs(from.z - to.z) + 4), materials.room.clone()));
      hallZ.position.set(to.x, 0.014, midZ);
      return;
    }
    const mat = materials.room.clone();
    mat.color.setHex(path.color || 0x101820);
    const hall = add(new THREE.Mesh(new THREE.BoxGeometry(path.w, 0.035, path.d), mat));
    hall.position.set(path.x, 0.014, path.z);
  });

  add(new THREE.GridHelper(52, 26, 0x293142, 0x151b2a)).position.y = 0.025;

  layout.walls.forEach((wall, index) => {
    const mesh = add(new THREE.Mesh(new THREE.BoxGeometry(wall.w, 3.4, wall.d), materials.wall));
    mesh.position.set(wall.x, 1.7, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    colliders.push({ ...wall, minX: wall.x - wall.w / 2, maxX: wall.x + wall.w / 2, minZ: wall.z - wall.d / 2, maxZ: wall.z + wall.d / 2 });
    if (index > 3) {
      const trim = add(new THREE.Mesh(new THREE.BoxGeometry(wall.w + 0.05, 0.08, wall.d + 0.05), materials.wallTrim));
      trim.position.set(wall.x, 3.43, wall.z);
    }
  });

  layout.doors.forEach((door) => {
    const mesh = add(new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.35, 0.18), materials.door.clone()));
    mesh.position.set(door.x, 1.15, door.z);
    mesh.rotation.y = door.rotation || 0;
    mesh.castShadow = true;
    interactables.doors.push({ ...door, baseRotation: door.rotation || 0, mesh, open: false, position: new THREE.Vector3(door.x, 0, door.z) });
  });

  (layout.props || []).forEach((item) => {
    const mat = (propMaterials[item.type] || propMaterials.crate).clone();
    const mesh = add(new THREE.Mesh(new THREE.BoxGeometry(item.w, item.height || 0.8, item.d), mat));
    mesh.position.set(item.x, (item.height || 0.8) / 2, item.z);
    mesh.rotation.y = item.rotation || 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  const lights = layout.lights?.length ? layout.lights : Array.from({ length: 26 }, (_, i) => ({
    x: -22 + (i % 8) * 6.2,
    z: -18 + Math.floor(i / 8) * 12,
    color: i % 4 === 0 ? 0xff2448 : 0x54e8ff,
    intensity: i % 4 === 0 ? 0.55 : 0.85,
    distance: 7.5,
    flicker: i % 4 === 0
  }));
  lights.forEach((lightInfo) => {
    const lamp = add(new THREE.PointLight(lightInfo.color, lightInfo.intensity, lightInfo.distance, 2.2));
    lamp.position.set(lightInfo.x, 2.65, lightInfo.z);
    lamp.userData.flicker = lightInfo.flicker;
    lamp.userData.baseIntensity = lamp.intensity;
    const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: lamp.color })));
    bulb.position.copy(lamp.position);
  });
  return { objects, colliders, interactables };
}

export function createPlayerModel(role = 'survivor') {
  const group = new THREE.Group();
  const mats = createMaterials();
  if (role === 'monster') {
    const bodyMat = mats.monster;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.75, 7, 14), bodyMat);
    torso.position.y = 1.45;
    torso.scale.set(1.05, 1.25, 0.82);
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), bodyMat);
    head.position.set(0, 2.85, 0.05);
    head.scale.set(0.9, 1.2, 0.75);
    group.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.16, 2.92, 0.33);
    eyeR.position.set(0.16, 2.92, 0.33);
    group.add(eyeL, eyeR);
    const armGeo = new THREE.CapsuleGeometry(0.11, 1.35, 6, 10);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    const armR = armL.clone();
    armL.position.set(-0.78, 1.45, 0.06);
    armR.position.set(0.78, 1.45, 0.06);
    armL.rotation.z = 0.28;
    armR.rotation.z = -0.28;
    group.add(armL, armR);
    const clawGeo = new THREE.ConeGeometry(0.06, 0.32, 5);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        const claw = new THREE.Mesh(clawGeo, eyeMat);
        claw.position.set(side * (0.82 + i * 0.06), 0.68, 0.16);
        claw.rotation.x = Math.PI;
        group.add(claw);
      }
    }
    const hornGeo = new THREE.ConeGeometry(0.09, 0.85, 5);
    const hornA = new THREE.Mesh(hornGeo, bodyMat);
    const hornB = hornA.clone();
    hornA.position.set(-0.3, 3.25, 0.02);
    hornB.position.set(0.3, 3.25, 0.02);
    hornA.rotation.z = 0.45;
    hornB.rotation.z = -0.45;
    group.add(hornA, hornB);
  } else {
    const bodyMat = mats.survivor;
    const height = 1.65;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, height - 0.65, 6, 12), bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    group.add(body);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x73f7ff }));
    visor.position.set(0, height - 0.25, 0.34);
    group.add(visor);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.16), new THREE.MeshStandardMaterial({ color: 0x111822, roughness: 0.7 }));
    pack.position.set(0, 0.98, -0.32);
    group.add(pack);
  }
  return group;
}

export function createLocalHands(camera, materials) {
  const group = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(0.09, 0.35, 6, 10);
  const left = new THREE.Mesh(geo, materials.hand);
  const right = new THREE.Mesh(geo, materials.hand);
  left.position.set(-0.28, -0.22, -0.55);
  right.position.set(0.28, -0.22, -0.55);
  left.rotation.x = right.rotation.x = Math.PI / 2;
  group.add(left, right);
  camera.add(group);
  return group;
}

export function createPuzzleStations(scene, materials, layout) {
  return layout.puzzles.map((pos, index) => {
    const type = PUZZLE_TYPES[pos.typeIndex % PUZZLE_TYPES.length];
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 0.85, 8), materials.puzzle);
    base.position.y = 0.42;
    base.castShadow = true;
    group.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.025, 8, 40), materials.activeRing.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    ring.visible = false;
    group.add(ring);
    const propMat = new THREE.MeshBasicMaterial({ color: cyan });
    const symbol = new THREE.Mesh(type.id === 'valve' ? new THREE.TorusGeometry(0.28, 0.035, 8, 24) : type.id === 'item' ? new THREE.OctahedronGeometry(0.32) : new THREE.IcosahedronGeometry(0.27, 0), propMat);
    symbol.position.y = 1.08;
    group.add(symbol);
    scene.add(group);
    group.visible = false;
    return { id: `puzzle_${index}`, group, ring, symbol, label: null, type, room: pos.room, base, solved: false, active: false, progress: 0, position: new THREE.Vector3(pos.x, 0, pos.z) };
  });
}

export function clearPuzzles(puzzles) {
  puzzles?.forEach((puzzle) => puzzle.group.parent?.remove(puzzle.group));
}

export function createRemoteMarker(role, name) {
  const group = createPlayerModel(role);
  const label = makeLabel(name, role === 'monster' ? '#ff4967' : '#7df8ff');
  label.position.y = role === 'monster' ? 3.05 : 2.2;
  group.add(label);
  return group;
}

export function updatePuzzleLabel(puzzle) {
  // Floating puzzle labels were intentionally removed for a cleaner horror map.
  puzzle.label = null;
}

export function setPuzzleActive(puzzle, active) {
  puzzle.active = active;
  puzzle.group.visible = active || puzzle.solved;
  puzzle.group.position.y = active || puzzle.solved ? 0 : -99;
  puzzle.ring.visible = active && !puzzle.solved;
  puzzle.symbol.material.color.copy(puzzle.solved ? new THREE.Color(0x4affc9) : active ? cyan : new THREE.Color(0x35545f));
}

export function markPuzzleSolved(puzzle, materials) {
  puzzle.solved = true;
  puzzle.active = false;
  puzzle.progress = 1;
  puzzle.ring.visible = false;
  puzzle.group.visible = true;
  puzzle.base.material = materials.solved;
  puzzle.symbol.material.color.set(0x4affc9);
}

export function makeCorpse(scene, position) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 5, 8), createMaterials().dead);
  mesh.position.set(position.x, 0.32, position.z);
  mesh.rotation.z = Math.PI / 2;
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

export function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export { red, cyan };
