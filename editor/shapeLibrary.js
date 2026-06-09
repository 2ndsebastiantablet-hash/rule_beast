export const SHAPE_CATEGORIES = ['Basic shapes', 'Architecture', 'Decorative shapes'];

const basicShapes = [
  ['cube', 'Cube', 'box', [1, 1, 1]],
  ['rectangular_box', 'Rectangular box', 'box', [1.6, 0.9, 1]],
  ['wall_block', 'Wall block', 'box', [2.8, 2.2, 0.45]],
  ['floor_tile', 'Floor tile', 'box', [2.4, 0.12, 2.4]],
  ['platform', 'Platform', 'box', [2.8, 0.45, 2.2]],
  ['sphere', 'Sphere', 'sphere', [0.72, 0.72, 0.72]],
  ['half_sphere', 'Half sphere', 'half-sphere', [0.8, 0.45, 0.8]],
  ['oval', 'Oval', 'sphere', [1.25, 0.7, 0.85]],
  ['capsule', 'Capsule', 'capsule', [0.55, 1.6, 0.55]],
  ['cylinder', 'Cylinder', 'cylinder', [0.72, 1.25, 0.72]],
  ['tall_cylinder', 'Tall cylinder', 'cylinder', [0.45, 2.4, 0.45]],
  ['short_cylinder', 'Short cylinder', 'cylinder', [0.9, 0.55, 0.9]],
  ['cone', 'Cone', 'cone', [0.75, 1.35, 0.75]],
  ['pyramid', 'Pyramid', 'pyramid', [0.9, 1.25, 0.9]],
  ['triangular_prism', 'Triangular prism', 'triangular-prism', [1.25, 1, 1.25]],
  ['wedge', 'Wedge', 'wedge', [1.45, 0.9, 1.2]],
  ['ramp', 'Ramp', 'wedge', [2.2, 0.8, 1.5]],
  ['stairs_block', 'Stairs block', 'stairs', [2, 1.2, 1.6]],
  ['rod', 'Rod', 'cylinder', [0.18, 1.8, 0.18]],
  ['pole', 'Pole', 'cylinder', [0.24, 2.6, 0.24]],
  ['wide_floor_tile', 'Wide floor tile', 'box', [3.6, 0.12, 2]],
  ['thin_floor_strip', 'Thin floor strip', 'box', [3.2, 0.1, 0.65]],
  ['square_platform_low', 'Low square platform', 'box', [2.1, 0.32, 2.1]],
  ['square_platform_tall', 'Tall square platform', 'box', [1.8, 0.9, 1.8]],
  ['round_platform', 'Round platform', 'cylinder', [1.2, 0.35, 1.2]],
  ['oval_platform_basic', 'Basic oval platform', 'cylinder', [1.55, 0.32, 0.95]],
  ['small_cube', 'Small cube', 'box', [0.55, 0.55, 0.55]],
  ['large_cube', 'Large cube', 'box', [1.7, 1.7, 1.7]],
  ['flat_panel', 'Flat panel', 'box', [1.9, 0.12, 1.2]],
  ['upright_panel', 'Upright panel', 'box', [1.4, 1.8, 0.16]],
  ['low_bar', 'Low bar', 'box', [2.2, 0.22, 0.28]],
  ['tall_bar', 'Tall bar', 'box', [0.32, 2.1, 0.32]],
  ['rounded_block', 'Rounded block', 'capsule', [0.72, 0.65, 0.72]],
  ['marker_puck', 'Marker puck', 'cylinder', [0.72, 0.18, 0.72]]
];

