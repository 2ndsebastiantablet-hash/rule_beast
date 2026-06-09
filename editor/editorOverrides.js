import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  getEditableObject,
  registerEditableObject,
  unregisterEditableObjectsBySource
} from './editorRegistry.js';
import { applyBrightnessToMaterial } from './assetEditor.js';
import { createShapeObject } from './shapeLibrary.js';
import {
  createGasVolumeObject,
  createLiquidVolumeObject,
  createSunLightObject,
  updateVolumeVisual
} from './volumeObjects.js';

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
let permanentOverrideObjects = [];
let permanentMixers = [];
let permanentCollisionColliders = [];
let permanentVolumeEffects = [];
let permanentMapSettings = null;
let permanentSunLights = [];

function materialsOf(material) {
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

function cloneMaterialValue(material) {
  return Array.isArray(material) ? material.map((item) => item.clone()) : material?.clone?.();
}

function ensureEditableMaterials(target) {
  if (!target?.material) return [];
  target.userData ||= {};
  if (!target.userData.permanentOriginalMaterials) target.userData.permanentOriginalMaterials = cloneMaterialValue(target.material);
  if (!target.userData.permanentMaterialCloned) {
    target.material = cloneMaterialValue(target.material);
    target.userData.permanentMaterialCloned = true;
  }
  return materialsOf(target.material);
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    textureLoader.load(url, resolve, undefined, reject);
  });
}

function loadGlb(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  });
}

function applyTransform(object, placement) {
  object.position.set(placement.position?.x || 0, placement.position?.y || 0, placement.position?.z || 0);
  object.rotation.set(placement.rotation?.x || 0, placement.rotation?.y || 0, placement.rotation?.z || 0);
  object.scale.set(placement.scale?.x || 1, placement.scale?.y || 1, placement.scale?.z || 1);
  object.updateMatrixWorld(true);
}

function cloneModelScene(scene) {
  const clone = scene.clone(true);
  clone.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.material = cloneMaterialValue(child.material);
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return clone;
}

function assetPath(asset) {
  return asset?.repoPath || asset?.permanentUrl || asset?.intendedRepoPath || asset?.temporaryLocalUrl || '';
}

function plainBoxCollider(id, object, collision) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const min = collision?.min || { x: box.min.x, y: box.min.y, z: box.min.z };
  const max = collision?.max || { x: box.max.x, y: box.max.y, z: box.max.z };
  return {
    id,
    y: min.y,
    minY: min.y,
    maxY: max.y,
    minX: min.x,
    maxX: max.x,
    minZ: min.z,
    maxZ: max.z
  };
}

function registerPermanentObject({ scene, mapId, placement, object, type, supportsTexture = true }) {
  scene.add(object);
  permanentOverrideObjects.push(object);
  if (placement.collision?.enabled) permanentCollisionColliders.push(plainBoxCollider(placement.id, object, placement.collision));
  registerEditableObject({
    id: `permanent_${placement.id}`,
    type,
    category: `placed-${type}`,
    mapId,
    floor: placement.floor || 'ground',
    zone: placement.zone || 'permanent_editor',
    object3D: object,
    materialTarget: object,
    supportsTexture,
    supportsTransform: true,
    source: 'permanent-editor'
  });
}

function createImagePlane(imageMeta, placement) {
  const path = assetPath(imageMeta);
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  const aspect = imageMeta?.width && imageMeta?.height ? imageMeta.width / imageMeta.height : 1.4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(0.6, aspect), 1),
    new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, transparent: true, side: THREE.DoubleSide, roughness: 0.62 })
  );
  applyTransform(mesh, placement);
  return mesh;
}

function setupAnimation(object, gltf, placement) {
  if (!placement.animation?.autoplay || !gltf.animations?.length) return;
  const mixer = new THREE.AnimationMixer(object);
  const clip = gltf.animations[placement.animation.selectedIndex || 0] || gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.timeScale = placement.animation.playbackSpeed || 1;
  action.play();
  permanentMixers.push(mixer);
}

export function clearPermanentEditorOverrides(scene) {
  permanentOverrideObjects.forEach((object) => object.parent?.remove(object));
  permanentOverrideObjects = [];
  permanentMixers = [];
  permanentCollisionColliders = [];
  permanentVolumeEffects = [];
  permanentMapSettings = null;
  permanentSunLights = [];
  unregisterEditableObjectsBySource('permanent-editor');
}

