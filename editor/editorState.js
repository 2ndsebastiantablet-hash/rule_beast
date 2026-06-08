export const EDITOR_DRAFT_STORAGE_KEY = 'ruleBeastEditorDraftV1';
export const EDITOR_VERSION = 1;

export class EditorState {
  constructor() {
    this.textures = [];
    this.models = [];
    this.surfaceEdits = [];
    this.placedModels = [];
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
      savedAt: Date.now(),
      textures: this.textures.map(stripRuntimeTexture),
      models: this.models.map(stripRuntimeModel),
      surfaceEdits: this.surfaceEdits,
      placedModels: this.placedModels.map(stripRuntimePlacement),
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
    this.models = (draft.models || []).map((item) => ({ ...item, missingLocalFile: true }));
    this.surfaceEdits = draft.surfaceEdits || [];
    this.placedModels = (draft.placedModels || []).map((item) => ({
      ...item,
      missingLocalFile: true,
      modelBrightness: item.modelBrightness ?? item.brightness ?? 1
    }));
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
  const { textureObject, imageElement, ...rest } = texture;
  return rest;
}

export function stripRuntimeModel(model) {
  const { loadedScene, gltf, ...rest } = model;
  return rest;
}

export function stripRuntimePlacement(placement) {
  const { object3D, ...rest } = placement;
  return rest;
}
