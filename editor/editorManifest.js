import { EDITOR_VERSION, stripRuntimeModel, stripRuntimePlacement, stripRuntimeTexture } from './editorState.js';

export function buildAssetManifest({ mapId, mapDisplayName, state }) {
  const warnings = state.warnings.map((warning) => warning.message || warning);
  return {
    editorVersion: EDITOR_VERSION,
    game: 'Rule Beast',
    mapId,
    mapDisplayName,
    exportedAt: new Date().toISOString(),
    importantNote: 'Local blob URLs are temporary. To make this permanent, copy the asset files into the repo and replace temporaryLocalUrl values with intendedRepoPath values.',
    textures: state.textures.map(stripRuntimeTexture),
    models: state.models.map(stripRuntimeModel),
    surfaceEdits: state.surfaceEdits,
    placedModels: state.placedModels.map(stripRuntimePlacement),
    warnings,
    permanentImportInstructions: [
      'Copy texture files into assets/textures/',
      'Copy GLB files into assets/models/',
      'Replace temporaryLocalUrl with repo asset paths',
      'Have Codex integrate this manifest into the selected map'
    ]
  };
}

export function stringifyManifest(manifest) {
  return JSON.stringify(manifest, null, 2);
}

export function downloadManifest(manifest) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `rule_beast_asset_manifest_${manifest.mapId}_${timestamp}.json`;
  const blob = new Blob([stringifyManifest(manifest)], { type: 'application/json' });
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

export function parseManifestJson(text) {
  const manifest = JSON.parse(text);
  if (!manifest || typeof manifest !== 'object') throw new Error('Manifest must be a JSON object.');
  if (manifest.editorVersion && manifest.editorVersion > EDITOR_VERSION) {
    return { manifest, warnings: [`Manifest version ${manifest.editorVersion} is newer than this editor.`] };
  }
  return { manifest, warnings: [] };
}
