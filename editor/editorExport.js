import { EDITOR_VERSION, stripRuntimeModel, stripRuntimePlacement, stripRuntimeTexture } from './editorState.js';

export function buildEditorExport({ mapId, mapDisplayName, state }) {
  return {
    game: 'Rule Beast',
    editorVersion: EDITOR_VERSION,
    mapId,
    mapDisplayName,
    exportedAt: new Date().toISOString(),
    importantNote: 'Local files are temporary. To make this permanent, copy the assets into the repo and replace blob URLs with real repo paths.',
    textures: state.textures.map(stripRuntimeTexture),
    models: state.models.map(stripRuntimeModel),
    surfaceEdits: state.surfaceEdits,
    placedModels: state.placedModels.map(stripRuntimePlacement),
    warnings: state.warnings.map((warning) => warning.message || warning),
    currentLimitations: [
      'Local-only test data',
      'Not synced to other players',
      'Not permanent until integrated into source',
      'Imported models are visual-only',
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