const architectureShapes = [
  ['wall', 'Wall', 'box', [3, 2.4, 0.36]],
  ['thin_wall', 'Thin wall', 'box', [3, 2.2, 0.18]],
  ['thick_wall', 'Thick wall', 'box', [3, 2.6, 0.72]],
  ['corner_wall', 'Corner wall', 'corner-wall', [2.4, 2.3, 2.4]],
  ['door_frame', 'Door frame', 'door-frame', [1.8, 2.35, 0.35]],
  ['window_frame', 'Window frame', 'window-frame', [1.8, 1.5, 0.28]],
  ['archway', 'Archway', 'archway', [2.2, 2.65, 0.35]],
  ['pillar', 'Pillar', 'cylinder', [0.42, 2.6, 0.42]],
  ['column', 'Column', 'column', [0.58, 2.65, 0.58]],
  ['beam', 'Beam', 'box', [3.4, 0.34, 0.42]],
  ['rail', 'Rail', 'rail', [2.6, 0.85, 0.28]],
  ['fence_segment', 'Fence segment', 'fence', [2.8, 1.25, 0.22]],
  ['gate', 'Gate', 'gate', [2.6, 1.55, 0.25]],
  ['barrier', 'Barrier', 'box', [2.4, 0.85, 0.45]],
  ['ceiling_panel', 'Ceiling panel', 'box', [2.8, 0.1, 2.8]],
  ['floor_panel', 'Floor panel', 'box', [2.8, 0.1, 2.8]],
  ['stair_step', 'Stair step', 'box', [1.8, 0.32, 0.65]],
  ['ramp_panel', 'Ramp panel', 'wedge', [2.4, 0.65, 1.4]],
  ['platform_block', 'Platform block', 'box', [2.5, 0.75, 2.5]],
  ['bridge_segment', 'Bridge segment', 'box', [3.6, 0.34, 1.4]],
  ['half_wall', 'Half wall', 'box', [2.8, 1.2, 0.36]],
  ['low_fence', 'Low fence', 'fence', [2.4, 0.8, 0.18]],
  ['tall_fence', 'Tall fence', 'fence', [2.4, 1.8, 0.22]],
  ['support_post', 'Support post', 'box', [0.34, 2.3, 0.34]],
  ['roof_slab', 'Roof slab', 'box', [3.2, 0.28, 2.2]],
  ['awning_panel', 'Awning panel', 'wedge', [2.8, 0.42, 1.2]],
  ['threshold_strip', 'Threshold strip', 'box', [1.9, 0.14, 0.42]],
  ['lintel_block', 'Lintel block', 'box', [2.2, 0.38, 0.42]],
  ['side_buttress', 'Side buttress', 'box', [0.55, 1.8, 0.7]],
  ['corner_pillar_pair', 'Corner pillar pair', 'pillar-pair', [2.2, 2.3, 0.38]],
  ['catwalk_segment', 'Catwalk segment', 'box', [3.2, 0.22, 1.2]],
  ['balcony_panel', 'Balcony panel', 'rail', [2.7, 1.05, 0.28]],
  ['foundation_block', 'Foundation block', 'box', [3.4, 0.55, 1.6]]
];

const decorativeShapes = [
  ['heart', 'Heart', 'heart', [1.2, 1.2, 0.22]],
  ['star', 'Star', 'star', [1.25, 1.25, 0.22]],
  ['diamond', 'Diamond', 'diamond', [1.1, 1.1, 0.28]],
  ['gem', 'Gem', 'gem', [1, 1.2, 1]],
  ['crystal', 'Crystal', 'crystal', [0.9, 1.6, 0.9]],
  ['ring', 'Ring', 'torus', [0.8, 0.16, 0.8]],
  ['torus', 'Torus', 'torus', [0.9, 0.18, 0.9]],
  ['donut', 'Donut', 'torus', [0.95, 0.24, 0.95]],
  ['crescent', 'Crescent', 'crescent', [1.2, 1.2, 0.2]],
  ['moon', 'Moon', 'crescent', [1.35, 1.35, 0.22]],
  ['cross', 'Cross', 'cross', [1.3, 1.3, 0.24]],
  ['plus_sign', 'Plus sign', 'cross', [1.2, 1.2, 0.2]],
  ['x_shape', 'X shape', 'x-shape', [1.25, 1.25, 0.22]],
  ['arrow', 'Arrow', 'arrow', [1.5, 0.9, 0.24]],
  ['sign_board', 'Sign board', 'box', [1.8, 1.05, 0.16]],
  ['picture_frame', 'Picture frame', 'window-frame', [1.7, 1.25, 0.18]],
  ['plaque', 'Plaque', 'box', [1.4, 0.7, 0.18]],
  ['banner_panel', 'Banner panel', 'box', [1.9, 0.8, 0.12]],
  ['flag', 'Flag', 'flag', [1.7, 1.25, 0.12]],
  ['marker_cone', 'Marker cone', 'cone', [0.5, 1.05, 0.5]],
  ['small_star', 'Small star', 'star', [0.75, 0.75, 0.18]],
  ['large_star', 'Large star', 'star', [1.7, 1.7, 0.24]],
  ['thin_ring', 'Thin ring', 'torus', [0.95, 0.1, 0.95]],
  ['wide_ring', 'Wide ring', 'torus', [1.25, 0.2, 1.25]],
  ['hanging_tag', 'Hanging tag', 'box', [0.75, 1.1, 0.14]],
  ['round_badge', 'Round badge', 'cylinder', [0.72, 0.16, 0.72]],
  ['oval_badge', 'Oval badge', 'cylinder', [1.05, 0.16, 0.65]],
  ['triangle_badge', 'Triangle badge', 'triangular-prism', [0.95, 0.35, 0.95]],
  ['chevron', 'Chevron', 'chevron', [1.4, 0.9, 0.2]],
  ['double_chevron', 'Double chevron', 'double-chevron', [1.7, 1, 0.2]],
  ['slash_panel', 'Slash panel', 'slash-panel', [1.25, 1.25, 0.2]],
  ['target_ring', 'Target ring', 'target-ring', [1.15, 0.16, 1.15]],
  ['sigil_tile', 'Sigil tile', 'sigil-tile', [1.3, 0.16, 1.3]]
];

