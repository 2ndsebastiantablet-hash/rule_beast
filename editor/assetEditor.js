import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EditorUI } from './editorUI.js';
import { EditorState } from './editorState.js';
import { buildAssetManifest, downloadManifest, parseManifestJson, stringifyManifest } from './editorManifest.js';
import {
  getEditableObject,
  getEditableObjects,
  getSelectedEditableObject,
  clearEditableSelection,
  initializeEditableRegistry,
  refreshSelectionHighlight,
  registerEditableObject,
  selectEditableObject,
  setSelectionChangedHandler,
  unregisterEditableObject
} from './editorRegistry.js';

const TEXTURE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const TEXTURE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const GLB_MIMES = ['model/gltf-binary', 'application/octet-stream', ''];

const nextId = (prefix, list) => `${prefix}_${String(list.length + 1).padStart(3, '0')}_${Date.now().toString(36)}`;
const repoPath = (folder, name) => `assets/${folder}/${name.replace(/[^a-z0-9._-]/gi, '_')}`;
const vectorToPlain = (v) => ({ x: Number(v.x.toFixed(3)), y: Number(v.y.toFixed(3)), z: Number(v.z.toFixed(3)) });

export function initAssetEditor(options) {
  return new AssetEditor(options);
}

class AssetEditor {
  constructor(options) {
    this.options = options;
    this.state = new EditorState();
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.messages = [];
    this.enabled = false;
    this.highlightEnabled = true;
    initializeEditableRegistry(options.scene);
    setSelectionChangedHandler((meta) => this.onSelectionChanged(meta));
    this.ui = new EditorUI({
      unlock: (code) => this.unlock(code),
      close: () => this.close(),
      refreshObjects: () => this.refreshObjects(),
      selectObject: (id) => this.selectObject(id),
      toggleHighlight: (enabled) => this.toggleHighlight(enabled),
      importTexture: (file) => this.importTexture(file),
      getTexture: (id) => this.state.textures.find((item) => item.id === id),
      applyTexture: () => this.applySelectedTexture(),
      removeTexture: () => this.removeTextureFromSelected(),
      updateTextureSettings: () => this.updateTextureSettings(),
      resetTextureSettings: () => this.resetTextureSettings(),
      importModel: (file) => this.importModel(file),
      placeModel: () => this.placeSelectedModel(),
      duplicateModel: () => this.duplicateSelectedModel(),
      deleteModel: () => this.deleteSelectedModel(),
      applyTransform: () => this.applyTransform(),
      resetTransform: () => this.resetTransform(),
      moveToPlayer: () => this.moveSelectedToPlayer(),
      saveDraft: () => this.saveDraft(),
      loadDraft: () => this.loadDraft(),
      clearDraft: () => this.clearDraft(),
      exportManifest: () => this.exportManifest(),
      copyManifest: () => this.copyManifest(),
      applyManifest: () => this.applyImportedManifest()
    });
    options.renderer.domElement.addEventListener('pointerdown', (event) => this.handleCanvasPointerDown(event), true);
    this.refreshObjects();
    this.log('Editor ready. Unlock with the prototype admin code.');
  }

  currentMapId() {
    return this.options.getCurrentMapId?.() || 'unknown';
  }

  currentMapName() {
    return this.options.getCurrentMapName?.() || this.currentMapId();
  }

  unlock(code) {
    if (code !== this.options.adminCode) {
      this.log('Wrong admin code. Editor remains locked.');
      return;
    }
    this.enabled = true;
    this.ui.setUnlocked(true);
    this.refreshObjects();
    this.log('Editor Mode enabled. Local-only assets are not synced or uploaded.');
  }

  close() {
    this.enabled = false;
    clearEditableSelection();
    this.ui.setUnlocked(false);
    this.log('Editor Mode closed. Gameplay controls are normal.');
  }

  refreshObjects() {
    const selected = getSelectedEditableObject();
    this.ui.setMapSummary(`Map: ${this.currentMapName()} (${this.currentMapId()})`);
    this.ui.setObjectOptions(getEditableObjects(), selected?.id);
    this.updateStats();
  }

