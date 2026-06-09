import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EditorUI } from './editorUI.js';
import { EditorState } from './editorState.js';
import { buildEditorExport, downloadEditorJson, stringifyEditorExport } from './editorExport.js';
import { buildCodexPackage, downloadCodexPackage } from './editorPackage.js';
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
const MIN_SCALE = 0.1;
const EDITOR_MOVE_STEP = 0.5;
const EDITOR_VERTICAL_MOVE_STEP = 0.5;
const EDITOR_ROTATE_STEP = Math.PI / 12;
const EDITOR_SCALE_STEP = 0.1;
const EDITOR_FLY_SPEED = 8.5;
const MODEL_KEY_CODES = ['KeyQ', 'KeyE', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'Backspace', 'Escape'];
const FLY_KEY_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'];
const GAME_ACTION_CODES = ['KeyE', 'KeyF', 'KeyQ', 'KeyR', 'Space'];

const nextId = (prefix, list) => `${prefix}_${String(list.length + 1).padStart(3, '0')}_${Date.now().toString(36)}`;
const repoPath = (folder, name) => `assets/${folder}/${name.replace(/[^a-z0-9._-]/gi, '_')}`;
const clampBrightness = (brightness = 1) => THREE.MathUtils.clamp(Number(brightness) || 1, 0.25, 2.5);
const toPlainVector = (v) => ({ x: Number(v.x.toFixed(3)), y: Number(v.y.toFixed(3)), z: Number(v.z.toFixed(3)) });

export function initAssetEditor(options) {
  return new AssetEditor(options);
}

export function applyBrightnessToMaterial(material, brightness = 1) {
  if (!material) return;
  const b = clampBrightness(brightness);
  material.userData ||= {};
  if (material.color && !material.userData.editorOriginalColor) material.userData.editorOriginalColor = material.color.clone();
  if (material.emissive && !material.userData.editorOriginalEmissive) material.userData.editorOriginalEmissive = material.emissive.clone();
  if (material.emissive && material.userData.editorOriginalEmissiveIntensity === undefined) material.userData.editorOriginalEmissiveIntensity = material.emissiveIntensity || 0;
  if (material.color && material.userData.editorOriginalColor) material.color.copy(material.userData.editorOriginalColor).multiplyScalar(b);
  if (material.emissive && material.userData.editorOriginalEmissive) {
    material.emissive.copy(material.userData.editorOriginalEmissive).multiplyScalar(Math.max(1, b * 0.55));
    material.emissiveIntensity = material.userData.editorOriginalEmissiveIntensity + (b > 1 ? 0.08 * (b - 1) : 0);
  }
  material.needsUpdate = true;
}