function normalizeShape([id, name, kind, dimensions], index, category) {
  return {
    id,
    name,
    category,
    kind,
    dimensions: { x: dimensions[0], y: dimensions[1], z: dimensions[2] },
    color: category === 'Decorative shapes' ? 0x5a1d35 : category === 'Architecture' ? 0x202837 : 0x17212c,
    defaultCollision: true,
    supportsTexture: true,
    sortOrder: index
  };
}

export const SHAPE_LIBRARY = [
  ...basicShapes.map((shape, index) => normalizeShape(shape, index, 'Basic shapes')),
  ...architectureShapes.map((shape, index) => normalizeShape(shape, index, 'Architecture')),
  ...decorativeShapes.map((shape, index) => normalizeShape(shape, index, 'Decorative shapes'))
];

export function getShapeDefinition(id) {
  return SHAPE_LIBRARY.find((shape) => shape.id === id) || null;
}

function material(def, THREE) {
  return new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.76,
    metalness: def.category === 'Decorative shapes' ? 0.18 : 0.08,
    emissive: def.category === 'Decorative shapes' ? 0x120308 : 0x000000,
    emissiveIntensity: def.category === 'Decorative shapes' ? 0.18 : 0
  });
}

function addBox(THREE, group, mat, x, y, z, px = 0, py = 0, pz = 0, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat.clone());
  mesh.position.set(px, py, pz);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function makeExtrudedShape(THREE, points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function makeWedgeGeometry(THREE, x, y, z) {
  const hx = x / 2;
  const hz = z / 2;
  const vertices = new Float32Array([
    -hx, 0, -hz, hx, 0, -hz, hx, 0, hz, -hx, 0, hz,
    -hx, y, hz, hx, y, hz
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    3, 2, 5, 3, 5, 4,
    0, 3, 4, 0, 4, 1,
    1, 4, 5, 1, 5, 2,
    0, 4, 3, 1, 5, 4
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function decorativeGeometry(THREE, kind, d) {
  if (kind === 'heart') {
    return makeExtrudedShape(THREE, [[0, .58], [-.62, .2], [-.5, -.45], [0, -.82], [.5, -.45], [.62, .2]], d.z);
  }
  if (kind === 'star') {
    const points = Array.from({ length: 10 }, (_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 ? 0.38 : 0.72;
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    });
    return makeExtrudedShape(THREE, points, d.z);
  }
  if (kind === 'arrow') return makeExtrudedShape(THREE, [[-.72, -.24], [.12, -.24], [.12, -.48], [.82, 0], [.12, .48], [.12, .24], [-.72, .24]], d.z);
  if (kind === 'chevron') return makeExtrudedShape(THREE, [[-.7, -.45], [-.2, -.45], [.62, 0], [-.2, .45], [-.7, .45], [-.08, 0]], d.z);
  return null;
}

export function createShapeObject(shapeOrId, THREE) {
  if (!THREE) throw new Error('createShapeObject requires the Three.js namespace.');
  const def = typeof shapeOrId === 'string' ? getShapeDefinition(shapeOrId) : shapeOrId;
  if (!def) return null;
  const d = def.dimensions;
  const group = new THREE.Group();
  group.userData.shapeId = def.id;
  group.userData.shapeName = def.name;
  const mat = material(def, THREE);
  let mesh = null;

  if (def.kind === 'box') mesh = new THREE.Mesh(new THREE.BoxGeometry(d.x, d.y, d.z), mat);
  else if (def.kind === 'sphere' || def.kind === 'half-sphere') mesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12), mat);
  else if (def.kind === 'capsule') mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1, 8, 14), mat);
  else if (def.kind === 'cylinder') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 18), mat);
  else if (def.kind === 'cone') mesh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1, 18), mat);
  else if (def.kind === 'pyramid') mesh = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1, 4), mat);
  else if (def.kind === 'triangular-prism') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1, 3), mat);
  else if (def.kind === 'wedge') mesh = new THREE.Mesh(makeWedgeGeometry(THREE, d.x, d.y, d.z), mat);
  else if (def.kind === 'torus') mesh = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.12, 10, 36), mat);
  else if (def.kind === 'diamond') mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat);
  else if (def.kind === 'gem' || def.kind === 'crystal') mesh = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.15, 6), mat);

  if (mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(d.x, d.y, d.z);
    if (def.kind === 'half-sphere') mesh.scale.y *= 0.5;
    if (def.kind === 'triangular-prism') mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
  } else {
    const extruded = decorativeGeometry(THREE, def.kind, d);
    if (extruded) {
      mesh = new THREE.Mesh(extruded, mat);
      mesh.scale.set(d.x, d.y, 1);
      mesh.rotation.x = -Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  if (!group.children.length) {
    if (def.kind === 'stairs') {
      for (let i = 0; i < 4; i += 1) addBox(THREE, group, mat, d.x, d.y / 4, d.z / 4, 0, i * d.y / 4, -d.z / 2 + i * d.z / 4);
    } else if (def.kind === 'corner-wall') {
      addBox(THREE, group, mat, d.x, d.y, 0.32, 0, 0, -d.z / 2);
      addBox(THREE, group, mat, 0.32, d.y, d.z, -d.x / 2, 0, 0);
    } else if (['door-frame', 'window-frame', 'archway'].includes(def.kind)) {
      addBox(THREE, group, mat, 0.28, d.y, d.z, -d.x / 2, 0, 0);
      addBox(THREE, group, mat, 0.28, d.y, d.z, d.x / 2, 0, 0);
      addBox(THREE, group, mat, d.x, 0.28, d.z, 0, d.y / 2, 0);
      if (def.kind === 'archway') addBox(THREE, group, mat, d.x * 0.72, 0.22, d.z, 0, d.y * 0.32, 0);
    } else if (['rail', 'fence', 'gate'].includes(def.kind)) {
      addBox(THREE, group, mat, d.x, 0.16, d.z, 0, d.y * 0.15, 0);
      addBox(THREE, group, mat, d.x, 0.16, d.z, 0, d.y * 0.75, 0);
      for (let i = -1; i <= 1; i += 1) addBox(THREE, group, mat, 0.16, d.y, d.z, i * d.x * 0.33, d.y * 0.36, 0);
    } else if (def.kind === 'column') {
      addBox(THREE, group, mat, d.x * 1.25, 0.22, d.z * 1.25, 0, -d.y / 2, 0);
      addBox(THREE, group, mat, d.x * 1.25, 0.22, d.z * 1.25, 0, d.y / 2, 0);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(d.x * 0.45, d.x * 0.45, d.y, 18), mat.clone());
      group.add(column);
    } else if (def.kind === 'pillar-pair') {
      addBox(THREE, group, mat, 0.32, d.y, d.z, -d.x / 2, 0, 0);
      addBox(THREE, group, mat, 0.32, d.y, d.z, d.x / 2, 0, 0);
    } else if (def.kind === 'flag') {
      addBox(THREE, group, mat, 0.12, d.y, 0.12, -d.x / 2, 0, 0);
      addBox(THREE, group, mat, d.x, d.y * 0.55, d.z, 0, d.y * 0.2, 0);
    } else if (def.kind === 'cross') {
      addBox(THREE, group, mat, d.x * 0.35, d.y, d.z);
      addBox(THREE, group, mat, d.x, d.y * 0.35, d.z);
    } else if (def.kind === 'x-shape') {
      addBox(THREE, group, mat, d.x, d.y * 0.25, d.z, 0, 0, 0, Math.PI / 4);
      addBox(THREE, group, mat, d.x, d.y * 0.25, d.z, 0, 0, 0, -Math.PI / 4);
    } else if (def.kind === 'crescent') {
      const outer = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.18, 10, 30, Math.PI * 1.45), mat);
      outer.scale.set(d.x, d.y, d.z);
      group.add(outer);
    } else if (def.kind === 'double-chevron') {
      addBox(THREE, group, mat, d.x * 0.65, d.y * 0.22, d.z, -0.28, 0, 0, Math.PI / 5);
      addBox(THREE, group, mat, d.x * 0.65, d.y * 0.22, d.z, -0.28, 0, 0, -Math.PI / 5);
      addBox(THREE, group, mat, d.x * 0.65, d.y * 0.22, d.z, 0.38, 0, 0, Math.PI / 5);
      addBox(THREE, group, mat, d.x * 0.65, d.y * 0.22, d.z, 0.38, 0, 0, -Math.PI / 5);
    } else if (def.kind === 'slash-panel') {
      addBox(THREE, group, mat, d.x, d.y, d.z);
      addBox(THREE, group, mat, d.x * 1.15, d.y * 0.18, d.z * 1.1, 0, 0, 0, -Math.PI / 5);
    } else if (def.kind === 'target-ring') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 10, 36), mat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      addBox(THREE, group, mat, d.x * 0.95, 0.08, d.z * 0.12);
      addBox(THREE, group, mat, d.x * 0.12, 0.08, d.z * 0.95);
    } else if (def.kind === 'sigil-tile') {
      addBox(THREE, group, mat, d.x, d.y, d.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 28), mat.clone());
      ring.rotation.x = Math.PI / 2;
      ring.position.y = d.y / 2 + 0.03;
      group.add(ring);
    }
  }

  group.children.forEach((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return group;
}