  selectObject(id) {
    const meta = selectEditableObject(id);
    if (!meta) this.log('No editable object selected.');
  }

  toggleHighlight(enabled) {
    this.highlightEnabled = enabled;
    if (!enabled) selectEditableObject('');
    else {
      const id = this.ui.selectedObjectId();
      if (id) selectEditableObject(id);
    }
  }

  onSelectionChanged(meta) {
    if (!this.highlightEnabled && meta) return;
    this.ui.setSelectedInfo(meta);
    const edit = meta ? this.state.surfaceEdits.find((item) => item.targetId === meta.id) : null;
    this.ui.setTextureSettings(edit || null);
    if (meta?.supportsTransform) {
      this.ui.setTransformValues({
        position: meta.object3D.position,
        rotation: meta.object3D.rotation,
        scale: meta.object3D.scale
      });
    }
  }

  validateTexture(file) {
    if (!file) throw new Error('Choose a texture file first.');
    const lower = file.name.toLowerCase();
    if (!TEXTURE_EXTENSIONS.some((ext) => lower.endsWith(ext)) || !TEXTURE_MIMES.includes(file.type)) {
      throw new Error('Unsupported texture format. Use png, jpg, jpeg, or webp.');
    }
  }

  async importTexture(file) {
    try {
      this.validateTexture(file);
      const url = URL.createObjectURL(file);
      const warnings = [];
      if (file.size > 5 * 1024 * 1024) warnings.push('Texture is larger than 5 MB and may lag in browser/VR.');
      const texture = await this.loadTexture(url);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      const image = await this.loadImage(url).catch(() => null);
      if (image && (image.naturalWidth > 2048 || image.naturalHeight > 2048)) warnings.push('Texture resolution is above 2048x2048.');
      const meta = this.state.addTexture({
        id: nextId('texture', this.state.textures),
        name: file.name,
        type: 'texture',
        fileType: file.type,
        fileSizeBytes: file.size,
        temporaryLocalUrl: url,
        intendedRepoPath: repoPath('textures', file.name),
        createdAt: Date.now(),
        warnings,
        textureObject: texture,
        imageElement: image
      });
      warnings.forEach((warning) => this.state.warn(`${file.name}: ${warning}`));
      this.ui.setTextureOptions(this.state.textures);
      this.log(`Texture imported: ${meta.name}`);
    } catch (error) {
      this.state.warn(error.message);
      this.log(error.message);
    }
  }

