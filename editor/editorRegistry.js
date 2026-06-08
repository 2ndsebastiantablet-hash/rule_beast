import * as THREE from 'three';

const editableObjects = new Map();
let selectedId = null;
let sceneRef = null;
let selectionHelper = null;
let onSelectionChanged = null;

function disposeSelectionHelper() {
  if (!selectionHelper) return;
  sceneRef?.remove(selectionHelper);
  selectionHelper.geometry?.dispose?.();
  selectionHelper.material?.dispose?.();
  selectionHelper = null;
}

export function initializeEditableRegistry(scene) {
  sceneRef = scene;
}

export function resetEditableRegistry({ keepImported = true } = {}) {
  [...editableObjects.entries()].forEach(([id, meta]) => {
    if (!keepImported || meta.source !== 'editor-import') editableObjects.delete(id);
  });
  if (!editableObjects.has(selectedId)) clearEditableSelection();
}

export function unregisterEditableObjectsBySource(source) {
  [...editableObjects.entries()].forEach(([id, meta]) => {
    if (meta.source === source) editableObjects.delete(id);
  });
  if (!editableObjects.has(selectedId)) clearEditableSelection();
}

export function registerEditableObject(meta) {
  if (!meta?.id || !meta.object3D) return null;
  const safeMeta = {
    category: 'surface',
    source: 'built-in-map',
    supportsTexture: false,
    supportsTransform: false,
    ...meta
  };
  safeMeta.object3D.userData.editableId = safeMeta.id;
  editableObjects.set(safeMeta.id, safeMeta);
  return safeMeta;
}

export function registerMapSurface(meta) {
  return registerEditableObject({ supportsTexture: true, supportsTransform: false, source: 'built-in-map', ...meta });
}

export function unregisterEditableObject(id) {
  const meta = editableObjects.get(id);
  if (meta?.object3D?.userData) delete meta.object3D.userData.editableId;
  editableObjects.delete(id);
  if (selectedId === id) clearEditableSelection();
}

export function getEditableObject(id) {
  return editableObjects.get(id) || null;
}

export function getEditableObjects() {
  return [...editableObjects.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function highlightSelectedObject(object3D) {
  disposeSelectionHelper();
  if (!object3D || !sceneRef) return;
  selectionHelper = new THREE.BoxHelper(object3D, 0xffff00);
  sceneRef.add(selectionHelper);
}

export function refreshSelectionHighlight() {
  if (!selectedId) return;
  const meta = getEditableObject(selectedId);
  if (selectionHelper && meta?.object3D) selectionHelper.update();
}

export function selectEditableObject(id) {
  const meta = getEditableObject(id);
  selectedId = meta ? id : null;
  highlightSelectedObject(meta?.object3D || null);
  onSelectionChanged?.(meta || null);
  return meta || null;
}

export function clearEditableSelection() {
  selectedId = null;
  disposeSelectionHelper();
  onSelectionChanged?.(null);
}

export function getSelectedEditableObject() {
  return selectedId ? getEditableObject(selectedId) : null;
}

export function setSelectionChangedHandler(handler) {
  onSelectionChanged = handler;
}
