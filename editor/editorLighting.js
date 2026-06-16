import * as THREE from 'three';

export const DEFAULT_MAP_SETTINGS = {
  gravityMultiplier: 1,
  airControl: 1,
  drag: 1
};

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
