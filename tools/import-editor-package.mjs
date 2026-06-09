#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const zipPath = process.argv[2];
const warnings = [];
const skipped = [];

function fail(message) {
  console.error(`[import-editor-package] ${message}`);
  process.exit(1);
}

function sanitizeFileName(name) {
  return String(name || 'asset').replace(/[^a-z0-9._-]/gi, '_');
}

function validateMapId(mapId) {
  if (!/^[a-z0-9_-]+$/i.test(mapId || '')) fail(`Invalid mapId: ${mapId}`);
}

function normalizePackageType(type) {
  if (type === 'newMap' || type === 'updateExistingMap') return type;
  return 'updateExistingMap';
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function readUInt16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (readUInt32(buffer, i) === 0x06054b50) return i;
  }
  fail('Invalid ZIP: end of central directory not found.');
}

function unzipToMemory(filePath) {
  const buffer = readFileSync(filePath);
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = readUInt16(buffer, eocd + 10);
  let centralOffset = readUInt32(buffer, eocd + 16);
  const entries = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (readUInt32(buffer, centralOffset) !== 0x02014b50) fail('Invalid ZIP: bad central directory header.');
    const method = readUInt16(buffer, centralOffset + 10);
    const compressedSize = readUInt32(buffer, centralOffset + 20);
    const fileNameLength = readUInt16(buffer, centralOffset + 28);
    const extraLength = readUInt16(buffer, centralOffset + 30);
    const commentLength = readUInt16(buffer, centralOffset + 32);
    const localHeaderOffset = readUInt32(buffer, centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString('utf8');
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (readUInt32(buffer, localHeaderOffset) !== 0x04034b50) fail(`Invalid ZIP: bad local header for ${name}`);
    const localNameLength = readUInt16(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    if (method === 0) entries.set(name, Buffer.from(compressed));
    else if (method === 8) entries.set(name, Buffer.from(inflateRawSync(compressed)));
    else fail(`Unsupported ZIP compression method ${method} for ${name}`);
  }
  return entries;
}

function copyAsset({ entries, sourcePath, destinationDir }) {
  let resolvedSource = sourcePath;
  let bytes = entries.get(resolvedSource);
  if (!bytes) {
    const normalized = sourcePath.replace(/\\/g, '/');
    const filename = basename(normalized);
    for (const [entryName, entryBytes] of entries.entries()) {
      const entry = entryName.replace(/\\/g, '/');
      if (entry === normalized || entry.endsWith(`/${normalized}`) || entry.endsWith(`/${filename}`)) {
        resolvedSource = entryName;
        bytes = entryBytes;
        break;
      }
    }
  }
  if (!bytes) {
    warnings.push(`Missing package file: ${sourcePath}`);
    skipped.push(sourcePath);
    return null;
  }
  const filename = sanitizeFileName(basename(resolvedSource));
  const destination = join(destinationDir, filename);
  mkdirSync(destinationDir, { recursive: true });
  writeFileSync(destination, bytes);
  if (bytes.length > 25 * 1024 * 1024) warnings.push(`Strong warning: ${sourcePath} is over 25 MB.`);
  else if (bytes.length > 10 * 1024 * 1024) warnings.push(`${sourcePath} is over 10 MB.`);
  return destination;
}

function importAssetList({ manifest, entries, list, folder, destinationDir, imported }) {
  return list.map((asset) => {
    const packagePath = asset.packagePath || `${folder}/${sanitizeFileName(asset.name)}`;
    const copied = copyAsset({ entries, sourcePath: packagePath, destinationDir });
    if (!copied) return { ...asset, missingPermanentFile: true };
    const repoPath = `assets/editor_maps/${manifest.mapId}/${folder}/${basename(copied)}`;
    imported.push(repoPath);
    return { ...asset, repoPath, intendedRepoPath: repoPath, temporaryLocalUrl: undefined };
  });
}

function updateEditorMapIndex(manifest) {
  if (manifest.packageType !== 'newMap') return;
  const indexPath = join(repoRoot, 'assets', 'editor_maps', 'index.json');
  let index = [];
  if (existsSync(indexPath)) {
    try {
      const parsed = JSON.parse(readFileSync(indexPath, 'utf8').replace(/^\uFEFF/, ''));
      index = Array.isArray(parsed.maps) ? parsed.maps : [];
    } catch {
      warnings.push('Existing assets/editor_maps/index.json could not be parsed and will be replaced.');
    }
  }
  const next = { id: manifest.mapId, name: manifest.displayName || manifest.mapDisplayName || manifest.mapId, source: 'editorPackage' };
  index = [...index.filter((item) => item.id !== manifest.mapId), next];
  writeFileSync(indexPath, `${JSON.stringify({ maps: index }, null, 2)}\n`);
}

if (!zipPath) fail('Usage: node tools/import-editor-package.mjs editor_imports/inbox/package.zip');
if (!existsSync(zipPath)) fail(`ZIP does not exist: ${zipPath}`);
if (extname(zipPath).toLowerCase() !== '.zip') fail('Expected a .zip package.');

const tempDir = join(tmpdir(), `rule-beast-editor-import-${Date.now()}`);
mkdirSync(tempDir, { recursive: true });

try {
  const entries = unzipToMemory(zipPath);
  const rawManifest = entries.get('manifest.json');
  if (!rawManifest) fail('Package is missing manifest.json.');
  if (!entries.has('codex_import_prompt.txt')) warnings.push('Package is missing codex_import_prompt.txt.');
  const manifest = JSON.parse(rawManifest.toString('utf8').replace(/^\uFEFF/, ''));
  validateMapId(manifest.mapId);
  manifest.packageType = normalizePackageType(manifest.packageType);
  if (manifest.packageType === 'newMap') {
    const spawns = manifest.spawnMarkers || manifest.survivorSpawns || [];
    const monsterSpawns = (manifest.spawnMarkers || []).filter((marker) => marker.spawnRole === 'monster' || marker.kind === 'monsterSpawn');
    const puzzleMarkers = manifest.puzzleStationMarkers || manifest.puzzleStations || [];
    if (!spawns.length && !manifest.survivorSpawn) fail('newMap package is missing survivor spawn data.');
    if (!monsterSpawns.length && !manifest.monsterSpawn) fail('newMap package is missing monster spawn data.');
    if (!puzzleMarkers.length) fail('newMap package is missing puzzle station marker data.');
  }

  const mapDir = join(repoRoot, 'assets', 'editor_maps', manifest.mapId);
  const textureDir = join(mapDir, 'textures');
  const imageDir = join(mapDir, 'images');
  const gifDir = join(mapDir, 'gifs');
  const modelDir = join(mapDir, 'models');
  mkdirSync(textureDir, { recursive: true });
  mkdirSync(imageDir, { recursive: true });
  mkdirSync(gifDir, { recursive: true });
  mkdirSync(modelDir, { recursive: true });

  const importedTextures = [];
  const importedImages = [];
  const importedGifs = [];
  const importedModels = [];

  const manifestTextures = Array.isArray(manifest.textures) ? manifest.textures : (manifest.assets?.textures || []);
  const manifestImages = [
    ...(Array.isArray(manifest.images) ? manifest.images : []),
    ...(manifest.assets?.images || []),
    ...(manifest.assets?.gifs || [])
  ].filter((asset, index, list) => {
    const key = asset.id || asset.packagePath || asset.name;
    return list.findIndex((item) => (item.id || item.packagePath || item.name) === key) === index;
  });
  const manifestModels = Array.isArray(manifest.models) ? manifest.models : (manifest.assets?.models || []);

  manifest.textures = importAssetList({ manifest, entries, list: manifestTextures, folder: 'textures', destinationDir: textureDir, imported: importedTextures });
  manifest.images = manifestImages.map((image) => {
    const folder = image.isGif ? 'gifs' : (image.packagePath?.startsWith('gifs/') ? 'gifs' : 'images');
    const imported = folder === 'gifs' ? importedGifs : importedImages;
    return importAssetList({ manifest, entries, list: [image], folder, destinationDir: folder === 'gifs' ? gifDir : imageDir, imported })[0];
  });
  manifest.models = importAssetList({ manifest, entries, list: manifestModels, folder: 'models', destinationDir: modelDir, imported: importedModels });

  manifest.assets = {
    ...(manifest.assets || {}),
    textures: manifest.textures,
    images: manifest.images.filter((image) => !image.isGif),
    gifs: manifest.images.filter((image) => image.isGif),
    models: manifest.models
  };
  manifest.importedAt = new Date().toISOString();
  manifest.importSourceZip = zipPath;
  manifest.mapSettings = manifest.mapSettings || { gravityMultiplier: 1, airControl: 1, drag: 1 };
  manifest.placedLiquidVolumes = manifest.placedLiquidVolumes || [];
  manifest.placedGasVolumes = manifest.placedGasVolumes || [];
  manifest.sunLights = manifest.sunLights || [];
  manifest.collisionBoxTransforms = manifest.collisionBoxTransforms || [];
  manifest.warnings = [...(manifest.warnings || []), ...warnings];
  const latestPath = join(mapDir, 'latest.json');
  writeFileSync(latestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  updateEditorMapIndex(manifest);

  console.log('Rule Beast editor package import summary');
  console.log(`Map: ${manifest.mapId}`);
  console.log(`Textures imported: ${importedTextures.length}`);
  importedTextures.forEach((item) => console.log(`  texture: ${item}`));
  console.log(`Images imported: ${importedImages.length}`);
  importedImages.forEach((item) => console.log(`  image: ${item}`));
  console.log(`GIFs imported: ${importedGifs.length}`);
  importedGifs.forEach((item) => console.log(`  gif: ${item}`));
  console.log(`Models imported: ${importedModels.length}`);
  importedModels.forEach((item) => console.log(`  model: ${item}`));
  console.log(`Surface edits: ${(manifest.surfaceEdits || []).length}`);
  console.log(`Placed models: ${(manifest.placedModels || []).length}`);
  console.log(`Placed shapes: ${(manifest.placedShapes || []).length}`);
  console.log(`Image planes: ${(manifest.placedImagePlanes || []).length}`);
  console.log(`Liquid volumes: ${(manifest.placedLiquidVolumes || []).length}`);
  console.log(`Gas/fog volumes: ${(manifest.placedGasVolumes || []).length}`);
  console.log(`Sun/Main Light objects: ${(manifest.sunLights || []).length}`);
  console.log(`Map gravity settings: ${JSON.stringify(manifest.mapSettings || {})}`);
  console.log(`Collision box edits: ${(manifest.collisionBoxTransforms || []).length}`);
  console.log(`Spawn markers: ${(manifest.spawnMarkers || []).length}`);
  console.log(`Puzzle station markers: ${(manifest.puzzleStationMarkers || []).length}`);
  console.log(`Skipped items: ${skipped.length}`);
  skipped.forEach((item) => console.log(`  skipped: ${item}`));
  console.log(`Warnings: ${warnings.length}`);
  warnings.forEach((item) => console.log(`  warning: ${item}`));
  console.log(`Wrote: ${latestPath}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
