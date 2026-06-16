import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EditorUI } from './editorUI.js';
import { EditorState } from './editorState.js';
import { buildEditorExport, downloadEditorJson, stringifyEditorExport } from './editorExport.js';
import { buildCodexPackage, downloadCodexPackage } from './editorPackage.js';
import { SHAPE_CATEGORIES, SHAPE_LIBRARY, createShapeObject, getShapeDefinition } from './shapeLibrary.js';
import { createSunLightObject } from './editorLighting.js';
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
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const TEXTURE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const GLB_MIMES = ['model/gltf-binary', 'application/octet-stream', ''];
const SUN_DEFAULT = { color: '#fff4cc', intensity: 1.2, ambientBoost: 0.25, shadows: true, enabled: true, target: { x: 0, y: 0, z: 0 } };
const MIN_SCALE = 0.1;
const EDITOR_MOVE_STEP = 0.5;
const EDITOR_VERTICAL_MOVE_STEP = 0.5;
const EDITOR_ROTATE_STEP = Math.PI / 12;
const EDITOR_SCALE_STEP = 0.1;
const EDITOR_FLY_SPEED = 8.5;
const MODEL_KEY_CODES = ['KeyQ', 'KeyE', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'KeyZ', 'KeyX', 'KeyT', 'KeyG', 'KeyC', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'Backspace', 'Escape'];
const FLY_KEY_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'];
const GAME_ACTION_CODES = ['KeyE', 'KeyF', 'KeyQ', 'KeyR', 'KeyZ', 'KeyX', 'KeyT', 'KeyG', 'Space'];

const nextId = (prefix, list) => `${prefix}_${String(list.length + 1).padStart(3, '0')}_${Date.now().toString(36)}`;
const repoPath = (folder, name) => `assets/${folder}/${name.replace(/[^a-z0-9._-]/gi, '_')}`;
const clampBrightness = (brightness = 1) => THREE.MathUtils.clamp(Number(brightness) || 1, 0.25, 2.5);
const toPlainVector = (v) => ({ x: Number(v.x.toFixed(3)), y: Number(v.y.toFixed(3)), z: Number(v.z.toFixed(3)) });
const isSupportedMime = (file, allowed) => !file?.type || allowed.includes(file.type);

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

function stripPlacementForCopy(placement) {
  const { object3D, collisionHelper, animationMixer, animationAction, ...rest } = placement;
  return rest;
}

