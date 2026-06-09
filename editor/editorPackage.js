import { zipSync, strToU8 } from 'fflate';
import { buildEditorExport, stringifyEditorExport } from './editorExport.js';

const sanitizeFileName = (name) => String(name || 'asset').replace(/[^a-z0-9._-]/gi, '_');

function packageName(mapId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `rule_beast_editor_package_${mapId}_${timestamp}.zip`;
}

export function buildCodexImportPrompt({ mapId, zipFileName, packageType = 'updateExistingMap' }) {
  return `Import this Rule Beast editor package and make it permanent.

Package location:
editor_imports/inbox/${zipFileName}

Package type:
${packageType}

Tasks:

1. Confirm this is the Rule Beast repo.
2. Unzip and inspect manifest.json.
3. Copy textures into assets/editor_maps/${mapId}/textures/.
4. Copy images into assets/editor_maps/${mapId}/images/ and GIFs into assets/editor_maps/${mapId}/gifs/.
5. Copy GLB models into assets/editor_maps/${mapId}/models/.
5. Replace temporary blob URLs with repo-relative asset paths.
6. Apply surface texture edits permanently.
7. Apply surface brightness edits permanently.
8. Add placedShapes, placedImagePlanes, placed GLB models, placedLiquidVolumes, placedGasVolumes, collision boxes, spawn markers, puzzle station markers, lights, and Sun/Main Light permanently.
9. Preserve position, rotation, scale, brightness/color, collision, collision box transforms, animation settings, liquid settings, gas/fog settings, and map gravity settings.
10. If packageType is newMap, create a new official map option using the manifest spawns and puzzle stations.
11. If packageType is updateExistingMap, update the existing permanent editor map override for ${mapId}.
12. Make map gravity settings and volume effects permanent without adding cloud publishing.
13. Test locally.
14. Commit and push to main.
15. Give the exact commit hash.`;
}

export async function buildCodexPackage({ mapId, mapDisplayName, state }) {
  const zipFileName = packageName(mapId);
  const warnings = [];
  const manifest = buildEditorExport({ mapId, mapDisplayName, state });

  const textureIds = new Set(state.surfaceEdits.map((edit) => edit.textureId).filter(Boolean));
  const modelIds = new Set(state.placedModels.map((placement) => placement.modelAssetId).filter(Boolean));
  const imageIds = new Set(state.placedModels.map((placement) => placement.imageAssetId).filter(Boolean));
  const usedTextures = state.textures.filter((texture) => textureIds.has(texture.id));
  const usedModels = state.models.filter((model) => modelIds.has(model.id));
  const usedImages = state.images.filter((image) => imageIds.has(image.id));
  textureIds.forEach((id) => {
    if (!state.textures.some((texture) => texture.id === id)) warnings.push(`Texture ${id}: This local file is no longer available. Re-upload it before exporting a Codex package.`);
  });
  modelIds.forEach((id) => {
    if (!state.models.some((model) => model.id === id)) warnings.push(`Model ${id}: This local file is no longer available. Re-upload it before exporting a Codex package.`);
  });
  imageIds.forEach((id) => {
    if (!state.images.some((image) => image.id === id)) warnings.push(`Image/GIF ${id}: This local file is no longer available. Re-upload it before exporting a Codex package.`);
  });

  const files = {
    'codex_import_prompt.txt': strToU8(buildCodexImportPrompt({ mapId, zipFileName, packageType: manifest.packageType }))
  };

  for (const texture of usedTextures) {
    if (!texture.originalFile) {
      warnings.push(`${texture.name}: This local file is no longer available. Re-upload it before exporting a Codex package.`);
      continue;
    }
    const filename = sanitizeFileName(texture.name);
    const manifestTexture = manifest.textures.find((item) => item.id === texture.id);
    if (manifestTexture) manifestTexture.packagePath = `textures/${filename}`;
    files[`textures/${filename}`] = new Uint8Array(await texture.originalFile.arrayBuffer());
  }

  for (const model of usedModels) {
    if (!model.originalFile) {
      warnings.push(`${model.name}: This local file is no longer available. Re-upload it before exporting a Codex package.`);
      continue;
    }
    const filename = sanitizeFileName(model.name);
    const manifestModel = manifest.models.find((item) => item.id === model.id);
    if (manifestModel) manifestModel.packagePath = `models/${filename}`;
    files[`models/${filename}`] = new Uint8Array(await model.originalFile.arrayBuffer());
  }

  for (const image of usedImages) {
    if (!image.originalFile) {
      warnings.push(`${image.name}: This local file is no longer available. Re-upload it before exporting a Codex package.`);
      continue;
    }
    const folder = image.isGif ? 'gifs' : 'images';
    const filename = sanitizeFileName(image.name);
    const manifestImage = manifest.images.find((item) => item.id === image.id);
    if (manifestImage) manifestImage.packagePath = `${folder}/${filename}`;
    files[`${folder}/${filename}`] = new Uint8Array(await image.originalFile.arrayBuffer());
  }

  manifest.warnings = [...(manifest.warnings || []), ...warnings];
  manifest.assets = {
    textures: manifest.textures,
    images: manifest.images.filter((image) => !image.isGif),
    gifs: manifest.images.filter((image) => image.isGif),
    models: manifest.models
  };
  files['manifest.json'] = strToU8(stringifyEditorExport(manifest));
  const bytes = zipSync(files, { level: 6 });
  return { zipFileName, bytes, warnings, manifest };
}

export function downloadCodexPackage({ zipFileName, bytes }) {
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return zipFileName;
}
