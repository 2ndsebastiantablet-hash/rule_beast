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
    const warning = { id: `warning_${Date.now()}_${this.warnings.length + 1}`, message, createdAt: Date.now() };
    this.warnings.push(warning);
    return warning;
  }

  addTexture(texture) {
    this.textures.push(texture);
    return texture;
  }

  addModel(model) {
    this.models.push(model);
    return model;
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
    const index = this.surfaceEdits.findIndex((item) => item.targetId === edit.targetId);
    if (index >= 0) this.surfaceEdits[index] = { ...this.surfaceEdits[index], ...edit };
    else this.surfaceEdits.push(edit);
    return edit;
  }

  removeSurfaceEdit(targetId) {
    this.surfaceEdits = this.surfaceEdits.filter((item) => item.targetId !== targetId);
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
    this.placedModels = (draft.placedModels || []).map((item) => ({ ...item, missingLocalFile: true }));
    this.warnings = draft.warnings || [];
    this.lastSavedAt = draft.savedAt || null;
    this.warn('Draft loaded. Local asset files are not stored in browser drafts; re-import files to preview them.');
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
