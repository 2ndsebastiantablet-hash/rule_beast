import * as THREE from 'three';

export const DEFAULT_MAP_SETTINGS = {
  gravityMultiplier: 1,
  airControl: 1,
  drag: 1
};

export const LIQUID_TYPES = [
  { id: 'water', name: 'Water', color: '#2f9bff', opacity: 0.5 },
  { id: 'acid', name: 'Acid', color: '#22ff66', opacity: 0.62, hurtsPlayer: true, damagePerSecond: 10 },
  { id: 'slime', name: 'Slime', color: '#6dff38', opacity: 0.58, isSlime: true, movementMultiplier: 0.45 },
  { id: 'lava', name: 'Lava', color: '#ff5a24', opacity: 0.68, hurtsPlayer: true, damagePerSecond: 22 },
  { id: 'oil', name: 'Oil', color: '#14120f', opacity: 0.5, movementMultiplier: 0.65 },
  { id: 'toxic_waste', name: 'Toxic waste', color: '#78ff2d', opacity: 0.6, hurtsPlayer: true, damagePerSecond: 15 },
  { id: 'black_goo', name: 'Black goo', color: '#050506', opacity: 0.72, movementMultiplier: 0.5 },
  { id: 'blood_pool', name: 'Blood pool', color: '#8d0715', opacity: 0.55 },
  { id: 'deep_water', name: 'Deep water', color: '#0c4c9c', opacity: 0.58, sinkEnabled: true, sinkSpeed: 0.25, movementMultiplier: 0.55 },
  { id: 'custom_liquid', name: 'Custom liquid', color: '#2f9bff', opacity: 0.5 }
];

export const GAS_TYPES = [
  { id: 'fog_cloud', name: 'Fog cloud', color: '#dfe8ef', opacity: 0.25 },
  { id: 'poison_gas', name: 'Poison gas', color: '#55ff55', opacity: 0.35, hurtsPlayer: true, damagePerSecond: 8 },
  { id: 'smoke', name: 'Smoke', color: '#7e858a', opacity: 0.3, affectsVision: true, visionMultiplier: 0.7 },
  { id: 'black_fog', name: 'Black fog', color: '#09090c', opacity: 0.42, affectsVision: true, visionMultiplier: 0.45 },
  { id: 'green_toxic_gas', name: 'Green toxic gas', color: '#52ff75', opacity: 0.34, hurtsPlayer: true, damagePerSecond: 10 },
  { id: 'blue_cold_mist', name: 'Blue cold mist', color: '#7ad8ff', opacity: 0.28, movementMultiplier: 0.75 },
  { id: 'red_danger_gas', name: 'Red danger gas', color: '#ff4058', opacity: 0.32, hurtsPlayer: true, damagePerSecond: 12 },
  { id: 'low_gravity_field', name: 'Low-gravity field', color: '#9fd4ff', opacity: 0.26, affectsGravity: true, gravityMultiplier: 0.45, upwardForce: 0.35 },
  { id: 'heavy_gravity_field', name: 'Heavy-gravity field', color: '#c39cff', opacity: 0.28, affectsGravity: true, gravityMultiplier: 1.8, downwardForce: 0.3 },
  { id: 'custom_gas', name: 'Custom gas', color: '#dfe8ef', opacity: 0.25 }
];

export function liquidDefaults(liquidType = 'water') {
  const preset = LIQUID_TYPES.find((item) => item.id === liquidType) || LIQUID_TYPES[0];
  return {
    visual: {
      color: preset.color,
      opacity: preset.opacity,
      brightness: 1,
      waveEnabled: false
    },
    gameplay: {
      hurtsPlayer: preset.hurtsPlayer || false,
      damagePerSecond: preset.damagePerSecond || 0,
      instantKill: false,
      sinkEnabled: preset.sinkEnabled || false,
      sinkSpeed: preset.sinkSpeed || 0,
      density: 1,
      movementMultiplier: preset.movementMultiplier || 0.8,
      isSlime: preset.isSlime || false,
      stickiness: preset.isSlime ? 0.5 : 0,
      canSwim: true,
      monsterSafe: false,
      survivorSafe: false
    }
  };
}