function ensureEditableMaterials(target) {
  if (!target?.material && target?.traverse) {
    const materials = [];
    target.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      materials.push(...ensureEditableMaterials(child));
    });
    return materials;
  }
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
  if (!target?.material && target?.traverse) {
    let reset = false;
    target.traverse((child) => { reset = resetEditableMaterials(child) || reset; });
    return reset;
  }
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
    this.selectedImageId = '';
    this.selectedModelId = '';
    this.selectedShapeId = '';
    this.editorCollisionEnabled = true;
    this.editorKeys = new Set();
    this.animationMixers = new Map();
    this.collisionHelpersVisible = false;
    this.collisionEditMode = false;
    this.collisionHelperGroup = new THREE.Group();
    this.collisionHelperGroup.name = 'editor-collision-helpers';
    this.options.scene.add(this.collisionHelperGroup);
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
      importImage: (file) => this.importImage(file),
      selectImage: (id) => this.selectImage(id),
      removeImage: (id) => this.removeImage(id),
      importModel: (file) => this.importModel(file),
      selectModel: (id) => this.selectModel(id),
      removeModel: (id) => this.removeModel(id),
      selectShape: (id) => this.selectShape(id),
      placeSun: () => this.placeSunLight(),
      updateSunSettings: (settings) => this.updateSelectedSunSettings(settings),
      updateMapSettings: (settings) => this.updateMapSettings(settings),
      placeMarker: (kind) => this.placeMapMarker(kind),
      selectPlacedModel: (id) => this.selectPlacedModel(id),
      updatePackageSettings: (settings) => this.updatePackageSettings(settings),
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
      toggleCollision: () => this.toggleSelectedObjectCollision(),
      toggleCollisionHelpers: () => this.toggleCollisionHelpers(),
      editCollisionBox: () => this.enterCollisionEditMode(),
      returnObjectEditing: () => this.returnToObjectEditing(),
      resetCollisionBox: () => this.resetSelectedCollisionBoxToObjectBounds()
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
    return this.state.packageDisplayName || this.options.getCurrentMapName?.() || this.currentMapId();
  }

  packageMapId() {
    return this.state.packageMapId || this.currentMapId();
  }

  updatePackageSettings(settings = {}) {
    this.state.setPackageSettings(settings);
    this.ui.setPackageSettings?.({
      packageType: this.state.packageType,
      mapId: this.packageMapId(),
      displayName: this.currentMapName()
    });
    this.refreshObjects();
  }

  updateMapSettings(settings = {}) {
    this.state.updateMapSettings(settings);
    this.refreshObjects();
    this.log(`Map gravity multiplier: ${this.state.mapSettings.gravityMultiplier}`);
  }

  startMapMakerSession(settings = {}) {
    this.enabled = true;
    this.editorKeys.clear();
    this.state.setPackageSettings(settings);
    this.ui.setUnlocked(true);
    this.ui.setMapMakerMode?.(true);
    this.ui.setPackageSettings?.({
      packageType: this.state.packageType,
      mapId: this.packageMapId(),
      displayName: this.currentMapName()
    });
    this.setToolMode('select');
    this.options.onEditorModeChange?.(true);
    this.refreshObjects();
    this.log('Map Maker enabled. Local-only workspace.');
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

  toggleCollisionHelpers() {
    this.collisionHelpersVisible = !this.collisionHelpersVisible;
    this.refreshCollisionHelpers();
    this.log(`Collision helper boxes ${this.collisionHelpersVisible ? 'shown' : 'hidden'}.`);
  }

  toggleSelectedObjectCollision() {
    const placement = this.selectedPlacement();
    if (!placement) return this.toggleEditorCollision();
    placement.collision ||= { enabled: true, type: 'box', size: { x: 1, y: 1, z: 1 }, offset: { x: 0, y: 0, z: 0 } };
    placement.collision.enabled = !placement.collision.enabled;
    this.updatePlacementCollision(placement, placement.object3D);
    this.refreshObjects();
    this.log(`${placement.id} collision ${placement.collision.enabled ? 'ON' : 'OFF'}.`);
    return placement.collision.enabled;
  }

  handleEditorKeyboard(event, pressed = true) {
    if (!this.enabled || this.isTypingInInput(event)) return false;
    const code = event.code;
    const selectedModel = this.hasSelectedPlacedModel();

    if (selectedModel && MODEL_KEY_CODES.includes(code)) {
      event.preventDefault();
      event.stopPropagation();
      if (pressed) {
        if (event.ctrlKey && code === 'KeyC') this.copySelectedObject();
        else this.handleSelectedModelKey(code);
      }
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
    if (code === 'KeyW') return this.modelAction('move-back', steps);
    if (code === 'KeyA') return this.modelAction('move-left', steps);
    if (code === 'KeyS') return this.modelAction('move-forward', steps);
    if (code === 'KeyD') return this.modelAction('move-right', steps);
    if (code === 'KeyR') return this.modelAction('taller', steps);
    if (code === 'KeyF') return this.modelAction('shorter', steps);
    if (code === 'KeyZ') return this.modelAction('wider', steps);
    if (code === 'KeyX') return this.modelAction('narrower', steps);
    if (code === 'KeyT') return this.modelAction('deeper', steps);
    if (code === 'KeyG') return this.modelAction('thinner', steps);
    if (code === 'KeyC') return this.toggleSelectedObjectCollision();
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
    this.ui.setMapMakerMode?.(false);
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
    this.ui.setImages?.(this.state.images, this.selectedImageId);
    this.ui.setModels(this.state.models, this.selectedModelId);
    this.ui.setShapes?.(SHAPE_LIBRARY, SHAPE_CATEGORIES, this.selectedShapeId);
    this.ui.setPlacedModels(this.state.placedModels, selected?.id);
    this.ui.setPackageSettings?.({
      packageType: this.state.packageType,
      mapId: this.packageMapId(),
      displayName: this.currentMapName()
    });
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

  selectImage(id) {
    this.selectedImageId = id;
    this.selectedModelId = '';
    this.selectedShapeId = '';
    this.setToolMode('place');
    this.refreshObjects();
    this.log('Image/GIF selected. Click the map or drag it into the canvas.');
  }

  removeImage(id) {
    const image = this.state.images.find((item) => item.id === id);
    if (image?.temporaryLocalUrl) URL.revokeObjectURL(image.temporaryLocalUrl);
    this.state.removeImage(id);
    if (this.selectedImageId === id) this.selectedImageId = '';
    this.refreshObjects();
    this.log('Image/GIF removed from My Images.');
  }

  selectModel(id) {
    this.selectedModelId = id;
    this.selectedImageId = '';
    this.selectedShapeId = '';
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

  selectShape(id) {
    const shape = getShapeDefinition(id);
    if (!shape) return this.log('Shape not found.');
    this.selectedShapeId = id;
    this.selectedModelId = '';
    this.selectedImageId = '';
    this.setToolMode('place');
    this.refreshObjects();
    this.log(`Shape selected: ${shape.name}. Click the map to place it.`);
  }

  selectPlacedModel(id) {
    if (selectEditableObject(id)) this.setToolMode('edit');
    else this.log('Placed object is missing from the scene. Re-upload local files to restore it.');
    this.refreshObjects();
  }

  validateTexture(file) {
    if (!file) throw new Error('Choose a texture file first.');
    const lower = file.name.toLowerCase();
    if (!TEXTURE_EXTENSIONS.some((ext) => lower.endsWith(ext))) throw new Error(`Unsupported texture type for ${file.name}. Use png, jpg, jpeg, or webp textures.`);
    isSupportedMime(file, TEXTURE_MIMES);
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
      const image = await this.loadImageElement(url).catch(() => null);
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

  validateImage(file) {
    if (!file) throw new Error('Choose an image or GIF file first.');
    const lower = file.name.toLowerCase();
    if (!IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) throw new Error(`Unsupported image type for ${file.name}. Use png, jpg, jpeg, webp, or gif images.`);
    isSupportedMime(file, IMAGE_MIMES);
  }

  async importImage(file) {
    try {
      this.validateImage(file);
      const url = URL.createObjectURL(file);
      const lower = file.name.toLowerCase();
      const isGif = lower.endsWith('.gif') || file.type === 'image/gif';
      const warnings = [];
      if (file.size > 8 * 1024 * 1024) warnings.push('Image/GIF is over 8 MB.');
      if (isGif) warnings.push('GIF loaded as static image in this version. GIFs display as static image planes in this version.');
      const texture = await this.loadTexture(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      const imageElement = await this.loadImageElement(url).catch(() => null);
      const meta = this.state.addImage({
        id: nextId(isGif ? 'gifAsset' : 'imageAsset', this.state.images),
        name: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        isGif,
        width: imageElement?.naturalWidth || null,
        height: imageElement?.naturalHeight || null,
        temporaryLocalUrl: url,
        intendedRepoPath: repoPath(isGif ? 'gifs' : 'images', file.name),
        createdAt: Date.now(),
        warnings,
        textureObject: texture,
        imageElement,
        originalFile: file
      });
      warnings.forEach((warning) => this.state.warn(`${file.name}: ${warning}`));
      this.selectImage(meta.id);
      this.log(`Image/GIF uploaded: ${file.name}`);
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

  loadImageElement(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image file loading failed.'));
      image.src = url;
    });
  }

  validateGlb(file) {
    if (!file) throw new Error('Choose a GLB file first.');
    if (!file.name.toLowerCase().endsWith('.glb')) throw new Error(`Unsupported model type for ${file.name}. Use .glb model files only.`);
    isSupportedMime(file, GLB_MIMES);
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
        animations: (gltf.animations || []).map((clip, index) => ({ index, name: clip.name || `Animation ${index + 1}` })),
        defaultAnimation: gltf.animations?.length ? { selectedIndex: 0, autoplay: true, playbackSpeed: 1 } : null,
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
    if (gltf.animations?.length) warnings.push('Animations detected; the first animation autoplays on placed copies.');
    return warnings;
  }

  raycastEditorTarget(event) {
    const rect = this.options.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.options.camera);
    const objects = [
      ...getEditableObjects().map((meta) => meta.object3D),
      ...(this.collisionHelpersVisible ? this.collisionHelperGroup.children : [])
    ];
    const hit = this.raycaster.intersectObjects(objects, true)[0];
    if (!hit) return { point: null, meta: null };
    let object = hit.object;
    while (object && !object.userData.editableId) object = object.parent;
    const meta = object?.userData.editableId ? getEditableObject(object.userData.editableId) : null;
    return { point: hit.point, meta: object?.userData.collisionHelper && meta ? { ...meta, collisionHelper: true } : meta };
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
    if (this.toolMode === 'place') return this.placeSelectedAssetAtPoint(target.point);
    if (target.meta) {
      selectEditableObject(target.meta.id);
      if (target.meta.collisionHelper) this.enterCollisionEditMode();
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
      this.selectedShapeId = '';
      this.selectedImageId = '';
      return this.placeSelectedAssetAtPoint(target.point);
    }
    if (payload.kind === 'shape') {
      this.selectedShapeId = payload.id;
      this.selectedModelId = '';
      this.selectedImageId = '';
      return this.placeSelectedAssetAtPoint(target.point);
    }
    if (payload.kind === 'image') {
      this.selectedImageId = payload.id;
      this.selectedModelId = '';
      this.selectedShapeId = '';
      return this.placeSelectedAssetAtPoint(target.point);
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

  placementPosition(point = null) {
    const player = this.options.getPlayerPosition?.() || new THREE.Vector3(0, 0, 0);
    return point
      ? { x: Number(point.x.toFixed(3)), y: Number(Math.max(-8, point.y).toFixed(3)), z: Number(point.z.toFixed(3)) }
      : { x: Number((player.x + 1.5).toFixed(3)), y: Number((player.y || 0).toFixed(3)), z: Number((player.z - 1.5).toFixed(3)) };
  }

  placeSelectedAssetAtPoint(point = null) {
    if (this.selectedShapeId) return this.placeShapeAtPoint(point);
    if (this.selectedImageId) return this.placeImageAtPoint(point);
    return this.placeModelAtPoint(point);
  }

  semanticRoleForShape(shape) {
    if (!shape) return 'shape';
    if (shape.id.includes('wall') || shape.id.includes('fence') || shape.id.includes('barrier') || shape.id.includes('gate')) return 'wall';
    if (shape.id.includes('floor') || shape.id.includes('tile')) return 'floor';
    if (shape.id.includes('platform') || shape.id.includes('bridge') || shape.id.includes('catwalk')) return 'platform';
    return 'shape';
  }

  collisionFromObject(object, enabled = true) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    return {
      enabled,
      type: 'box',
      size: toPlainVector(size),
      offset: toPlainVector(center.clone().sub(object.position)),
      min: toPlainVector(box.min),
      max: toPlainVector(box.max)
    };
  }

  updatePlacementCollision(placement, object = placement?.object3D) {
    if (!placement || !object) return;
    const enabled = placement.collision?.enabled !== false;
    if (placement.collision?.manual) {
      placement.collision.enabled = enabled;
      this.state.updatePlacedModel(placement.id, { collision: placement.collision });
      this.refreshCollisionHelpers();
      return;
    }
    placement.collision = this.collisionFromObject(object, enabled);
    this.state.updatePlacedModel(placement.id, { collision: placement.collision });
    this.refreshCollisionHelpers();
  }

  collisionColliders() {
    return this.state.placedModels
      .filter((placement) => placement.collision?.enabled && placement.collision.min && placement.collision.max)
      .map((placement) => ({
        id: placement.id,
        y: placement.collision.min.y,
        minY: placement.collision.min.y,
        maxY: placement.collision.max.y,
        minX: placement.collision.min.x,
        maxX: placement.collision.max.x,
        minZ: placement.collision.min.z,
        maxZ: placement.collision.max.z
      }));
  }

  refreshCollisionHelpers() {
    this.collisionHelperGroup.clear();
    if (!this.collisionHelpersVisible) return;
    this.state.placedModels.forEach((placement) => {
      if (!placement.collision || !placement.object3D) return;
      const size = placement.collision.size || { x: 1, y: 1, z: 1 };
      const offset = placement.collision.offset || { x: 0, y: 0, z: 0 };
      const color = placement.id === getSelectedEditableObject()?.id && this.collisionEditMode
        ? 0xd8ff50
        : placement.collision.enabled
          ? 0x20ff66
          : 0x8a3232;
      const helper = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.05, size.x || 1), Math.max(0.05, size.y || 1), Math.max(0.05, size.z || 1)),
        new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: placement.collision.enabled ? 0.82 : 0.48, depthTest: false })
      );
      helper.position.set(
        (placement.position?.x || 0) + (offset.x || 0),
        (placement.position?.y || 0) + (offset.y || 0),
        (placement.position?.z || 0) + (offset.z || 0)
      );
      helper.rotation.set(placement.rotation?.x || 0, placement.rotation?.y || 0, placement.rotation?.z || 0);
      helper.userData.collisionHelper = true;
      helper.userData.editableId = placement.id;
      this.collisionHelperGroup.add(helper);
    });
  }

  enterCollisionEditMode() {
    const placement = this.selectedPlacement();
    if (!placement) return this.log('Select an object with collision first.');
    placement.collision ||= this.collisionFromObject(placement.object3D, true);
    this.collisionEditMode = true;
    this.collisionHelpersVisible = true;
    this.refreshCollisionHelpers();
    this.refreshObjects();
    this.log('Editing: Collision Box');
  }

  returnToObjectEditing() {
    this.collisionEditMode = false;
    this.refreshCollisionHelpers();
    this.refreshObjects();
    this.log('Editing: Visual Object');
  }

  resetSelectedCollisionBoxToObjectBounds() {
    const placement = this.selectedPlacement();
    if (!placement?.object3D) return this.log('Select an object first.');
    placement.collision = this.collisionFromObject(placement.object3D, placement.collision?.enabled !== false);
    delete placement.collision.manual;
    this.state.updatePlacedModel(placement.id, { collision: placement.collision });
    this.refreshCollisionHelpers();
    this.refreshObjects();
    this.log('Collision box reset to object bounds.');
  }

  updateCollisionFromHelper(placement, helper) {
    const size = {
      x: Number(Math.max(0.05, helper.scale.x * (placement.collision?.size?.x || 1)).toFixed(3)),
      y: Number(Math.max(0.05, helper.scale.y * (placement.collision?.size?.y || 1)).toFixed(3)),
      z: Number(Math.max(0.05, helper.scale.z * (placement.collision?.size?.z || 1)).toFixed(3))
    };
    const center = helper.position.clone();
    const objectPos = placement.object3D?.position || new THREE.Vector3(placement.position?.x || 0, placement.position?.y || 0, placement.position?.z || 0);
    const half = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
    placement.collision = {
      ...(placement.collision || {}),
      enabled: placement.collision?.enabled !== false,
      type: 'box',
      manual: true,
      size,
      offset: toPlainVector(center.clone().sub(objectPos)),
      min: toPlainVector(center.clone().sub(half)),
      max: toPlainVector(center.clone().add(half))
    };
    this.state.updatePlacedModel(placement.id, { collision: placement.collision });
  }

  registerPlacement(placement, object, meta = {}) {
    placement.object3D = object;
    this.updatePlacementCollision(placement, object);
    registerEditableObject({
      id: placement.id,
      type: placement.objectType || 'model',
      category: placement.objectType === 'model' ? 'placed-model' : `placed-${placement.objectType}`,
      mapId: placement.mapId,
      floor: placement.floor,
      zone: placement.zone,
      object3D: object,
      materialTarget: object,
      supportsTexture: placement.supportsTexture !== false,
      supportsTransform: true,
      source: 'editor-import',
      ...meta
    });
    selectEditableObject(placement.id);
    this.setToolMode('edit');
    this.refreshObjects();
    return placement;
  }

  setupPlacementAnimation(placement, asset) {
    if (!placement?.animation?.hasAnimations || !asset?.gltf?.animations?.length || !placement.object3D) return;
    const mixer = new THREE.AnimationMixer(placement.object3D);
    const selectedIndex = placement.animation.selectedIndex || 0;
    const clip = asset.gltf.animations[selectedIndex] || asset.gltf.animations[0];
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.timeScale = placement.animation.playbackSpeed || 1;
    if (placement.animation.autoplay !== false) action.play();
    placement.animation.selectedName = clip.name || `Animation ${selectedIndex + 1}`;
    placement.animation.supported = true;
    this.animationMixers.set(placement.id, { mixer, action });
  }

  update(delta) {
    this.animationMixers.forEach(({ mixer }) => mixer.update(delta));
  }

  placeModelAtPoint(point = null) {
    const asset = this.state.models.find((item) => item.id === this.selectedModelId);
    if (!asset?.loadedScene) return this.log('Select an uploaded GLB model first.');
    const object = this.cloneModelScene(asset.loadedScene);
    const position = this.placementPosition(point);
    object.position.set(position.x, position.y, position.z);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    this.options.scene.add(object);
    const placement = this.state.addPlacedModel({
      id: nextId('placedModel', this.state.placedModels),
      objectType: 'model',
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
      visualOnly: false,
      collision: {
        enabled: true,
        type: 'box',
        size: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 }
      },
      animation: asset.defaultAnimation ? { ...asset.defaultAnimation, clips: asset.animations || [], hasAnimations: true } : null,
      object3D: object
    });
    this.setupPlacementAnimation(placement, asset);
    this.registerPlacement(placement, object, { supportsTexture: false });
    this.log(`Placed model with box collision: ${asset.name}`);
    return placement;
  }

  placeShapeAtPoint(point = null) {
    const shape = getShapeDefinition(this.selectedShapeId);
    if (!shape) return this.log('Select a built-in shape first.');
    const object = createShapeObject(shape, THREE);
    const position = this.placementPosition(point);
    object.position.set(position.x, position.y + Math.max(0.05, shape.dimensions.y / 2), position.z);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    this.options.scene.add(object);
    const semanticRole = this.semanticRoleForShape(shape);
    const placement = this.state.addPlacedModel({
      id: nextId('placedShape', this.state.placedModels),
      objectType: 'shape',
      shapeId: shape.id,
      shapeName: shape.name,
      category: shape.category,
      semanticRole,
      mapId: this.currentMapId(),
      floor: this.floorFromY(object.position.y),
      zone: 'editor_shape',
      position: toPlainVector(object.position),
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, uniform: 1 },
      brightness: 1,
      modelBrightness: 1,
      supportsTexture: true,
      collision: {
        enabled: shape.defaultCollision !== false,
        type: 'box',
        size: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 }
      },
      object3D: object
    });
    this.registerPlacement(placement, object, { type: 'shape', category: `shape-${shape.category}` });
    this.log(`Placed shape: ${shape.name}`);
    return placement;
  }

  placeImageAtPoint(point = null) {
    const image = this.state.images.find((item) => item.id === this.selectedImageId);
    if (!image?.textureObject) return this.log('Select an uploaded image or GIF first.');
    const texture = image.textureObject.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    const aspect = image.width && image.height ? image.width / image.height : 1.4;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.02,
      transparent: true,
      side: THREE.DoubleSide
    });
    const object = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.6, aspect), 1), material);
    const position = this.placementPosition(point);
    object.position.set(position.x, position.y + 1.2, position.z);
    object.rotation.y = Math.PI;
    object.castShadow = true;
    this.options.scene.add(object);
    const placement = this.state.addPlacedModel({
      id: nextId(image.isGif ? 'placedGif' : 'placedImage', this.state.placedModels),
      objectType: image.isGif ? 'gif' : 'image',
      imageAssetId: image.id,
      imageName: image.name,
      isGif: image.isGif,
      mapId: this.currentMapId(),
      floor: this.floorFromY(object.position.y),
      zone: 'editor_image',
      position: toPlainVector(object.position),
      rotation: toPlainVector(object.rotation),
      scale: { x: 1, y: 1, z: 1, uniform: 1 },
      brightness: 1,
      modelBrightness: 1,
      supportsTexture: true,
      collision: {
        enabled: false,
        type: 'box',
        size: { x: 1, y: 1, z: 1 },
        offset: { x: 0, y: 0, z: 0 }
      },
      object3D: object
    });
    this.registerPlacement(placement, object, { type: placement.objectType, category: 'placed-image' });
    this.log(`Placed ${image.isGif ? 'GIF' : 'image'} plane: ${image.name}`);
    return placement;
  }

  placeSunLight() {
    const existing = this.state.placedModels.find((placement) => placement.objectType === 'sunLight');
    if (existing) {
      selectEditableObject(existing.id);
      this.refreshObjects();
      return this.log('Sun/Main Light already exists; selected existing sun.');
    }
    const position = this.placementPosition(null);
    const placement = this.state.addPlacedModel({
      id: nextId('sunLight', this.state.placedModels),
      objectType: 'sunLight',
      type: 'sunLight',
      mapId: this.currentMapId(),
      floor: this.floorFromY(position.y),
      zone: 'editor_sun_light',
      position: { x: position.x + 8, y: position.y + 10, z: position.z + 4 },
      rotation: { x: -0.6, y: 0.8, z: 0 },
      scale: { x: 1, y: 1, z: 1, uniform: 1 },
      ...SUN_DEFAULT,
      brightness: SUN_DEFAULT.intensity,
      modelBrightness: SUN_DEFAULT.intensity,
      supportsTexture: false,
      collision: { enabled: false, type: 'box', size: { x: 1, y: 1, z: 1 }, offset: { x: 0, y: 0, z: 0 } }
    });
    const object = createSunLightObject(placement);
    this.options.scene.add(object);
    this.registerPlacement(placement, object, { type: 'sunLight', category: 'placed-sun', supportsTexture: false });
    this.updateSelectedSunSettings(SUN_DEFAULT);
    this.log('Placed Sun / Main Light.');
    return placement;
  }

  updateSelectedSunSettings(settings = {}) {
    const placement = this.selectedPlacement();
    if (placement?.objectType !== 'sunLight') return;
    const patch = { ...settings };
    Object.assign(placement, patch);
    const color = new THREE.Color(placement.color || SUN_DEFAULT.color);
    const light = placement.object3D?.userData?.sunLight;
    const orb = placement.object3D?.userData?.sunOrb;
    if (light) {
      light.color.copy(color);
      light.intensity = placement.enabled === false ? 0 : Number(placement.intensity ?? SUN_DEFAULT.intensity);
      light.castShadow = placement.shadows !== false;
    }
    if (orb?.material) {
      orb.material.color.copy(color);
      orb.material.opacity = placement.enabled === false ? 0.35 : 1;
      orb.material.needsUpdate = true;
    }
    this.state.updatePlacedModel(placement.id, patch);
    this.refreshObjects();
  }

  placeMapMarker(kind = 'puzzle') {
    const position = this.placementPosition(null);
    let object = null;
    let placement = null;
    if (kind === 'light') {
      object = new THREE.Group();
      const light = new THREE.PointLight(0x75f6ff, 0.8, 8, 2);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0x75f6ff }));
      object.add(light, bulb);
      object.position.set(position.x, position.y + 2.5, position.z);
      placement = this.state.addPlacedModel({
        id: nextId('placedLight', this.state.placedModels),
        objectType: 'light',
        mapId: this.currentMapId(),
        floor: this.floorFromY(object.position.y),
        zone: 'editor_light',
        position: toPlainVector(object.position),
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1, uniform: 1 },
        color: 0x75f6ff,
        intensity: 0.8,
        distance: 8,
        brightness: 1,
        modelBrightness: 1,
        supportsTexture: false,
        collision: { enabled: false, type: 'box', size: { x: 1, y: 1, z: 1 }, offset: { x: 0, y: 0, z: 0 } },
        object3D: object
      });
    } else {
      const isPuzzle = kind === 'puzzle';
      const isMonster = kind === 'monster';
      object = isPuzzle
        ? new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 28), new THREE.MeshBasicMaterial({ color: 0x75f6ff }))
        : new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.95, 5), new THREE.MeshBasicMaterial({ color: isMonster ? 0xff536f : 0x75f6ff }));
      object.position.set(position.x, position.y + 0.5, position.z);
      if (isPuzzle) object.rotation.x = Math.PI / 2;
      placement = this.state.addPlacedModel({
        id: nextId(isPuzzle ? 'puzzleStationMarker' : `${kind}SpawnMarker`, this.state.placedModels),
        objectType: isPuzzle ? 'puzzleStationMarker' : 'spawnMarker',
        spawnRole: isPuzzle ? null : kind,
        mapId: this.currentMapId(),
        floor: this.floorFromY(object.position.y),
        zone: isPuzzle ? 'editor_puzzle_marker' : 'editor_spawn_marker',
        position: toPlainVector(object.position),
        rotation: toPlainVector(object.rotation),
        scale: { x: 1, y: 1, z: 1, uniform: 1 },
        brightness: 1,
        modelBrightness: 1,
        supportsTexture: false,
        collision: { enabled: false, type: 'box', size: { x: 1, y: 1, z: 1 }, offset: { x: 0, y: 0, z: 0 } },
        object3D: object
      });
    }
    this.options.scene.add(object);
    this.registerPlacement(placement, object, { type: placement.objectType, supportsTexture: false });
    this.log(`Placed ${kind} marker.`);
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
    this.updatePlacementCollision(placement, object);
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

  restoreDraftPlacement(placement, asset = null) {
    let object = null;
    if (placement.objectType === 'shape') {
      object = createShapeObject(placement.shapeId, THREE);
    } else if (placement.objectType === 'image' || placement.objectType === 'gif') {
      if (!asset?.textureObject) return false;
      const texture = asset.textureObject.clone();
      const aspect = asset.width && asset.height ? asset.width / asset.height : 1.4;
      object = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.6, aspect), 1), new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, transparent: true, side: THREE.DoubleSide }));
    } else if (placement.objectType === 'sunLight') {
      object = createSunLightObject(placement);
    } else {
      if (!asset?.loadedScene) return false;
      object = this.cloneModelScene(asset.loadedScene);
    }
    if (!object) return false;
    this.applyPlacementTransform(object, placement);
    this.options.scene.add(object);
    placement.object3D = object;
    placement.missingLocalFile = false;
    registerEditableObject({
      id: placement.id,
      type: placement.objectType || 'model',
      category: placement.objectType === 'shape' ? 'placed-shape' : placement.objectType === 'image' || placement.objectType === 'gif' ? 'placed-image' : 'placed-model',
      mapId: placement.mapId || this.currentMapId(),
      floor: placement.floor || this.floorFromY(object.position.y),
      zone: placement.zone || 'editor_local',
      object3D: object,
      supportsTexture: placement.supportsTexture !== false,
      supportsTransform: true,
      source: 'editor-import'
    });
    if (placement.objectType === 'model') this.setupPlacementAnimation(placement, asset);
    if (placement.objectType === 'sunLight') this.updateSelectedSunSettings(placement);
    this.applyModelBrightness(placement, placement.modelBrightness || placement.brightness || 1);
    this.updatePlacementCollision(placement, object);
    return true;
  }

  mutateSelectedModel(mutator) {
    const placement = this.selectedPlacement();
    const meta = getSelectedEditableObject();
    if (!placement || !meta?.object3D) {
      this.log('Select a placed object first.');
      return null;
    }
    if (this.collisionEditMode) {
      this.collisionHelpersVisible = true;
      this.refreshCollisionHelpers();
      const helper = this.collisionHelperGroup.children.find((child) => child.userData.editableId === placement.id);
      if (!helper) return null;
      mutator(helper, placement);
      helper.scale.set(Math.max(MIN_SCALE, helper.scale.x), Math.max(MIN_SCALE, helper.scale.y), Math.max(MIN_SCALE, helper.scale.z));
      helper.updateMatrixWorld(true);
      this.updateCollisionFromHelper(placement, helper);
      this.refreshCollisionHelpers();
      this.refreshObjects();
      return placement;
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
    const meta = getSelectedEditableObject();
    if (!placement || !meta?.object3D) return this.log('Select a placed object to duplicate.');
    const object = meta.object3D.clone(true);
    object.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      child.material = cloneMaterialValue(child.material);
    });
    object.position.set(placement.position.x + 1, placement.position.y, placement.position.z);
    object.rotation.set(placement.rotation.x, placement.rotation.y, placement.rotation.z);
    object.scale.set(placement.scale.x, placement.scale.y, placement.scale.z);
    this.options.scene.add(object);
    const placementCopy = JSON.parse(JSON.stringify(stripPlacementForCopy(placement)));
    const duplicate = this.state.addPlacedModel({
      ...placementCopy,
      id: nextId(`duplicate_${placement.objectType || 'object'}`, this.state.placedModels),
      position: toPlainVector(object.position),
      object3D: object
    });
    if (duplicate.objectType === 'model') {
      const asset = this.state.models.find((item) => item.id === duplicate.modelAssetId);
      this.setupPlacementAnimation(duplicate, asset);
    }
    this.registerPlacement(duplicate, object);
    this.applyModelBrightness(duplicate, duplicate.modelBrightness || duplicate.brightness || 1);
    this.log(`Duplicated ${placement.id}`);
  }

  copySelectedObject() {
    return this.duplicateSelectedModel();
  }

  deleteSelectedModel() {
    const placement = this.selectedPlacement();
    const meta = getSelectedEditableObject();
    if (!placement || !meta) return this.log('Select a placed object to delete.');
    this.options.scene.remove(meta.object3D);
    unregisterEditableObject(placement.id);
    this.animationMixers.delete(placement.id);
    this.state.removePlacedModel(placement.id);
    clearEditableSelection();
    this.refreshCollisionHelpers();
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
        modelName: placement?.modelName || placement?.shapeName || placement?.imageName || placement?.id,
        objectType: placement?.objectType || 'model',
        collision: placement?.collision,
        animation: placement?.animation,
        editingCollision: this.collisionEditMode,
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
      const runtimeImages = new Map(this.state.images.map((image) => [image.id, image]));
      const runtimeModels = new Map(this.state.models.map((model) => [model.id, model]));
      this.state.placedModels.forEach((placement) => placement.object3D?.parent?.remove(placement.object3D));
      getEditableObjects().filter((meta) => meta.source === 'editor-import').forEach((meta) => unregisterEditableObject(meta.id));
      this.animationMixers.clear();
      clearEditableSelection();
      const draft = this.state.loadDraft();
      if (!draft) return this.log('No local draft found.');
      this.state.textures = this.state.textures.map((texture) => ({ ...texture, ...runtimeTextures.get(texture.id) }));
      this.state.images = this.state.images.map((image) => ({ ...image, ...runtimeImages.get(image.id) }));
      this.state.models = this.state.models.map((model) => ({ ...model, ...runtimeModels.get(model.id) }));
      this.state.placedModels.forEach((placement) => {
        const asset = placement.objectType === 'image' || placement.objectType === 'gif'
          ? this.state.images.find((image) => image.id === placement.imageAssetId)
          : this.state.models.find((model) => model.id === placement.modelAssetId);
        if (!this.restoreDraftPlacement(placement, asset)) placement.missingLocalFile = true;
      });
      this.selectedTextureId = '';
      this.selectedImageId = '';
      this.selectedModelId = '';
      this.selectedShapeId = '';
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
    const data = buildEditorExport({ mapId: this.packageMapId(), mapDisplayName: this.currentMapName(), state: this.state });
    const text = stringifyEditorExport(data);
    this.ui.setJsonText(text);
    const fileName = downloadEditorJson(data);
    this.log(`Export Editor JSON downloaded: ${fileName}`);
  }

  async exportCodexPackage() {
    try {
      const result = await buildCodexPackage({
        mapId: this.packageMapId(),
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
    this.ui.setImages?.(this.state.images, this.selectedImageId);
    this.ui.setModels(this.state.models, this.selectedModelId);
    this.ui.setShapes?.(SHAPE_LIBRARY, SHAPE_CATEGORIES, this.selectedShapeId);
    this.ui.setPlacedModels(this.state.placedModels, getSelectedEditableObject()?.id);
    this.ui.setCounts({
      textures: this.state.textures.length,
      images: this.state.images.length,
      shapes: SHAPE_LIBRARY.length,
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