  loadTexture(url) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(url, resolve, undefined, reject);
    });
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  textureSettingsOrDefault() {
    const settings = this.ui.textureSettings();
    if (settings.repeat.x <= 0 || settings.repeat.y <= 0) throw new Error('Texture repeat values must be positive.');
    return settings;
  }

  applySelectedTexture() {
    try {
      const meta = getSelectedEditableObject();
      const texture = this.state.textures.find((item) => item.id === this.ui.selectedTextureId());
      if (!meta) throw new Error('Select an editable object first.');
      if (!meta.supportsTexture) throw new Error('Selected object does not support texture editing.');
      if (!texture?.textureObject) throw new Error('Select an imported texture from this browser session.');
      this.applyTextureToObject(meta, texture, this.textureSettingsOrDefault());
      this.log(`Applied ${texture.name} to ${meta.id}`);
    } catch (error) {
      this.state.warn(error.message);
      this.log(error.message);
    }
  }

  applyTextureToObject(meta, textureMeta, settings) {
    const target = meta.materialTarget || meta.object3D;
    const materials = Array.isArray(target.material) ? target.material : [target.material];
    const clonedMaterials = materials.map((material) => {
      const clone = material.clone();
      const texture = textureMeta.textureObject.clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(settings.repeat.x, settings.repeat.y);
      texture.offset.set(settings.offset.x, settings.offset.y);
      texture.rotation = settings.rotation;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      clone.map = texture;
      clone.needsUpdate = true;
      return clone;
    });
    target.material = Array.isArray(target.material) ? clonedMaterials : clonedMaterials[0];
    this.state.upsertSurfaceEdit({
      targetId: meta.id,
      textureId: textureMeta.id,
      textureName: textureMeta.name,
      repeat: settings.repeat,
      offset: settings.offset,
      rotation: settings.rotation,
      appliedAt: Date.now()
    });
    this.updateStats();
  }

  removeTextureFromSelected() {
    const meta = getSelectedEditableObject();
    if (!meta?.supportsTexture) return this.log('Select a textured surface first.');
    const target = meta.materialTarget || meta.object3D;
    const materials = Array.isArray(target.material) ? target.material : [target.material];
    const cleaned = materials.map((material) => {
      const clone = material.clone();
      clone.map = null;
      clone.needsUpdate = true;
      return clone;
    });
    target.material = Array.isArray(target.material) ? cleaned : cleaned[0];
    this.state.removeSurfaceEdit(meta.id);
    this.updateStats();
    this.log(`Removed texture from ${meta.id}`);
  }

  updateTextureSettings() {
    const meta = getSelectedEditableObject();
    const edit = meta ? this.state.surfaceEdits.find((item) => item.targetId === meta.id) : null;
    const texture = edit ? this.state.textures.find((item) => item.id === edit.textureId) : null;
    if (!meta || !edit || !texture?.textureObject) return this.log('Apply a texture before updating settings.');
    try {
      this.applyTextureToObject(meta, texture, this.textureSettingsOrDefault());
    } catch (error) {
      this.log(error.message);
    }
  }

  resetTextureSettings() {
    this.ui.setTextureSettings(null);
    this.updateTextureSettings();
  }

  validateGlb(file) {
    if (!file) throw new Error('Choose a GLB file first.');
    if (!file.name.toLowerCase().endsWith('.glb') || !GLB_MIMES.includes(file.type)) throw new Error('Unsupported model format. Use .glb only.');
  }

  async importModel(file) {
    try {
      this.validateGlb(file);
      const url = URL.createObjectURL(file);
      const gltf = await this.loadGlb(url);
      const warnings = this.analyzeModel(file, gltf);
      warnings.forEach((warning) => this.state.warn(`${file.name}: ${warning}`));
      const meta = this.state.addModel({
        id: nextId('modelAsset', this.state.models),
        name: file.name,
        fileSizeBytes: file.size,
        temporaryLocalUrl: url,
        intendedRepoPath: repoPath('models', file.name),
        createdAt: Date.now(),
        warnings,
        loadedScene: gltf.scene,
        gltf
      });
      this.ui.setModelOptions(this.state.models);
      this.log(`GLB imported: ${meta.name}. Models are visual-only for now.`);
    } catch (error) {
      this.state.warn(error.message);
      this.log(error.message);
    }
  }

  loadGlb(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }

  analyzeModel(file, gltf) {
    const warnings = [];
    if (file.size > 25 * 1024 * 1024) warnings.push('Strong warning: GLB is larger than 25 MB.');
    else if (file.size > 10 * 1024 * 1024) warnings.push('GLB is larger than 10 MB and may reduce performance.');
    let meshes = 0;
    const materials = new Set();
    const textures = new Set();
    gltf.scene.traverse((child) => {
      if (!child.isMesh) return;
      meshes += 1;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.filter(Boolean).forEach((material) => {
        materials.add(material);
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach((key) => {
          if (material[key]) textures.add(material[key]);
        });
      });
    });
    const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
    if (meshes > 100) warnings.push('Model has more than 100 meshes.');
    if (materials.size > 20) warnings.push('Model has more than 20 materials.');
    if (textures.size > 20) warnings.push('Model appears to use many textures.');
    if (Math.max(size.x, size.y, size.z) > 25) warnings.push('Model bounding box is extremely large.');
    if (Math.max(size.x, size.y, size.z) > 0 && Math.max(size.x, size.y, size.z) < 0.05) warnings.push('Model bounding box is extremely tiny.');
    if (gltf.animations?.length) warnings.push('Model contains animations; this editor treats models as static.');
    return warnings;
  }

  cloneModelScene(scene) {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = Array.isArray(child.material) ? child.material.map((mat) => mat.clone()) : child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }

  placeSelectedModel(transformOverride = null) {
    const asset = this.state.models.find((item) => item.id === this.ui.selectedModelId());
    if (!asset?.loadedScene) return this.log('Select an imported GLB from this browser session.');
    const object = this.cloneModelScene(asset.loadedScene);
    const player = this.options.getPlayerPosition?.() || new THREE.Vector3(0, 0, 0);
    const transform = transformOverride || {
      position: { x: player.x + 1.5, y: player.y || 0, z: player.z - 1.5 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };
    this.applyTransformToObject(object, transform);
    this.options.scene.add(object);
    const placement = this.state.addPlacedModel({
      id: nextId('placedModel', this.state.placedModels),
      modelAssetId: asset.id,
      modelName: asset.name,
      mapId: this.currentMapId(),
      floor: this.floorFromY(transform.position.y),
      zone: 'editor_local',
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
      visualOnly: true,
      object3D: object
    });
    registerEditableObject({
      id: placement.id,
      type: 'model',
      category: 'imported-model',
      mapId: placement.mapId,
      floor: placement.floor,
      zone: placement.zone,
      object3D: object,
      supportsTexture: false,
      supportsTransform: true,
      source: 'editor-import'
    });
    selectEditableObject(placement.id);
    this.refreshObjects();
    this.log(`Placed visual-only model: ${asset.name}`);
    return placement;
  }

  floorFromY(y) {
    const layout = this.options.getCurrentMapLayout?.();
    const floors = layout?.floors || [{ id: 'ground', y: 0 }];
    return floors.reduce((best, floor) => Math.abs((floor.y || 0) - y) < Math.abs((best.y || 0) - y) ? floor : best, floors[0]).id;
  }

  applyTransformToObject(object, transform) {
    object.position.set(transform.position.x, transform.position.y, transform.position.z);
    object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    object.updateMatrixWorld(true);
  }

  selectedPlacement() {
    const meta = getSelectedEditableObject();
    if (!meta?.supportsTransform) return null;
    return this.state.placedModels.find((item) => item.id === meta.id) || null;
  }

  applyTransform() {
    const placement = this.selectedPlacement();
    const meta = getSelectedEditableObject();
    if (!placement || !meta) return this.log('Select a placed imported model first.');
    const transform = this.ui.transformValues();
    this.applyTransformToObject(meta.object3D, transform);
    this.state.updatePlacedModel(placement.id, { ...transform, floor: this.floorFromY(transform.position.y) });
    refreshSelectionHighlight();
    this.log(`Updated transform for ${placement.id}`);
  }

  resetTransform() {
    this.ui.setTransformValues({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } });
    this.applyTransform();
  }

  moveSelectedToPlayer() {
    const player = this.options.getPlayerPosition?.() || new THREE.Vector3();
    const current = this.ui.transformValues();
    this.ui.setTransformValues({ ...current, position: vectorToPlain(player) });
    this.applyTransform();
  }

  duplicateSelectedModel() {
    const placement = this.selectedPlacement();
    const asset = placement ? this.state.models.find((item) => item.id === placement.modelAssetId) : null;
    if (!placement || !asset) return this.log('Select a placed model to duplicate.');
    this.ui.root.querySelector('#editor-model-select').value = asset.id;
    const transform = {
      position: { ...placement.position, x: placement.position.x + 1 },
      rotation: placement.rotation,
      scale: placement.scale
    };
    this.placeSelectedModel(transform);
  }

  deleteSelectedModel() {
    const placement = this.selectedPlacement();
    const meta = getSelectedEditableObject();
    if (!placement || !meta) return this.log('Select a placed model to delete.');
    this.options.scene.remove(meta.object3D);
    unregisterEditableObject(placement.id);
    this.state.removePlacedModel(placement.id);
    this.refreshObjects();
    this.log(`Deleted ${placement.id}`);
  }

  saveDraft() {
    const draft = this.state.saveDraft(this.currentMapId());
    this.ui.setLastSaved(draft.savedAt);
    this.log('Local draft saved. Binary files were not stored.');
  }

  loadDraft() {
    try {
      const draft = this.state.loadDraft();
      if (!draft) return this.log('No local draft found.');
      this.ui.setTextureOptions(this.state.textures);
      this.ui.setModelOptions(this.state.models);
      this.ui.setLastSaved(this.state.lastSavedAt);
      this.updateStats();
      this.log('Local draft metadata loaded. Re-import files to restore previews.');
    } catch (error) {
      this.log(`Draft load failed: ${error.message}`);
    }
  }

  clearDraft() {
    this.state.clearDraft();
    this.ui.setLastSaved(null);
    this.log('Local draft cleared.');
  }

  exportManifest() {
    const manifest = buildAssetManifest({ mapId: this.currentMapId(), mapDisplayName: this.currentMapName(), state: this.state });
    const text = stringifyManifest(manifest);
    this.ui.setManifestText(text);
    const fileName = downloadManifest(manifest);
    this.log(`Manifest exported: ${fileName}`);
  }

  async copyManifest() {
    const text = this.ui.manifestText();
    if (!text) return this.log('Export a manifest first.');
    try {
      await navigator.clipboard?.writeText(text);
      this.log('Manifest copied to clipboard.');
    } catch {
      this.log('Clipboard copy was unavailable. The manifest textarea contains the JSON.');
    }
  }

  applyImportedManifest() {
    try {
      const { manifest, warnings } = parseManifestJson(this.ui.manifestText());
      warnings.forEach((warning) => this.state.warn(warning));
      const missing = [];
      (manifest.surfaceEdits || []).forEach((edit) => {
        const meta = getEditableObject(edit.targetId);
        const texture = this.state.textures.find((item) => item.id === edit.textureId && item.textureObject);
        if (!meta || !texture) {
          missing.push(`Missing target or texture for ${edit.targetId}`);
          return;
        }
        this.applyTextureToObject(meta, texture, edit);
      });
      (manifest.placedModels || []).forEach((placement) => {
        const asset = this.state.models.find((item) => item.id === placement.modelAssetId && item.loadedScene);
        if (!asset) {
          missing.push(`Missing model asset for ${placement.id}`);
          return;
        }
        this.ui.root.querySelector('#editor-model-select').value = asset.id;
        this.placeSelectedModel(placement);
      });
      missing.forEach((message) => this.state.warn(message));
      this.log(missing.length ? missing.join('\n') : 'Imported manifest applied to current local assets.');
    } catch (error) {
      this.log(`Manifest import failed: ${error.message}`);
    }
  }

  handleCanvasPointerDown(event) {
    if (!this.enabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const rect = this.options.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.options.camera);
    const editable = getEditableObjects().map((meta) => meta.object3D);
    const hit = this.raycaster.intersectObjects(editable, true)[0];
    if (!hit) return;
    let object = hit.object;
    while (object && !object.userData.editableId) object = object.parent;
    if (object?.userData.editableId) {
      selectEditableObject(object.userData.editableId);
      this.refreshObjects();
    }
  }

  updateStats() {
    this.ui.setTextureOptions(this.state.textures);
    this.ui.setModelOptions(this.state.models);
    this.ui.setCounts({
      textures: this.state.textures.length,
      models: this.state.models.length,
      placements: this.state.placedModels.length,
      surfaceEdits: this.state.surfaceEdits.length
    });
    this.ui.log([...this.state.warnings.map((warning) => warning.message || warning), ...this.messages].slice(-10));
    refreshSelectionHighlight();
  }

  log(message) {
    if (message) this.messages.push(message);
    this.updateStats();
  }
}