export function gasDefaults(gasType = 'fog_cloud') {
  const preset = GAS_TYPES.find((item) => item.id === gasType) || GAS_TYPES[0];
  return {
    visual: {
      color: preset.color,
      opacity: preset.opacity,
      density: 0.5,
      brightness: 1,
      driftEnabled: false
    },
    gameplay: {
      hurtsPlayer: preset.hurtsPlayer || false,
      damagePerSecond: preset.damagePerSecond || 0,
      instantKill: false,
      slowsPlayer: (preset.movementMultiplier || 1) < 1,
      movementMultiplier: preset.movementMultiplier || 1,
      affectsVision: preset.affectsVision || false,
      visionMultiplier: preset.visionMultiplier || 1,
      affectsGravity: preset.affectsGravity || false,
      gravityMultiplier: preset.gravityMultiplier || 1,
      upwardForce: preset.upwardForce || 0,
      downwardForce: preset.downwardForce || 0,
      disorientPlayer: false,
      monsterImmune: false,
      survivorImmune: false
    }
  };
}

function applyPlacementTransform(object, placement) {
  object.position.set(placement.position?.x || 0, placement.position?.y || 0, placement.position?.z || 0);
  object.rotation.set(placement.rotation?.x || 0, placement.rotation?.y || 0, placement.rotation?.z || 0);
  object.scale.set(placement.scale?.x || 1, placement.scale?.y || 1, placement.scale?.z || 1);
  object.updateMatrixWorld(true);
}

export function createLiquidVolumeObject(placement = {}) {
  const visual = placement.visual || liquidDefaults(placement.liquidType).visual;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(visual.color || '#2f9bff'),
    emissive: new THREE.Color(visual.color || '#2f9bff'),
    emissiveIntensity: Math.max(0, Number(visual.brightness || 1) - 1) * 0.25,
    transparent: true,
    opacity: Number(visual.opacity ?? 0.5),
    roughness: 0.45,
    metalness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  object.name = placement.liquidType || 'liquid_volume';
  object.renderOrder = 2;
  applyPlacementTransform(object, placement);
  return object;
}

export function createGasVolumeObject(placement = {}) {
  const visual = placement.visual || gasDefaults(placement.gasType).visual;
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(visual.color || '#dfe8ef'),
    transparent: true,
    opacity: Number(visual.opacity ?? 0.25),
    wireframe: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  object.name = placement.gasType || 'gas_volume';
  object.renderOrder = 1;
  applyPlacementTransform(object, placement);
  return object;
}

export function updateVolumeVisual(object, placement) {
  const visual = placement?.visual || {};
  object?.traverse?.((child) => {
    if (!child.material) return;
    const color = visual.color || '#ffffff';
    if (child.material.color) child.material.color.set(color);
    if (child.material.emissive) child.material.emissive.set(color);
    if (child.material.opacity !== undefined) child.material.opacity = Number(visual.opacity ?? child.material.opacity);
    if (child.material.emissiveIntensity !== undefined) child.material.emissiveIntensity = Math.max(0, Number(visual.brightness || 1) - 1) * 0.25;
    child.material.needsUpdate = true;
  });
}

export function createSunLightObject(placement = {}) {
  const group = new THREE.Group();
  const color = new THREE.Color(placement.color || '#fff4cc');
  const light = new THREE.DirectionalLight(color, placement.intensity ?? 1.2);
  light.castShadow = placement.shadows !== false;
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: placement.enabled === false ? 0.35 : 1 })
  );
  const rays = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  rays.rotation.x = Math.PI / 2;
  group.add(light, orb, rays);
  group.userData.sunLight = light;
  group.userData.sunOrb = orb;
  group.position.set(placement.position?.x ?? 20, placement.position?.y ?? 30, placement.position?.z ?? 10);
  group.rotation.set(placement.rotation?.x || 0, placement.rotation?.y || 0, placement.rotation?.z || 0);
  return group;
}

export function pointInsideVolume(point, placement) {
  const position = placement.position || {};
  const scale = placement.scale || {};
  const halfX = Math.max(0.05, Number(scale.x || 1) / 2);
  const halfY = Math.max(0.05, Number(scale.y || 1) / 2);
  const halfZ = Math.max(0.05, Number(scale.z || 1) / 2);
  return point.x >= (position.x || 0) - halfX &&
    point.x <= (position.x || 0) + halfX &&
    point.y >= (position.y || 0) - halfY &&
    point.y <= (position.y || 0) + halfY &&
    point.z >= (position.z || 0) - halfZ &&
    point.z <= (position.z || 0) + halfZ;
}