function materialArray(material) {
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

function cloneMaterialValue(material) {
  return Array.isArray(material) ? material.map((item) => item.clone()) : material?.clone?.();
}

function assignMaterial(target, materials) {
  if (Array.isArray(target.material)) target.material = materials;
  else target.material = materials[0] || target.material;
}

function ensureEditableMaterials(target) {
  if (!target?.material) return [];
  target.userData ||= {};
  if (!target.userData.editorOriginalMaterials) target.userData.editorOriginalMaterials = cloneMaterialValue(target.material);
  if (!target.userData.editorMaterialCloned) {
    target.material = cloneMaterialValue(target.material);
    target.userData.editorMaterialCloned = true;
  }
  return materialArray(target.material);
}

function resetEditableMaterials(target) {
  if (!target?.userData?.editorOriginalMaterials) return false;
  target.material = cloneMaterialValue(target.userData.editorOriginalMaterials);
  target.userData.editorMaterialCloned = false;
  return true;
}

class AssetEditor {
  constructor(options) {
    this.options = options;
    this.state = new EditorState();
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.enabled = false;
    this.toolMode = 'select';
    this.selectedTextureId = '';
    this.selectedModelId = '';
    this.editorCollisionEnabled = true;
    this.editorKeys = new Set();
    this.messages = [];
    initializeEditableRegistry(options.scene);
    setSelectionChangedHandler((meta) => this.onSelectionChanged(meta));
    this.ui = new EditorUI({
      unlock: (code) => this.unlock(code),
      close: () => this.close(),
      setToolMode: (mode) => this.setToolMode(mode),
      importTexture: (file) => this.importTexture(file),
      selectTexture: (id) => this.selectTexture(id),
      removeTexture: (id) => this.removeTexture(id),
      importModel: (file) => this.importModel(file),
      selectModel: (id) => this.selectModel(id),
      removeModel: (id) => this.removeModel(id),
      selectPlacedModel: (id) => this.selectPlacedModel(id),
      applySelectedTexture: () => this.applySelectedTextureToSelectedSurface(),
      resetSurface: () => this.resetSelectedSurface(),
      changeBrightness: (brightness) => this.changeSelectedBrightness(brightness),
      updateSurfaceRepeat: (repeat) => this.updateSelectedSurfaceRepeat(repeat),
      modelAction: (action, steps) => this.modelAction(action, steps),
      setModelRotation: (degrees) => this.setSelectedModelRotation(degrees),
      setModelScale: (axis, value) => this.setSelectedModelScale(axis, value),
      duplicateModel: () => this.duplicateSelectedModel(),
      deleteModel: () => this.deleteSelectedModel(),
      saveDraft: () => this.saveDraft(),
      loadDraft: () => this.loadDraft(),
      clearDraft: () => this.clearDraft(),
      exportJson: () => this.exportJson(),
      exportCodexPackage: () => this.exportCodexPackage(),
      toggleCollision: () => this.toggleEditorCollision()
    });
    options.renderer.domElement.addEventListener('pointerdown', (event) => this.handleCanvasPointerDown(event), true);
    options.renderer.domElement.addEventListener('dragover', (event) => this.handleCanvasDragOver(event), true);
    options.renderer.domElement.addEventListener('drop', (event) => this.handleCanvasDrop(event), true);
    this.refreshObjects();
    this.log('Editor ready. Unlock with code: edit.');
  }

  currentMapId() {
    return this.options.getCurrentMapId?.() || 'unknown';
  }

  currentMapName() {
    return this.options.getCurrentMapName?.() || this.currentMapId();
  }

  isEditorModeActive() {
    return this.enabled;
  }

  isTypingInInput(event) {
    const target = event.target;
    if (!target || !(target instanceof Element)) return false;
    const tag = target.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  hasSelectedPlacedModel() {
    const meta = getSelectedEditableObject();
    return Boolean(meta?.supportsTransform && this.state.modelPlacement(meta.id));
  }

  shouldUseEditorMovement() {
    return this.enabled && !this.hasSelectedPlacedModel();
  }

  editorFlyInput() {
    return {
      forward: this.editorKeys.has('KeyW'),
      back: this.editorKeys.has('KeyS'),
      left: this.editorKeys.has('KeyA'),
      right: this.editorKeys.has('KeyD'),
      up: this.editorKeys.has('Space'),
      down: this.editorKeys.has('ShiftLeft') || this.editorKeys.has('ShiftRight') || this.editorKeys.has('ControlLeft') || this.editorKeys.has('ControlRight'),
      collision: this.editorCollisionEnabled,
      speed: EDITOR_FLY_SPEED
    };
  }

  toggleEditorCollision() {
    this.editorCollisionEnabled = !this.editorCollisionEnabled;
    this.refreshObjects();
    this.log(`Editor collision ${this.editorCollisionEnabled ? 'ON' : 'OFF'}.`);
    return this.editorCollisionEnabled;
  }

  handleEditorKeyboard(event, pressed = true) {
    if (!this.enabled || this.isTypingInInput(event)) return false;
    const code = event.code;
    const selectedModel = this.hasSelectedPlacedModel();

    if (selectedModel && MODEL_KEY_CODES.includes(code)) {
      event.preventDefault();
      event.stopPropagation();
      if (pressed) this.handleSelectedModelKey(code);
      return true;
    }

    if (!selectedModel && FLY_KEY_CODES.includes(code)) {
      event.preventDefault();
      event.stopPropagation();
      if (pressed) this.editorKeys.add(code);
      else this.editorKeys.delete(code);
      return true;
    }

    if (code === 'KeyC') {
      event.preventDefault();
      event.stopPropagation();
      if (pressed && !event.repeat) this.toggleEditorCollision();
      return true;
    }

    if (code.startsWith('Arrow')) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    if (GAME_ACTION_CODES.includes(code)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
  }

  handleSelectedModelKey(code) {
    const steps = this.ui.controlSteps?.() || {
      move: EDITOR_MOVE_STEP,
      verticalMove: EDITOR_VERTICAL_MOVE_STEP,
      rotate: EDITOR_ROTATE_STEP,
      scale: EDITOR_SCALE_STEP
    };
    const verticalMove = steps.verticalMove || steps.move || EDITOR_VERTICAL_MOVE_STEP;
    if (code === 'KeyQ') return this.modelAction('bigger', steps);
    if (code === 'KeyE') return this.modelAction('smaller', steps);
    if (code === 'KeyW') return this.modelAction('move-forward', steps);
    if (code === 'KeyA') return this.modelAction('move-left', steps);
    if (code === 'KeyS') return this.modelAction('move-back', steps);
    if (code === 'KeyD') return this.modelAction('move-right', steps);
    if (code === 'ArrowUp') return this.modelAction('move-up', { ...steps, move: verticalMove });
    if (code === 'ArrowDown') return this.modelAction('move-down', { ...steps, move: verticalMove });
    if (code === 'ArrowLeft') return this.modelAction('rotate-left', steps);
    if (code === 'ArrowRight') return this.modelAction('rotate-right', steps);
    if (code === 'Delete' || code === 'Backspace') return this.deleteSelectedModel();
    if (code === 'Escape') {
      clearEditableSelection();
      this.setToolMode('select');
      this.refreshObjects();
      return null;
    }
    return null;
  }

  unlock(code) {
    if (code !== this.options.adminCode) {
      this.log('Wrong editor code.');
      return;
    }
    this.enabled = true;
    this.ui.setUnlocked(true);
    this.setToolMode('select');
    this.options.onEditorModeChange?.(true);
    this.refreshObjects();
    this.log('Editor mode enabled. Local testing only.');
  }

  close() {
    this.enabled = false;
    this.editorKeys.clear();
    this.editorCollisionEnabled = true;
    clearEditableSelection();
    this.ui.setUnlocked(false);
    this.options.onEditorModeChange?.(false);
    this.log('Editor closed. Normal gameplay controls restored.');
  }

  setToolMode(mode) {
    this.toolMode = ['select', 'paint', 'place', 'edit'].includes(mode) ? mode : 'select';
    this.ui.setToolMode(this.toolMode);
  }

  refreshObjects() {
    const selected = getSelectedEditableObject();
    this.ui.setMapSummary(`Map: ${this.currentMapName()} (${this.currentMapId()})`);
    this.ui.setStatus?.({
      editorActive: this.enabled,
      flyActive: this.shouldUseEditorMovement(),
      collisionEnabled: this.editorCollisionEnabled,
      toolMode: this.toolMode,
      selectedId: selected?.id || 'none'
    });
    this.ui.setTextures(this.state.textures, this.selectedTextureId);
    this.ui.setModels(this.state.models, this.selectedModelId);
    this.ui.setPlacedModels(this.state.placedModels, selected?.id);
    this.updateStats();
  }

  selectTexture(id) {
    this.selectedTextureId = id;
    this.setToolMode('paint');
    this.refreshObjects();
    this.log('Texture selected. Click a surface or drag the texture onto the map.');
  }

  removeTexture(id) {
    const texture = this.state.textures.find((item) => item.id === id);
    if (texture?.temporaryLocalUrl) URL.revokeObjectURL(texture.temporaryLocalUrl);
    this.state.removeTexture(id);
    if (this.selectedTextureId === id) this.selectedTextureId = '';
    this.refreshObjects();
    this.log('Texture removed from My Textures.');
  }

  selectModel(id) {
    this.selectedModelId = id;
    this.setToolMode('place');
    this.refreshObjects();
    this.log('Model selected. Click the map or drag the model into the canvas.');
  }

  removeModel(id) {
    const model = this.state.models.find((item) => item.id === id);
    if (model?.temporaryLocalUrl) URL.revokeObjectURL(model.temporaryLocalUrl);
    this.state.removeModel(id);
    if (this.selectedModelId === id) this.selectedModelId = '';
    this.refreshObjects();
    this.log('Model removed from My Models. Already placed copies stay in the map.');
  }

  selectPlacedModel(id) {
    if (selectEditableObject(id)) this.setToolMode('edit');
    else this.log('Placed object is missing from the scene. Re-upload local files to restore it.');
    this.refreshObjects();
  }

  validateTexture(file) {
    if (!file) throw new Error('Choose a texture file first.');
    const lower = file.name.toLowerCase();
    if (!TEXTURE_EXTENSIONS.some((ext) => lower.endsWith(ext)) || !TEXTURE_MIMES.includes(file.type)) throw new Error('Use png, jpg, jpeg, or webp textures.');
  }

  async importTexture(file) {
    try {
      this.validateTexture(file);
      const url = URL.createObjectURL(file);
      const warnings = [];
      if (file.size > 5 * 1024 * 1024) warnings.push('Texture is over 5 MB.');
      const texture = await this.loadTexture(url);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      const image = await this.loadImage(url).catch(() => null);
      if (image && (image.naturalWidth > 2048 || image.naturalHeight > 2048)) warnings.push('Texture resolution is over 2048x2048.');
      const meta = this.state.addTexture({
        id: nextId('texture', this.state.textures),
        name: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        width: image?.naturalWidth || null,
        height: image?.naturalHeight || null,
        temporaryLocalUrl: url,
        intendedRepoPath: repoPath('textures', file.name),
        createdAt: Date.now(),
        warnings,
        textureObject: texture,
        imageElement: image,
        originalFile: file
      });
      warnings.forEach((warning) => this.state.warn(`${file.name}: ${warning}`));
      this.selectTexture(meta.id);
      this.log(`Texture uploaded: ${file.name}`);
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

  validateGlb(file) {
    if (!file) throw new Error('Choose a GLB file first.');
    if (!file.name.toLowerCase().endsWith('.glb') || !GLB_MIMES.includes(file.type)) throw new Error('Use .glb model files only.');
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
        gltf,
        originalFile: file
      });
      this.selectModel(meta.id);
      this.log(`GLB uploaded: ${file.name}`);
    } catch (error) {
      this.state.warn(error.message);
      this.log(error.message);
    }
  }

  loadGlb(url) {
    return new Promise((resolve, reject) => this.loader.load(url, resolve, undefined, reject));
  }

  analyzeModel(file, gltf) {
    const warnings = [];
    if (file.size > 25 * 1024 * 1024) warnings.push('Strong warning: model is over 25 MB.');
    else if (file.size > 10 * 1024 * 1024) warnings.push('Model is over 10 MB.');
    let meshes = 0;
    const materials = new Set();
    gltf.scene.traverse((child) => {
      if (!child.isMesh) return;
      meshes += 1;
      materialArray(child.material).filter(Boolean).forEach((material) => materials.add(material));
    });
    if (meshes > 100) warnings.push('Model has many meshes.');
    if (materials.size > 20) warnings.push('Model has many materials.');
    if (gltf.animations?.length) warnings.push('Animations are ignored in this simple editor.');
    return warnings;
  }

  raycastEditorTarget(event) {
    const rect = this.options.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.options.camera);
    const objects = getEditableObjects().map((meta) => meta.object3D);
    const hit = this.raycaster.intersectObjects(objects, true)[0];
    if (!hit) return { point: null, meta: null };
    let object = hit.object;
    while (object && !object.userData.editableId) object = object.parent;
    return { point: hit.point, meta: object?.userData.editableId ? getEditableObject(object.userData.editableId) : null };
  }

  handleCanvasPointerDown(event) {
    if (!this.enabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = this.raycastEditorTarget(event);
    if (this.toolMode === 'paint') {
      if (!target.meta) return this.log('Click an editable surface to paint it.');
      return this.paintTextureOnSurface(target.meta);
    }
    if (this.toolMode === 'place') return this.placeModelAtPoint(target.point);
    if (target.meta) {
      selectEditableObject(target.meta.id);
      if (target.meta.supportsTransform) this.setToolMode('edit');
      this.refreshObjects();
    } else if (this.toolMode === 'select') {
      clearEditableSelection();
      this.refreshObjects();
    }
  }

  handleCanvasDragOver(event) {
    if (!this.enabled) return;
    event.preventDefault();
  }

  handleCanvasDrop(event) {
    if (!this.enabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const raw = event.dataTransfer?.getData('application/x-rule-beast-editor');
    if (!raw) return;
    const payload = JSON.parse(raw);
    const target = this.raycastEditorTarget(event);
    if (payload.kind === 'texture') {
      this.selectedTextureId = payload.id;
      return target.meta ? this.paintTextureOnSurface(target.meta) : this.log('Drop textures onto an editable surface.');
    }
    if (payload.kind === 'model') {
      this.selectedModelId = payload.id;
      return this.placeModelAtPoint(target.point);
    }
  }

  paintTextureOnSurface(meta) {
    if (!meta?.supportsTexture) return this.log('That object cannot accept a texture.');
    const texture = this.state.textures.find((item) => item.id === this.selectedTextureId);
    if (!texture?.textureObject) return this.log('Select an uploaded texture first.');
    const repeat = this.state.surfaceEdit(meta.id)?.repeat || { x: 1, y: 1 };
    this.applyTextureToSurface(meta, texture, repeat);
    selectEditableObject(meta.id);
    this.refreshObjects();
    this.log(`Painted ${texture.name} on ${meta.id}`);
  }

  applySelectedTextureToSelectedSurface() {
    const meta = getSelectedEditableObject();
    if (!meta) return this.log('Select a surface first.');
    this.paintTextureOnSurface(meta);
  }

  applyTextureToSurface(meta, textureMeta, repeat = { x: 1, y: 1 }) {
    const target = meta.materialTarget || meta.object3D;
    const materials = ensureEditableMaterials(target);
    const brightness = this.state.surfaceEdit(meta.id)?.brightness || 1;
    materials.forEach((material) => {
      const texture = textureMeta.textureObject.clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat.x, repeat.y);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      material.map = texture;
      if (material.color) {
        material.color.set(0xffffff);
        material.userData.editorOriginalColor = new THREE.Color(0xffffff);
      }
      applyBrightnessToMaterial(material, brightness);
    });
    this.state.upsertSurfaceEdit({
      targetId: meta.id,
      targetType: meta.type,
      mapId: this.currentMapId(),
      textureId: textureMeta.id,
      textureName: textureMeta.name,
      brightness,
      surfaceBrightness: brightness,
      repeat,
      updatedAt: Date.now()
    });
  }

  updateSelectedSurfaceRepeat(repeat) {
    const meta = getSelectedEditableObject();
    if (!meta || meta.supportsTransform) return;
    const edit = this.state.surfaceEdit(meta.id);
    const texture = edit ? this.state.textures.find((item) => item.id === edit.textureId) : null;
    if (!texture?.textureObject) return;
    this.applyTextureToSurface(meta, texture, repeat);
    this.refreshObjects();
  }

  applySurfaceBrightness(meta, brightness) {
    if (!meta?.supportsTexture) return;
    const target = meta.materialTarget || meta.object3D;
    const materials = ensureEditableMaterials(target);
    materials.forEach((material) => applyBrightnessToMaterial(material, brightness));
    const existing = this.state.surfaceEdit(meta.id) || {};
    this.state.upsertSurfaceEdit({
      ...existing,
      targetId: meta.id,
      targetType: meta.type,
      mapId: this.currentMapId(),
      brightness: clampBrightness(brightness),
      surfaceBrightness: clampBrightness(brightness),
      repeat: existing.repeat || { x: 1, y: 1 },
      updatedAt: Date.now()
    });
  }

  resetSelectedSurface() {
    const meta = getSelectedEditableObject();
    if (!meta || meta.supportsTransform) return this.log('Select a surface first.');
    const target = meta.materialTarget || meta.object3D;
    resetEditableMaterials(target);
    this.state.removeSurfaceEdit(meta.id);
    this.refreshObjects();
    this.log(`Reset surface: ${meta.id}`);
  }

  cloneModelScene(scene) {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      child.material = cloneMaterialValue(child.material);
      materialArray(child.material).forEach((material) => applyBrightnessToMaterial(material, 1));
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }

  placeModelAtPoint(point = null) {
    const asset = this.state.models.find((item) => item.id === this.selectedModelId);
    if (!asset?.loadedScene) return this.log('Select an uploaded GLB model first.');
    const object = this.cloneModelScene(asset.loadedScene);
    const player = this.options.getPlayerPosition?.() || new THREE.Vector3(0, 0, 0);
    const position = point
      ? { x: point.x, y: Math.max(-8, point.y), z: point.z }
      : { x: player.x + 1.5, y: player.y || 0, z: player.z - 1.5 };
    object.position.set(position.x, position.y, position.z);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    this.options.scene.add(object);
    const placement = this.state.addPlacedModel({
      id: nextId('placedModel', this.state.placedModels),
      modelAssetId: asset.id,
      modelName: asset.name,
      mapId: this.currentMapId(),
      floor: this.floorFromY(position.y),
      zone: 'editor_local',
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, uniform: 1 },
      brightness: 1,
      modelBrightness: 1,
      visualOnly: true,
      object3D: object
    });
    registerEditableObject({
      id: placement.id,
      type: 'model',
      category: 'placed-model',
      mapId: placement.mapId,
      floor: placement.floor,
      zone: placement.zone,
      object3D: object,
      supportsTexture: false,
      supportsTransform: true,
      source: 'editor-import'
    });
    selectEditableObject(placement.id);
    this.setToolMode('edit');
    this.refreshObjects();
    this.log(`Placed visual-only model: ${asset.name}`);
    return placement;
  }

  floorFromY(y) {
    const layout = this.options.getCurrentMapLayout?.();
    const floors = layout?.floors || [{ id: 'ground', y: 0 }];
    return floors.reduce((best, floor) => Math.abs((floor.y || 0) - y) < Math.abs((best.y || 0) - y) ? floor : best, floors[0]).id;
  }

  selectedPlacement() {
    const meta = getSelectedEditableObject();
    if (!meta?.supportsTransform) return null;
    return this.state.modelPlacement(meta.id);
  }

  updatePlacementFromObject(placement, object) {
    const patch = {
      position: toPlainVector(object.position),
      rotation: toPlainVector(object.rotation),
      scale: {
        x: Number(object.scale.x.toFixed(3)),
        y: Number(object.scale.y.toFixed(3)),
        z: Number(object.scale.z.toFixed(3)),
        uniform: Number(((object.scale.x + object.scale.y + object.scale.z) / 3).toFixed(3))
      },
      floor: this.floorFromY(object.position.y)
    };
    this.state.updatePlacedModel(placement.id, patch);
    refreshSelectionHighlight();
    this.refreshObjects();
  }

  applyPlacementTransform(object, placement) {
    object.position.set(placement.position?.x || 0, placement.position?.y || 0, placement.position?.z || 0);
    object.rotation.set(placement.rotation?.x || 0, placement.rotation?.y || 0, placement.rotation?.z || 0);
    object.scale.set(
      Math.max(MIN_SCALE, placement.scale?.x || 1),
      Math.max(MIN_SCALE, placement.scale?.y || 1),
      Math.max(MIN_SCALE, placement.scale?.z || 1)
    );
    object.updateMatrixWorld(true);
  }

  restoreDraftPlacement(placement, asset) {
    if (!asset?.loadedScene) return false;
    const object = this.cloneModelScene(asset.loadedScene);
    this.applyPlacementTransform(object, placement);
    this.options.scene.add(object);
    placement.object3D = object;
    placement.missingLocalFile = false;
    registerEditableObject({
      id: placement.id,
      type: 'model',
      category: 'placed-model',
      mapId: placement.mapId || this.currentMapId(),
      floor: placement.floor || this.floorFromY(object.position.y),
      zone: placement.zone || 'editor_local',
      object3D: object,
      supportsTexture: false,
      supportsTransform: true,
      source: 'editor-import'
    });
    this.applyModelBrightness(placement, placement.modelBrightness || placement.brightness || 1);
    return true;
  }

  mutateSelectedModel(mutator) {
    const placement = this.selectedPlacement();
    const meta = getSelectedEditableObject();
    if (!placement || !meta?.object3D) {
      this.log('Select a placed model first.');
      return null;
    }
    mutator(meta.object3D, placement);
    meta.object3D.scale.set(
      Math.max(MIN_SCALE, meta.object3D.scale.x),
      Math.max(MIN_SCALE, meta.object3D.scale.y),
      Math.max(MIN_SCALE, meta.object3D.scale.z)
    );
    meta.object3D.updateMatrixWorld(true);
    this.updatePlacementFromObject(placement, meta.object3D);
    return placement;
  }

  modelAction(action, steps) {
    this.mutateSelectedModel((object) => {
      if (action === 'move-left') object.position.x -= steps.move;
      if (action === 'move-right') object.position.x += steps.move;
      if (action === 'move-forward') object.position.z -= steps.move;
      if (action === 'move-back') object.position.z += steps.move;
      if (action === 'move-up') object.position.y += steps.move;
      if (action === 'move-down') object.position.y -= steps.move;
      if (action === 'rotate-left') object.rotation.y -= steps.rotate;
      if (action === 'rotate-right') object.rotation.y += steps.rotate;
      if (action === 'reset-rotation') object.rotation.set(0, 0, 0);
      if (action === 'bigger') object.scale.multiplyScalar(1 + steps.scale);
      if (action === 'smaller') object.scale.multiplyScalar(Math.max(0.1, 1 - steps.scale));
      if (action === 'taller') object.scale.y += steps.scale;
      if (action === 'shorter') object.scale.y -= steps.scale;
      if (action === 'wider') object.scale.x += steps.scale;
      if (action === 'narrower') object.scale.x -= steps.scale;
      if (action === 'deeper') object.scale.z += steps.scale;
      if (action === 'thinner') object.scale.z -= steps.scale;
      if (action === 'reset-transform') {
        object.rotation.set(0, 0, 0);
        object.scale.set(1, 1, 1);
      }
    });
  }

  setSelectedModelRotation(degrees) {
    this.mutateSelectedModel((object) => {
      object.rotation.y = Number(degrees) * Math.PI / 180;
    });
  }

  setSelectedModelScale(axis, value) {
    this.mutateSelectedModel((object) => {
      const safe = Math.max(MIN_SCALE, Number(value) || 1);
      if (axis === 'uniform') object.scale.set(safe, safe, safe);
      if (axis === 'height') object.scale.y = safe;
      if (axis === 'width') object.scale.x = safe;
      if (axis === 'depth') object.scale.z = safe;
    });
  }

  applyModelBrightness(placement, brightness) {
    const object = placement?.object3D;
    if (!object) return;
    const b = clampBrightness(brightness);
    object.traverse((child) => {
      if (!child.isMesh) return;
      materialArray(child.material).forEach((material) => applyBrightnessToMaterial(material, b));
    });
    this.state.updatePlacedModel(placement.id, { brightness: b, modelBrightness: b });
    refreshSelectionHighlight();
    this.refreshObjects();
  }

  changeSelectedBrightness(brightness) {
    const meta = getSelectedEditableObject();
    if (!meta) return this.log('Select a surface or model first.');
    if (meta.supportsTransform) {
      const placement = this.selectedPlacement();
      this.applyModelBrightness(placement, brightness);
      return;
    }
    this.applySurfaceBrightness(meta, brightness);
    this.refreshObjects();
  }

  duplicateSelectedModel() {
    const placement = this.selectedPlacement();
    const asset = placement ? this.state.models.find((item) => item.id === placement.modelAssetId) : null;
    if (!placement || !asset) return this.log('Select a placed model to duplicate.');
    this.selectedModelId = asset.id;
    const duplicate = this.placeModelAtPoint(new THREE.Vector3(placement.position.x + 1, placement.position.y, placement.position.z));
    if (!duplicate) return;
    const meta = getSelectedEditableObject();
    meta.object3D.rotation.set(placement.rotation.x, placement.rotation.y, placement.rotation.z);
    meta.object3D.scale.set(placement.scale.x, placement.scale.y, placement.scale.z);
    this.applyModelBrightness(duplicate, placement.modelBrightness || placement.brightness || 1);
    this.updatePlacementFromObject(duplicate, meta.object3D);
    this.log(`Duplicated ${placement.id}`);
  }

  deleteSelectedModel() {
    const placement = this.selectedPlacement();
    const meta = getSelectedEditableObject();
    if (!placement || !meta) return this.log('Select a placed model to delete.');
    this.options.scene.remove(meta.object3D);
    unregisterEditableObject(placement.id);
    this.state.removePlacedModel(placement.id);
    clearEditableSelection();
    this.refreshObjects();
    this.log(`Deleted ${placement.id}`);
  }

  onSelectionChanged(meta) {
    if (!meta) {
      this.ui.setSelectedInfo(null);
      this.ui.setModelControlValues(null);
      return;
    }
    if (meta.supportsTransform) {
      const placement = this.state.modelPlacement(meta.id);
      this.ui.setSelectedInfo(meta, {
        modelName: placement?.modelName,
        brightness: placement?.modelBrightness || placement?.brightness || 1
      });
      this.ui.setModelControlValues(placement);
      this.setToolMode('edit');
      return;
    }
    const edit = this.state.surfaceEdit(meta.id);
    this.ui.setSelectedInfo(meta, {
      textureName: edit?.textureName,
      brightness: edit?.brightness || 1,
      repeat: edit?.repeat || { x: 1, y: 1 }
    });
  }

  saveDraft() {
    const draft = this.state.saveDraft(this.currentMapId());
    this.ui.setLastSaved(draft.savedAt);
    this.log('Local draft saved. Files themselves were not stored.');
  }

  loadDraft() {
    try {
      const runtimeTextures = new Map(this.state.textures.map((texture) => [texture.id, texture]));
      const runtimeModels = new Map(this.state.models.map((model) => [model.id, model]));
      this.state.placedModels.forEach((placement) => placement.object3D?.parent?.remove(placement.object3D));
      getEditableObjects().filter((meta) => meta.source === 'editor-import').forEach((meta) => unregisterEditableObject(meta.id));
      clearEditableSelection();
      const draft = this.state.loadDraft();
      if (!draft) return this.log('No local draft found.');
      this.state.textures = this.state.textures.map((texture) => ({ ...texture, ...runtimeTextures.get(texture.id) }));
      this.state.models = this.state.models.map((model) => ({ ...model, ...runtimeModels.get(model.id) }));
      this.state.placedModels.forEach((placement) => {
        const asset = this.state.models.find((model) => model.id === placement.modelAssetId);
        if (!this.restoreDraftPlacement(placement, asset)) placement.missingLocalFile = true;
      });
      this.selectedTextureId = '';
      this.selectedModelId = '';
      this.refreshObjects();
      this.ui.setLastSaved(this.state.lastSavedAt);
      this.log('Local draft metadata loaded. Re-upload files to restore previews.');
    } catch (error) {
      this.log(`Draft load failed: ${error.message}`);
    }
  }

  clearDraft() {
    this.state.clearDraft();
    this.ui.setLastSaved(null);
    this.log('Local draft cleared.');
  }

  exportJson() {
    const data = buildEditorExport({ mapId: this.currentMapId(), mapDisplayName: this.currentMapName(), state: this.state });
    const text = stringifyEditorExport(data);
    this.ui.setJsonText(text);
    const fileName = downloadEditorJson(data);
    this.log(`Export Editor JSON downloaded: ${fileName}`);
  }

  async exportCodexPackage() {
    try {
      const result = await buildCodexPackage({
        mapId: this.currentMapId(),
        mapDisplayName: this.currentMapName(),
        state: this.state
      });
      result.warnings.forEach((warning) => this.state.warn(warning));
      downloadCodexPackage(result);
      this.log(result.warnings.length
        ? `Export Codex Package downloaded: ${result.zipFileName}\n${result.warnings.join('\n')}`
        : `Export Codex Package downloaded: ${result.zipFileName}`);
    } catch (error) {
      this.state.warn(`Codex package export failed: ${error.message}`);
      this.log(`Codex package export failed: ${error.message}`);
    }
  }

  updateStats() {
    this.ui.setTextures(this.state.textures, this.selectedTextureId);
    this.ui.setModels(this.state.models, this.selectedModelId);
    this.ui.setPlacedModels(this.state.placedModels, getSelectedEditableObject()?.id);
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