export function updatePermanentEditorOverrides(delta) {
  permanentMixers.forEach((mixer) => mixer.update(delta));
}

export function getPermanentEditorCollisionColliders() {
  return permanentCollisionColliders;
}

export function getPermanentEditorVolumeEffects() {
  return permanentVolumeEffects;
}

export function getPermanentEditorMapSettings() {
  return permanentMapSettings;
}

export function setPermanentEditorVolumeEffects(effects = []) {
  permanentVolumeEffects = effects;
}

function applySunLightSettings(scene, mapId, placement) {
  const object = createSunLightObject(placement);
  scene.add(object);
  permanentOverrideObjects.push(object);
  permanentSunLights.push(object);
  registerEditableObject({
    id: `permanent_${placement.id}`,
    type: 'sunLight',
    category: 'placed-sun',
    mapId,
    floor: placement.floor || 'ground',
    zone: placement.zone || 'permanent_editor',
    object3D: object,
    materialTarget: object,
    supportsTexture: false,
    supportsTransform: true,
    source: 'permanent-editor'
  });
  return object;
}

export async function loadPermanentEditorOverrides({ scene, mapId }) {
  const url = `assets/editor_maps/${mapId}/latest.json`;
  let data = null;
  try {
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.warn(`[Rule Beast] editor override skipped for ${mapId}:`, error.message);
    return null;
  }

  const textureList = data.textures || data.assets?.textures || [];
  const imageList = data.images || [...(data.assets?.images || []), ...(data.assets?.gifs || [])];
  const modelList = data.models || data.assets?.models || [];
  const textures = new Map(textureList.map((texture) => [texture.id, texture]));
  const images = new Map(imageList.map((image) => [image.id, image]));
  const models = new Map(modelList.map((model) => [model.id, model]));
  const loadedTextures = new Map();
  permanentMapSettings = data.mapSettings || null;

  for (const edit of data.surfaceEdits || []) {
    const meta = getEditableObject(edit.targetId);
    if (!meta) {
      console.warn(`[Rule Beast] editor override surface missing: ${edit.targetId}`);
      continue;
    }
    const target = meta.materialTarget || meta.object3D;
    const materials = ensureEditableMaterials(target);
    const textureMeta = textures.get(edit.textureId);
    if (textureMeta) {
      const path = assetPath(textureMeta);
      try {
        if (!loadedTextures.has(path)) loadedTextures.set(path, await loadTexture(path));
        const baseTexture = loadedTextures.get(path);
        materials.forEach((material) => {
          const texture = baseTexture.clone();
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(edit.repeat?.x || 1, edit.repeat?.y || 1);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          material.map = texture;
          material.needsUpdate = true;
        });
      } catch (error) {
        console.warn(`[Rule Beast] editor texture failed: ${path}`, error.message);
      }
    }
    materials.forEach((material) => applyBrightnessToMaterial(material, edit.surfaceBrightness ?? edit.brightness ?? 1));
  }

  for (const placement of data.placedModels || []) {
    const modelMeta = models.get(placement.modelAssetId || placement.modelId);
    const path = assetPath(modelMeta);
    if (!path) {
      console.warn(`[Rule Beast] editor model missing asset path: ${placement.id}`);
      continue;
    }
    try {
      const gltf = await loadGlb(path);
      const object = cloneModelScene(gltf.scene);
      applyTransform(object, placement);
      object.traverse((child) => {
        if (!child.isMesh) return;
        materialsOf(child.material).forEach((material) => applyBrightnessToMaterial(material, placement.modelBrightness ?? placement.brightness ?? 1));
      });
      setupAnimation(object, gltf, placement);
      registerPermanentObject({ scene, mapId, placement, object, type: 'model', supportsTexture: false });
    } catch (error) {
      console.warn(`[Rule Beast] editor model failed: ${path}`, error.message);
    }
  }

  for (const placement of data.placedShapes || []) {
    try {
      const object = createShapeObject(placement.shapeId, THREE);
      if (!object) throw new Error(`Unknown shape ${placement.shapeId}`);
      applyTransform(object, placement);
      object.traverse((child) => {
        if (!child.isMesh) return;
        materialsOf(child.material).forEach((material) => applyBrightnessToMaterial(material, placement.modelBrightness ?? placement.brightness ?? 1));
      });
      registerPermanentObject({ scene, mapId, placement, object, type: 'shape', supportsTexture: true });
    } catch (error) {
      console.warn(`[Rule Beast] editor shape failed: ${placement.id}`, error.message);
    }
  }

  for (const placement of data.placedImagePlanes || []) {
    try {
      const imageMeta = images.get(placement.imageAssetId || placement.imageId);
      if (!assetPath(imageMeta)) throw new Error('Missing image asset path');
      const object = createImagePlane(imageMeta, placement);
      materialsOf(object.material).forEach((material) => applyBrightnessToMaterial(material, placement.modelBrightness ?? placement.brightness ?? 1));
      registerPermanentObject({ scene, mapId, placement, object, type: placement.isGif ? 'gif' : 'image', supportsTexture: true });
    } catch (error) {
      console.warn(`[Rule Beast] editor image plane failed: ${placement.id}`, error.message);
    }
  }

  const liquidVolumes = data.placedLiquidVolumes || (data.placedObjects || []).filter((placement) => placement.objectType === 'liquid');
  for (const placement of liquidVolumes) {
    try {
      const object = createLiquidVolumeObject(placement);
      updateVolumeVisual(object, placement);
      registerPermanentObject({ scene, mapId, placement, object, type: 'liquid', supportsTexture: true });
      permanentVolumeEffects.push({ ...placement, type: 'liquid', objectType: 'liquid' });
    } catch (error) {
      console.warn(`[Rule Beast] editor liquid failed: ${placement.id}`, error.message);
    }
  }

  const gasVolumes = data.placedGasVolumes || (data.placedObjects || []).filter((placement) => placement.objectType === 'gas');
  for (const placement of gasVolumes) {
    try {
      const object = createGasVolumeObject(placement);
      updateVolumeVisual(object, placement);
      registerPermanentObject({ scene, mapId, placement, object, type: 'gas', supportsTexture: false });
      permanentVolumeEffects.push({ ...placement, type: 'gas', objectType: 'gas' });
    } catch (error) {
      console.warn(`[Rule Beast] editor gas/fog failed: ${placement.id}`, error.message);
    }
  }

  for (const marker of data.spawnMarkers || []) {
    const object = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), new THREE.MeshBasicMaterial({ color: marker.spawnRole === 'monster' ? 0xff3658 : 0x75f6ff }));
    applyTransform(object, marker);
    registerPermanentObject({ scene, mapId, placement: marker, object, type: 'spawnMarker', supportsTexture: false });
  }

  for (const marker of data.puzzleStationMarkers || []) {
    const object = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 28), new THREE.MeshBasicMaterial({ color: 0x75f6ff }));
    object.rotation.x = Math.PI / 2;
    applyTransform(object, marker);
    registerPermanentObject({ scene, mapId, placement: marker, object, type: 'puzzleStationMarker', supportsTexture: false });
  }

  for (const lightInfo of data.lights || []) {
    const light = new THREE.PointLight(lightInfo.color || 0x75f6ff, lightInfo.intensity || 0.8, lightInfo.distance || 8, 2);
    light.position.set(lightInfo.position?.x || lightInfo.x || 0, lightInfo.position?.y || lightInfo.y || 2.5, lightInfo.position?.z || lightInfo.z || 0);
    scene.add(light);
    permanentOverrideObjects.push(light);
  }

  for (const sun of data.sunLights || []) {
    try {
      applySunLightSettings(scene, mapId, sun);
    } catch (error) {
      console.warn(`[Rule Beast] editor sun/main light failed: ${sun.id}`, error.message);
    }
  }

  if (data.packageType === 'newMap' && (!(data.spawnMarkers || []).length || !(data.puzzleStationMarkers || []).length)) {
    console.warn(`[Rule Beast] editor new map ${mapId} is missing spawn or puzzle station marker data.`);
  }

  return data;
}

export async function applyPermanentEditorOverrides(options) {
  return loadPermanentEditorOverrides(options);
}
