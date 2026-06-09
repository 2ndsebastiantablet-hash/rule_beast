import { DEFAULT_MAP_SETTINGS } from './volumeObjects.js';

export const EDITOR_DRAFT_STORAGE_KEY = 'ruleBeastEditorDraftV1';
export const EDITOR_VERSION = 1;

export class EditorState {
  constructor() {
    this.textures = [];
    this.images = [];
    this.models = [];
    this.surfaceEdits = [];
    this.placedModels = [];
    this.mapSettings = { ...DEFAULT_MAP_SETTINGS };
    this.packageType = 'updateExistingMap';
    this.packageMapId = '';
    this.packageDisplayName = '';
    this.warnings = [];
    this.lastSavedAt = null;
  }

  warn(message) {
    if (!message) return null;
    const warning = { id: `warning_${Date.now()}_${this.warnings.length + 1}`, message, createdAt: Date.now() };
    this.warnings.push(warning);
    return warning;
  }

  addTexture(texture) {
    this.textures.push(texture);
    return texture;
  }

  removeTexture(id) {
    this.textures = this.textures.filter((texture) => texture.id !== id);
  }

  addImage(image) {
    this.images.push(image);
    return image;
  }

  removeImage(id) {
    this.images = this.images.filter((image) => image.id !== id);
  }

  addModel(model) {
    this.models.push(model);
    return model;
  }

  removeModel(id) {
    this.models = this.models.filter((model) => model.id !== id);
  }

  addPlacedModel(placement) {
    this.placedModels.push(placement);
    return placement;
  }

  updatePlacedModel(id, patch) {
    const placement = this.placedModels.find((item) => item.id === id);
    if (!placement) return null;
    Object.assign(placement, patch);
    return placement;
  }

  removePlacedModel(id) {
    this.placedModels = this.placedModels.filter((item) => item.id !== id);
  }

  setPackageSettings(settings = {}) {
    this.packageType = settings.packageType || this.packageType || 'updateExistingMap';
    this.packageMapId = settings.mapId || this.packageMapId || '';
    this.packageDisplayName = settings.displayName || this.packageDisplayName || '';
  }

  updateMapSettings(settings = {}) {
    this.mapSettings = {
      ...DEFAULT_MAP_SETTINGS,
      ...(this.mapSettings || {}),
      gravityMultiplier: Number(settings.gravityMultiplier ?? this.mapSettings?.gravityMultiplier ?? DEFAULT_MAP_SETTINGS.gravityMultiplier),
      airControl: Number(settings.airControl ?? this.mapSettings?.airControl ?? DEFAULT_MAP_SETTINGS.airControl),
      drag: Number(settings.drag ?? this.mapSettings?.drag ?? DEFAULT_MAP_SETTINGS.drag)
    };
    return this.mapSettings;
  }

  upsertSurfaceEdit(edit) {
    const next = {
      brightness: 1,
      surfaceBrightness: edit.brightness ?? edit.surfaceBrightness ?? 1,
      ...edit
    };
    const index = this.surfaceEdits.findIndex((item) => item.targetId === next.targetId);
    if (index >= 0) this.surfaceEdits[index] = { ...this.surfaceEdits[index], ...next };
    else this.surfaceEdits.push(next);
    return next;
  }

  removeSurfaceEdit(targetId) {
    this.surfaceEdits = this.surfaceEdits.filter((item) => item.targetId !== targetId);
  }

  surfaceEdit(targetId) {
    return this.surfaceEdits.find((item) => item.targetId === targetId) || null;
  }

  modelPlacement(id) {
    return this.placedModels.find((item) => item.id === id) || null;
  }

  toDraft(mapId) {
    return {
      editorVersion: EDITOR_VERSION,
      mapId,
      packageType: this.packageType,
      packageMapId: this.packageMapId,
      packageDisplayName: this.packageDisplayName,
      savedAt: Date.now(),
      textures: this.textures.map(stripRuntimeTexture),
      images: this.images.map(stripRuntimeImage),
      models: this.models.map(stripRuntimeModel),
      surfaceEdits: this.surfaceEdits,
      placedModels: this.placedModels.map(stripRuntimePlacement),
      mapSettings: { ...DEFAULT_MAP_SETTINGS, ...(this.mapSettings || {}) },
      warnings: this.warnings
    };
  }

  saveDraft(mapId) {
    const draft = this.toDraft(mapId);
    localStorage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    this.lastSavedAt = draft.savedAt;
    return draft;
  }

  loadDraft() {
    const raw = localStorage.getItem(EDITOR_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    this.textures = (draft.textures || []).map((item) => ({ ...item, missingLocalFile: true }));
    this.images = (draft.images || []).map((item) => ({ ...item, missingLocalFile: true }));
    this.models = (draft.models || []).map((item) => ({ ...item, missingLocalFile: true }));
    this.surfaceEdits = draft.surfaceEdits || [];
    this.placedModels = (draft.placedModels || []).map((item) => ({
      ...item,
      missingLocalFile: true,
      modelBrightness: item.modelBrightness ?? item.brightness ?? 1
    }));
    this.packageType = draft.packageType || 'updateExistingMap';
    this.packageMapId = draft.packageMapId || draft.mapId || '';
    this.packageDisplayName = draft.packageDisplayName || '';
    this.mapSettings = { ...DEFAULT_MAP_SETTINGS, ...(draft.mapSettings || {}) };
    this.warnings = draft.warnings || [];
    this.lastSavedAt = draft.savedAt || null;
    this.warn('Draft loaded. Local texture/model files are not stored; re-upload them to preview.');
    return draft;
  }

  clearDraft() {
    localStorage.removeItem(EDITOR_DRAFT_STORAGE_KEY);
    this.lastSavedAt = null;
  }
}

export function stripRuntimeTexture(texture) {
  const { textureObject, imageElement, originalFile, ...rest } = texture;
  return rest;
}

export function stripRuntimeImage(image) {
  const { textureObject, imageElement, originalFile, ...rest } = image;
  return rest;
}

export function stripRuntimeModel(model) {
  const { loadedScene, gltf, originalFile, ...rest } = model;
  return rest;
}

export function stripRuntimePlacement(placement) {
  const { object3D, collisionHelper, animationMixer, animationAction, ...rest } = placement;
  return rest;
}
