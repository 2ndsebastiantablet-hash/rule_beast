import { EDITOR_VERSION, stripRuntimeImage, stripRuntimeModel, stripRuntimePlacement, stripRuntimeTexture } from './editorState.js';

export function buildEditorExport({ mapId, mapDisplayName, state }) {
  const placements = state.placedModels.map(stripRuntimePlacement);
  const placedModels = placements.filter((placement) => placement.objectType === 'model' || !placement.objectType);
  const placedShapes = placements.filter((placement) => placement.objectType === 'shape');
  const placedImagePlanes = placements.filter((placement) => placement.objectType === 'image' || placement.objectType === 'gif');
  const placedWalls = placedShapes.filter((placement) => placement.semanticRole === 'wall');
  const placedFloors = placedShapes.filter((placement) => placement.semanticRole === 'floor' || placement.semanticRole === 'platform');
  const spawnMarkers = placements.filter((placement) => placement.objectType === 'spawnMarker');
  const puzzleStationMarkers = placements.filter((placement) => placement.objectType === 'puzzleStationMarker');
  const lights = placements.filter((placement) => placement.objectType === 'light');
  const packageType = state.packageType || 'updateExistingMap';
  const displayName = state.packageDisplayName || mapDisplayName;
  return {
    game: 'Rule Beast',
    editorVersion: EDITOR_VERSION,
    packageType,
    mapId,
    displayName,
    mapDisplayName,
    exportedAt: new Date().toISOString(),
    importantNote: 'Local files are temporary. To make this permanent, copy the assets into the repo and replace blob URLs with real repo paths.',
    textures: state.textures.map(stripRuntimeTexture),
    images: state.images.map(stripRuntimeImage),
    models: state.models.map(stripRuntimeModel),
    surfaceEdits: state.surfaceEdits,
    placedObjects: placements,
    placedModels,
    placedShapes,
    placedWalls,
    placedFloors,
    placedImagePlanes,
    placedGifPlanes: placedImagePlanes.filter((placement) => placement.objectType === 'gif' || placement.isGif),
    collisionBoxes: placements.filter((placement) => placement.collision?.enabled),
    spawnMarkers,
    puzzleStationMarkers,
    lights,
    animationSettings: placedModels.map((placement) => placement.animation).filter(Boolean),
    warnings: state.warnings.map((warning) => warning.message || warning),
    currentLimitations: [
      'Local-only test data',
      'Not synced to other players',
      'Not permanent until integrated into source',
      'Imported models and editor objects use simple box collision when enabled',
      'GIFs may export as static image planes until browser GIF texture animation is implemented',
      'Large assets can hurt browser or VR performance'
    ]
  };
}

export function stringifyEditorExport(data) {
  return JSON.stringify(data, null, 2);
}

export function downloadEditorJson(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `rule_beast_editor_export_${data.mapId}_${timestamp}.json`;
  const blob = new Blob([stringifyEditorExport(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return fileName;
}
