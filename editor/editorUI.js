const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char]);

const toolLabel = {
  select: 'Select',
  paint: 'Paint Texture',
  place: 'Place Asset',
  edit: 'Move/Edit Object'
};

export class EditorUI {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.toolMode = 'select';
    this.lastShapes = [];
    this.lastCategories = [];
    this.selectedShapeId = '';
    this.root = document.createElement('div');
    this.root.id = 'asset-editor-root';
    this.root.innerHTML = `
      <style>
        #asset-editor-root {
          --editor-cyan: #75f6ff;
          --editor-gold: #ffd15f;
          --editor-red: #ff536f;
          --editor-panel: rgba(3, 8, 16, .94);
          --editor-border: rgba(117, 246, 255, .28);
          position: fixed;
          inset: 0;
          z-index: 22;
          pointer-events: none;
          font-family: Orbitron, system-ui, sans-serif;
          color: #d8fbff;
        }
        .editor-unlock,
        .asset-editor-panel {
          pointer-events: auto;
          border: 1px solid var(--editor-border);
          background: var(--editor-panel);
          box-shadow: 0 0 30px rgba(80, 240, 255, .14);
        }
        .editor-unlock {
          position: absolute;
          left: 16px;
          bottom: 16px;
          width: min(320px, calc(100vw - 32px));
          padding: 12px;
          border-radius: 8px;
        }
        .editor-unlock-row,
        .editor-actions,
        .editor-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .editor-unlock-row { display: grid; grid-template-columns: 1fr auto; }
        .asset-editor-panel {
          position: absolute;
          right: 16px;
          top: 16px;
          width: min(440px, calc(100vw - 32px));
          max-height: calc(100vh - 32px);
          overflow: auto;
          padding: 14px;
          border-radius: 8px;
        }
        .hidden { display: none; }
        .asset-editor-panel h2,
        .asset-editor-panel h3,
        .editor-unlock h3 {
          margin: 0 0 8px;
          color: var(--editor-cyan);
          letter-spacing: 0;
        }
        .asset-editor-panel h2 { font-size: 20px; }
        .asset-editor-panel h3 { font-size: 13px; }
        .editor-status { color: var(--editor-gold); font-size: 11px; margin: 4px 0; }
        .editor-note,
        .editor-help,
        .editor-selected-info,
        .editor-log {
          color: #aac7d2;
          font-size: 11px;
          line-height: 1.45;
        }
        .editor-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(117, 246, 255, .16);
        }
        .editor-actions { margin-top: 8px; }
        .editor-input-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .asset-editor-panel button,
        .editor-unlock button,
        .editor-list-item {
          border: 0;
          border-radius: 7px;
          font-family: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .asset-editor-panel button,
        .editor-unlock button {
          min-height: 32px;
          padding: 8px 10px;
          color: #041017;
          background: linear-gradient(180deg, #8bfbff, #28b8d0);
        }
        .asset-editor-panel button.danger { background: linear-gradient(180deg, #ff8aa1, #d73555); color: #140208; }
        .asset-editor-panel button.secondary { background: linear-gradient(180deg, #29384a, #152333); color: #c7f7ff; border: 1px solid rgba(117, 246, 255, .25); }
        .asset-editor-panel input,
        .asset-editor-panel select,
        .asset-editor-panel textarea,
        .editor-unlock input {
          min-height: 32px;
          border: 1px solid rgba(117, 246, 255, .32);
          background: rgba(0, 0, 0, .44);
          color: #d8fbff;
          border-radius: 7px;
          padding: 6px 8px;
          font-family: inherit;
          box-sizing: border-box;
          width: 100%;
        }
        .asset-editor-panel label {
          display: grid;
          gap: 4px;
          color: #84f7ff;
          font-size: 11px;
          text-transform: uppercase;
        }
        .editor-list {
          margin-top: 8px;
          max-height: 148px;
          overflow: auto;
        }
        .editor-list-item {
          display: grid;
          grid-template-columns: 48px 1fr auto;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-height: 48px;
          padding: 6px;
          color: #d8fbff;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(255,255,255,.07);
          text-align: left;
        }
        .editor-list-item.selected {
          border-color: var(--editor-gold);
          box-shadow: inset 0 0 0 1px rgba(255,209,95,.55);
        }
        .editor-list-item img {
          width: 44px;
          height: 34px;
          object-fit: cover;
          border-radius: 5px;
          background: #02060c;
        }
        .editor-chip { color: var(--editor-gold); font-size: 10px; }
        .editor-log {
          min-height: 56px;
          max-height: 126px;
          overflow: auto;
          padding: 8px;
          background: rgba(0,0,0,.35);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 7px;
          white-space: pre-wrap;
        }
        .editor-json {
          min-height: 132px;
          resize: vertical;
          text-transform: none;
        }
        @media (max-width: 720px) {
          .asset-editor-panel {
            left: 10px;
            right: 10px;
            top: 10px;
            width: auto;
            max-height: calc(100vh - 20px);
          }
          .editor-unlock { left: 10px; bottom: 10px; width: calc(100vw - 20px); }
        }
      </style>

      <div class="editor-unlock" id="editor-unlock">
        <h3>Admin / Editor</h3>
        <div class="editor-unlock-row">
          <input id="editor-admin-code" type="password" placeholder="Code">
          <button id="editor-unlock-button">Unlock</button>
        </div>
        <div class="editor-note">Prototype local editor. Code: edit</div>
      </div>

      <aside class="asset-editor-panel hidden" id="asset-editor-panel">
        <header>
          <h2>Rule Beast Asset Editor</h2>
          <div class="editor-status">EDITOR MODE - LOCAL TESTING ONLY</div>
          <div class="editor-note">Local-only Map Maker. Changes are not permanent until exported and imported by Codex.</div>
          <div class="editor-note" id="editor-map-summary">Map: none</div>
          <div class="editor-note" id="editor-status-line">Editor Mode: OFF / Fly Mode: OFF / Collision: ON / Tool: Select / Selected: none</div>
          <div class="editor-actions"><button id="editor-close">Close Editor</button></div>
        </header>

        <section class="editor-section">
          <h3>Editor Status</h3>
          <div class="editor-help" id="editor-tool-help">Click a surface or editor object to select it.</div>
        </section>

        <section class="editor-section">
          <h3>Asset Uploads</h3>
          <label>Textures <input id="editor-texture-file" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></label>
          <div class="editor-note">My Textures</div>
          <div class="editor-list" id="editor-texture-list"></div>
          <label>Images / GIFs <input id="editor-image-file" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"></label>
          <div class="editor-note">My Images/GIFs</div>
          <div class="editor-list" id="editor-image-list"></div>
          <label>GLB Models <input id="editor-model-file" type="file" accept=".glb,model/gltf-binary"></label>
          <div class="editor-note">My Models</div>
          <div class="editor-list" id="editor-model-list"></div>
        </section>

        <section class="editor-section">
          <h3>Shape Library</h3>
          <div class="editor-input-grid">
            <label>Search <input id="editor-shape-search" placeholder="cube, wall, star"></label>
            <label>Section <select id="editor-shape-category"></select></label>
          </div>
          <div class="editor-note">100 shape choices across Basic shapes, Architecture, and Decorative shapes only.</div>
          <div class="editor-list" id="editor-shape-list"></div>
          <div class="editor-actions">
            <button data-map-marker="survivor">Survivor Spawn</button>
            <button data-map-marker="monster">Monster Spawn</button>
            <button data-map-marker="puzzle">Puzzle Station</button>
            <button data-map-marker="light">Point Light</button>
          </div>
        </section>

        <section class="editor-section">
          <h3>Map Settings</h3>
          <div class="editor-input-grid">
            <label>Gravity Preset <select id="editor-map-gravity-preset"><option value="1">Normal gravity</option><option value="0.45">Low gravity</option><option value="1.8">Heavy gravity</option><option value="0.05">Zero gravity-ish</option></select></label>
            <label>gravityMultiplier <input id="editor-map-gravity" type="number" min="0" max="4" step="0.05" value="1"></label>
            <label>Air Control <input id="editor-map-air-control" type="number" min="0" max="3" step="0.05" value="1"></label>
            <label>Drag <input id="editor-map-drag" type="number" min="0" max="3" step="0.05" value="1"></label>
          </div>
        </section>

        <section class="editor-section">
          <h3>Sun / Main Light</h3>
          <div class="editor-note">The Sun/Main Light is the main map light source. Use brightness/color to control the map mood.</div>
          <div class="editor-input-grid">
            <label>Color <input id="editor-sun-color" type="color" value="#fff4cc"></label>
            <label>Brightness <input id="editor-sun-intensity" type="number" min="0" max="6" step="0.1" value="1.2"></label>
            <label>Ambient Boost <input id="editor-sun-ambient" type="number" min="0" max="2" step="0.05" value="0.25"></label>
          </div>
          <div class="editor-actions">
            <button id="editor-add-sun">Add Sun</button>
            <button id="editor-sun-shadows" class="secondary">Shadows ON</button>
          </div>
        </section>

        <section class="editor-section">
          <h3>Selected Object</h3>
          <div class="editor-selected-info" id="editor-selected-info">Selected: none</div>
          <div class="editor-note" id="editor-editing-status">Editing: Visual Object / Collision: OFF</div>
          <div class="editor-note">Modes: Editing: Visual Object / Editing: Collision Box</div>
          <label>Brightness <input id="editor-brightness" type="range" min="0.25" max="2.5" step="0.05" value="1"></label>
          <div class="editor-input-grid" id="editor-surface-controls">
            <label>Repeat X <input id="editor-repeat-x" type="number" step="0.1" min="0.1" value="1"></label>
            <label>Repeat Y <input id="editor-repeat-y" type="number" step="0.1" min="0.1" value="1"></label>
          </div>
          <div class="editor-actions" id="editor-surface-actions">
            <button id="editor-apply-selected-texture">Apply Selected Texture</button>
            <button id="editor-reset-surface" class="danger">Reset Surface</button>
          </div>
          <div class="editor-actions">
            <button id="editor-toggle-collision">Collision ON/OFF</button>
            <button id="editor-toggle-collision-helpers" class="secondary">Show Collision Boxes</button>
            <button id="editor-edit-collision-box" class="secondary">Edit Collision Box</button>
            <button id="editor-return-object-editing" class="secondary">Return To Object Editing</button>
            <button id="editor-reset-collision-box" class="secondary">Reset Collision Box To Object Bounds</button>
            <button id="editor-duplicate-model">Duplicate</button>
            <button id="editor-delete-model" class="danger">Delete</button>
          </div>
          <div class="editor-input-grid">
            <label>Move Step <input id="editor-move-step" type="number" min="0.1" step="0.1" value="0.5"></label>
            <label>Vertical Step <input id="editor-vertical-step" type="number" min="0.1" step="0.1" value="0.5"></label>
            <label>Scale Step <input id="editor-scale-step" type="number" min="0.05" step="0.05" value="0.1"></label>
            <label>Rotate Step <input id="editor-rotate-step" type="number" min="1" step="1" value="15"></label>
          </div>
          <input id="editor-rotation-y" type="hidden" value="0">
          <input id="editor-uniform-scale" type="hidden" value="1">
          <input id="editor-height-scale" type="hidden" value="1">
          <input id="editor-width-scale" type="hidden" value="1">
          <input id="editor-depth-scale" type="hidden" value="1">
        </section>

        <section class="editor-section">
          <h3>Save / Export</h3>
          <div class="editor-input-grid">
            <label>Map Package Type <select id="editor-package-type"><option value="updateExistingMap">Update Existing Map</option><option value="newMap">New Map</option></select></label>
            <label>Map ID <input id="editor-package-map-id" placeholder="my_custom_map"></label>
            <label>Display Name <input id="editor-package-display-name" placeholder="My Custom Map"></label>
          </div>
          <div class="editor-note" id="editor-last-saved">Last saved: never</div>
          <div class="editor-actions">
            <button id="editor-save-draft">Save Local Draft</button>
            <button id="editor-load-draft">Load Local Draft</button>
            <button id="editor-clear-draft" class="danger">Clear Local Draft</button>
            <button id="editor-export-json">Export Editor JSON</button>
            <button id="editor-export-codex-package">Export Codex Package</button>
          </div>
          <textarea id="editor-json-text" class="editor-json" placeholder="Export Editor JSON appears here"></textarea>
        </section>

        <section class="editor-section">
          <h3>Controls Help</h3>
          <div class="editor-help">
            Status labels show Editor Mode: ON, Fly Mode: ON, Collision ON/OFF, current tool, and selected object/model id.
            Editor Fly Controls: W/A/S/D = fly around, Space = fly up, Shift/Ctrl = fly down, C = toggle editor collision when nothing is selected.
            Selected Model Controls / Selected Object Controls: A left, D right, S forward, W backward, Q bigger, E smaller, R taller, F shorter, Z wider, X narrower, T deeper, G thinner, Arrow Up/Down height, Arrow Left/Right rotate, Ctrl+C copies, Delete removes, Esc clears selection.
            Upload a texture, then drag it onto a wall/floor/object or click a selected surface with Apply Selected Texture.
            Upload an image/GIF to place a flat billboard. GIFs display as static image planes in this version.
            Shape Library objects and imported GLBs use simple box collision by default; image/GIF planes default collision OFF. Collision boxes are green when ON and gray/red when OFF.
            Export Editor JSON = quick metadata export. Export Codex Package = full package for Codex with manifest + assets.
            To make permanent: put ZIP in editor_imports/inbox and ask Codex to import it.
          </div>
        </section>

        <section class="editor-section">
          <h3>Diagnostics</h3>
          <div class="editor-note" id="editor-counts">Textures: 0 / Images: 0 / Models: 0 / Shapes: 100 / Placements: 0 / Surface edits: 0</div>
          <div class="editor-log" id="editor-log"></div>
        </section>
      </aside>
    `;
    document.body.appendChild(this.root);
    this.unlock = this.root.querySelector('#editor-unlock');
    this.panel = this.root.querySelector('#asset-editor-panel');
    this.bind();
  }

  bind() {
    const q = (selector) => this.root.querySelector(selector);
    q('#editor-unlock-button').addEventListener('click', () => this.callbacks.unlock?.(q('#editor-admin-code').value));
    q('#editor-close').addEventListener('click', () => this.callbacks.close?.());
    q('#editor-toggle-collision').addEventListener('click', () => this.callbacks.toggleCollision?.());
    q('#editor-toggle-collision-helpers').addEventListener('click', () => this.callbacks.toggleCollisionHelpers?.());
    q('#editor-texture-file').addEventListener('change', async (event) => { await this.callbacks.importTexture?.(event.target.files?.[0]); this.resetFileInput(event.target); });
    q('#editor-image-file').addEventListener('change', async (event) => { await this.callbacks.importImage?.(event.target.files?.[0]); this.resetFileInput(event.target); });
    q('#editor-model-file').addEventListener('change', async (event) => { await this.callbacks.importModel?.(event.target.files?.[0]); this.resetFileInput(event.target); });
    q('#editor-brightness').addEventListener('input', (event) => this.callbacks.changeBrightness?.(Number(event.target.value)));
    q('#editor-repeat-x').addEventListener('input', () => this.callbacks.updateSurfaceRepeat?.(this.surfaceRepeat()));
    q('#editor-repeat-y').addEventListener('input', () => this.callbacks.updateSurfaceRepeat?.(this.surfaceRepeat()));
    q('#editor-apply-selected-texture').addEventListener('click', () => this.callbacks.applySelectedTexture?.());
    q('#editor-reset-surface').addEventListener('click', () => this.callbacks.resetSurface?.());
    q('#editor-duplicate-model').addEventListener('click', () => this.callbacks.duplicateModel?.());
    q('#editor-delete-model').addEventListener('click', () => this.callbacks.deleteModel?.());
    q('#editor-edit-collision-box').addEventListener('click', () => this.callbacks.editCollisionBox?.());
    q('#editor-return-object-editing').addEventListener('click', () => this.callbacks.returnObjectEditing?.());
    q('#editor-reset-collision-box').addEventListener('click', () => this.callbacks.resetCollisionBox?.());
    q('#editor-add-sun').addEventListener('click', () => this.callbacks.placeSun?.());
    q('#editor-sun-shadows').addEventListener('click', () => this.toggleButtonSetting('#editor-sun-shadows', 'Shadows', (value) => this.callbacks.updateSunSettings?.({ shadows: value })));
    ['#editor-sun-color', '#editor-sun-intensity', '#editor-sun-ambient'].forEach((selector) => {
      q(selector).addEventListener('input', () => this.callbacks.updateSunSettings?.(this.sunSettings()));
    });
    ['#editor-map-gravity', '#editor-map-air-control', '#editor-map-drag'].forEach((selector) => {
      q(selector).addEventListener('input', () => this.callbacks.updateMapSettings?.(this.mapSettings()));
    });
    q('#editor-map-gravity-preset').addEventListener('change', (event) => {
      q('#editor-map-gravity').value = event.target.value;
      this.callbacks.updateMapSettings?.(this.mapSettings());
    });
    q('#editor-save-draft').addEventListener('click', () => this.callbacks.saveDraft?.());
    q('#editor-load-draft').addEventListener('click', () => this.callbacks.loadDraft?.());
    q('#editor-clear-draft').addEventListener('click', () => this.callbacks.clearDraft?.());
    q('#editor-export-json').addEventListener('click', () => this.callbacks.exportJson?.());
    q('#editor-export-codex-package').addEventListener('click', () => this.callbacks.exportCodexPackage?.());
    q('#editor-rotation-y').addEventListener('input', (event) => this.callbacks.setModelRotation?.(Number(event.target.value)));
    q('#editor-uniform-scale').addEventListener('input', (event) => this.callbacks.setModelScale?.('uniform', Number(event.target.value)));
    q('#editor-height-scale').addEventListener('input', (event) => this.callbacks.setModelScale?.('height', Number(event.target.value)));
    q('#editor-width-scale').addEventListener('input', (event) => this.callbacks.setModelScale?.('width', Number(event.target.value)));
    q('#editor-depth-scale').addEventListener('input', (event) => this.callbacks.setModelScale?.('depth', Number(event.target.value)));
    ['#editor-package-type', '#editor-package-map-id', '#editor-package-display-name'].forEach((selector) => {
      q(selector).addEventListener('input', () => this.callbacks.updatePackageSettings?.(this.packageSettings()));
      q(selector).addEventListener('change', () => this.callbacks.updatePackageSettings?.(this.packageSettings()));
    });
    q('#editor-shape-search').addEventListener('input', () => this.renderShapes());
    q('#editor-shape-category').addEventListener('change', () => this.renderShapes());
    this.root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) return;
      const texture = target.closest('[data-texture-id]');
      const image = target.closest('[data-image-id]');
      const model = target.closest('[data-model-id]');
      const shape = target.closest('[data-shape-id]');
      const removeTexture = target.closest('[data-remove-texture]');
      const removeImage = target.closest('[data-remove-image]');
      const removeModel = target.closest('[data-remove-model]');
      const marker = target.closest('[data-map-marker]');
      if (removeTexture) return this.callbacks.removeTexture?.(removeTexture.dataset.removeTexture);
      if (removeImage) return this.callbacks.removeImage?.(removeImage.dataset.removeImage);
      if (removeModel) return this.callbacks.removeModel?.(removeModel.dataset.removeModel);
      if (marker) return this.callbacks.placeMarker?.(marker.dataset.mapMarker);
      if (texture) return this.callbacks.selectTexture?.(texture.dataset.textureId);
      if (image) return this.callbacks.selectImage?.(image.dataset.imageId);
      if (model) return this.callbacks.selectModel?.(model.dataset.modelId);
      if (shape) return this.callbacks.selectShape?.(shape.dataset.shapeId);
    });
    this.root.addEventListener('dragstart', (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) return;
      const texture = target.closest('[data-texture-id]');
      const image = target.closest('[data-image-id]');
      const model = target.closest('[data-model-id]');
      const shape = target.closest('[data-shape-id]');
      const payload = texture
        ? { kind: 'texture', id: texture.dataset.textureId }
        : image
          ? { kind: 'image', id: image.dataset.imageId }
          : model
            ? { kind: 'model', id: model.dataset.modelId }
            : shape
              ? { kind: 'shape', id: shape.dataset.shapeId }
              : null;
      if (!payload) return;
      event.dataTransfer?.setData('application/x-rule-beast-editor', JSON.stringify(payload));
      event.dataTransfer?.setData('text/plain', `${payload.kind}:${payload.id}`);
    });
  }

  resetFileInput(input) {
    if (input) input.value = '';
  }

  toggleButtonSetting(selector, label, callback) {
    const button = this.root.querySelector(selector);
    const next = button.dataset.enabled !== 'true';
    button.dataset.enabled = String(next);
    button.textContent = `${label} ${next ? 'ON' : 'OFF'}`;
    callback?.(next);
  }

  sunSettings() {
    const q = (selector) => this.root.querySelector(selector);
    return {
      color: q('#editor-sun-color').value,
      intensity: Number(q('#editor-sun-intensity').value || 1.2),
      ambientBoost: Number(q('#editor-sun-ambient').value || 0.25)
    };
  }

  mapSettings() {
    const q = (selector) => this.root.querySelector(selector);
    return {
      gravityMultiplier: Number(q('#editor-map-gravity').value || 1),
      airControl: Number(q('#editor-map-air-control').value || 1),
      drag: Number(q('#editor-map-drag').value || 1)
    };
  }

  setUnlocked(unlocked) {
    this.unlock.classList.toggle('hidden', unlocked);
    this.panel.classList.toggle('hidden', !unlocked);
  }

  setMapMakerMode(active) {
    this.root.querySelector('.asset-editor-panel h2').textContent = active ? 'Rule Beast Map Maker' : 'Rule Beast Asset Editor';
  }

  setToolMode(mode) {
    this.toolMode = mode;
    const help = {
      select: 'Click a surface or editor object to select it.',
      paint: 'Select a texture, then click an editable surface or object.',
      place: 'Select a shape, image/GIF, or GLB, then click the map.',
      edit: 'Use keyboard controls to edit the selected object.'
    };
    this.root.querySelector('#editor-tool-help').textContent = help[mode] || help.select;
  }

  setMapSummary(text) {
    this.root.querySelector('#editor-map-summary').textContent = text;
  }

  setStatus({ editorActive, flyActive, collisionEnabled, toolMode, selectedId }) {
    this.root.querySelector('#editor-status-line').textContent = `Editor Mode: ${editorActive ? 'ON' : 'OFF'} / Fly Mode: ${flyActive ? 'ON' : 'OFF'} / Collision: ${collisionEnabled ? 'ON' : 'OFF'} / Tool: ${toolLabel[toolMode] || toolMode} / Selected: ${selectedId || 'none'}`;
  }

  packageSettings() {
    return {
      packageType: this.root.querySelector('#editor-package-type').value,
      mapId: this.root.querySelector('#editor-package-map-id').value.trim(),
      displayName: this.root.querySelector('#editor-package-display-name').value.trim()
    };
  }

  setPackageSettings({ packageType, mapId, displayName }) {
    const type = this.root.querySelector('#editor-package-type');
    const id = this.root.querySelector('#editor-package-map-id');
    const name = this.root.querySelector('#editor-package-display-name');
    if (document.activeElement !== type) type.value = packageType || 'updateExistingMap';
    if (document.activeElement !== id) id.value = mapId || '';
    if (document.activeElement !== name) name.value = displayName || '';
  }

  setTextures(textures, selectedId) {
    const list = this.root.querySelector('#editor-texture-list');
    list.innerHTML = textures.length ? textures.map((texture) => `
      <button class="editor-list-item ${texture.id === selectedId ? 'selected' : ''}" draggable="true" data-texture-id="${escapeHtml(texture.id)}">
        <img alt="" src="${escapeHtml(texture.temporaryLocalUrl || '')}">
        <span>${escapeHtml(texture.name)}<br><span class="editor-chip">${texture.missingLocalFile ? 'missing local file' : 'drag/click paint'}</span></span>
        <span data-remove-texture="${escapeHtml(texture.id)}" class="editor-chip">Remove</span>
      </button>
    `).join('') : '<div class="editor-note">No textures uploaded.</div>';
  }

  setImages(images, selectedId) {
    const list = this.root.querySelector('#editor-image-list');
    list.innerHTML = images.length ? images.map((image) => `
      <button class="editor-list-item ${image.id === selectedId ? 'selected' : ''}" draggable="true" data-image-id="${escapeHtml(image.id)}">
        <img alt="" src="${escapeHtml(image.temporaryLocalUrl || '')}">
        <span>${escapeHtml(image.name)}<br><span class="editor-chip">${image.isGif ? 'GIF static plane' : 'image plane'}</span></span>
        <span data-remove-image="${escapeHtml(image.id)}" class="editor-chip">Remove</span>
      </button>
    `).join('') : '<div class="editor-note">No images/GIFs uploaded.</div>';
  }

  setModels(models, selectedId) {
    const list = this.root.querySelector('#editor-model-list');
    list.innerHTML = models.length ? models.map((model) => `
      <button class="editor-list-item ${model.id === selectedId ? 'selected' : ''}" draggable="true" data-model-id="${escapeHtml(model.id)}">
        <span class="editor-chip">GLB</span>
        <span>${escapeHtml(model.name)}<br><span class="editor-chip">${model.animations?.length ? `${model.animations.length} animation(s)` : model.missingLocalFile ? 'missing local file' : 'collision ON'}</span></span>
        <span data-remove-model="${escapeHtml(model.id)}" class="editor-chip">Remove</span>
      </button>
    `).join('') : '<div class="editor-note">No models uploaded.</div>';
  }

  setShapes(shapes, categories, selectedId) {
    this.lastShapes = shapes;
    this.lastCategories = categories;
    this.selectedShapeId = selectedId;
    const category = this.root.querySelector('#editor-shape-category');
    if (!category.options.length) category.innerHTML = ['All sections', ...categories].map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
    this.renderShapes();
  }

  renderShapes() {
    const list = this.root.querySelector('#editor-shape-list');
    const search = this.root.querySelector('#editor-shape-search').value.trim().toLowerCase();
    const category = this.root.querySelector('#editor-shape-category').value;
    const shapes = this.lastShapes.filter((shape) => {
      const categoryMatch = category === 'All sections' || !category || shape.category === category;
      const searchMatch = !search || `${shape.name} ${shape.category} ${shape.id}`.toLowerCase().includes(search);
      return categoryMatch && searchMatch;
    });
    list.innerHTML = shapes.map((shape) => `
      <button class="editor-list-item ${shape.id === this.selectedShapeId ? 'selected' : ''}" draggable="true" data-shape-id="${escapeHtml(shape.id)}">
        <span class="editor-chip">${escapeHtml(shape.category.replace(' shapes', ''))}</span>
        <span>${escapeHtml(shape.name)}<br><span class="editor-chip">collision ON</span></span>
        <span class="editor-chip">Place</span>
      </button>
    `).join('') || '<div class="editor-note">No matching shapes.</div>';
  }

  setPlacedModels() {
    // The old bulky placed-object list is intentionally removed; selection happens in-scene.
  }

  setSelectedInfo(meta, details = {}) {
    const info = this.root.querySelector('#editor-selected-info');
    const status = this.root.querySelector('#editor-editing-status');
    if (!meta) {
      info.textContent = 'Selected: none';
      if (status) status.textContent = 'Editing: Visual Object / Collision: OFF';
    } else if (meta.supportsTransform) {
      const collision = details.collision ? ` / collision: ${details.collision.enabled ? 'ON' : 'OFF'}` : '';
      const animation = details.animation?.hasAnimations ? ` / animation: ${details.animation.selectedName || 'autoplay'}` : '';
      info.textContent = `Selected object: ${details.modelName || meta.id} / ${details.objectType || meta.type} / ${meta.id}${collision}${animation}`;
      if (status) status.textContent = `Editing: ${details.editingCollision ? 'Collision Box' : 'Visual Object'} / Collision: ${details.collision?.enabled ? 'ON' : 'OFF'}`;
    } else {
      info.textContent = `Selected surface: ${meta.id} / ${meta.type} / ${meta.mapId || 'map'} / ${meta.floor || 'floor'} / texture: ${details.textureName || 'none'}`;
      if (status) status.textContent = 'Editing: Visual Object / Collision: OFF';
    }
    this.root.querySelector('#editor-brightness').value = details.brightness ?? 1;
    this.root.querySelector('#editor-repeat-x').value = details.repeat?.x ?? 1;
    this.root.querySelector('#editor-repeat-y').value = details.repeat?.y ?? 1;
  }

  setModelControlValues(placement) {
    const q = (selector) => this.root.querySelector(selector);
    const rotationY = placement ? Math.round((placement.rotation?.y || 0) * 180 / Math.PI) : 0;
    q('#editor-rotation-y').value = rotationY;
    q('#editor-uniform-scale').value = placement?.scale?.uniform ?? 1;
    q('#editor-height-scale').value = placement?.scale?.y ?? 1;
    q('#editor-width-scale').value = placement?.scale?.x ?? 1;
    q('#editor-depth-scale').value = placement?.scale?.z ?? 1;
  }

  controlSteps() {
    return {
      move: Number(this.root.querySelector('#editor-move-step').value) || 0.5,
      verticalMove: Number(this.root.querySelector('#editor-vertical-step').value) || 0.5,
      rotate: (Number(this.root.querySelector('#editor-rotate-step').value) || 15) * Math.PI / 180,
      scale: Number(this.root.querySelector('#editor-scale-step').value) || 0.1
    };
  }

  surfaceRepeat() {
    return {
      x: Math.max(0.1, Number(this.root.querySelector('#editor-repeat-x').value) || 1),
      y: Math.max(0.1, Number(this.root.querySelector('#editor-repeat-y').value) || 1)
    };
  }

  setLastSaved(timestamp) {
    this.root.querySelector('#editor-last-saved').textContent = `Last saved: ${timestamp ? new Date(timestamp).toLocaleString() : 'never'}`;
  }

  setCounts({ textures, images = 0, models, shapes = 100, placements, surfaceEdits }) {
    this.root.querySelector('#editor-counts').textContent = `Textures: ${textures} / Images: ${images} / Models: ${models} / Shapes: ${shapes} / Placements: ${placements} / Surface edits: ${surfaceEdits}`;
  }

  setJsonText(text) {
    this.root.querySelector('#editor-json-text').value = text;
  }

  log(lines) {
    this.root.querySelector('#editor-log').textContent = lines.join('\n');
  }
}
