import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  getEditableObject,
  registerEditableObject,
  unregisterEditableObjectsBySource
} from './editorRegistry.js';
import { applyBrightnessToMaterial } from './assetEditor.js';

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
let permanentOverrideObjects = [];

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

export function clearPermanentEditorOverrides(scene) {
  permanentOverrideObjects.forEach((object) => object.parent?.remove(object));
  permanentOverrideObjects = [];
  unregisterEditableObjectsBySource('permanent-editor');
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
  const modelList = data.models || data.assets?.models || [];
  const textures = new Map(textureList.map((texture) => [texture.id, texture]));
  const models = new Map(modelList.map((model) => [model.id, model]));
  const loadedTextures = new Map();

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
      scene.add(object);
      permanentOverrideObjects.push(object);
      registerEditableObject({
        id: `permanent_${placement.id}`,
        type: 'model',
        category: 'placed-model',
        mapId,
        floor: placement.floor || 'ground',
        zone: placement.zone || 'permanent_editor',
        object3D: object,
        supportsTexture: false,
        supportsTransform: true,
        source: 'permanent-editor'
      });
    } catch (error) {
      console.warn(`[Rule Beast] editor model failed: ${path}`, error.message);
    }
  }

  return data;
}
