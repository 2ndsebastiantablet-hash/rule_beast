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
  place: 'Place Model',
  edit: 'Move/Edit Object'
};

export class EditorUI {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.toolMode = 'select';
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
        .editor-unlock-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }
        .asset-editor-panel {
          position: absolute;
          right: 16px;
          top: 16px;
          width: min(430px, calc(100vw - 32px));
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
        .editor-actions,
        .editor-tool-row,
        .editor-list,
        .editor-grid-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .editor-actions { margin-top: 8px; }
        .editor-grid-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .editor-tool-row button.active {
          background: linear-gradient(180deg, #ffd15f, #d38a24);
          color: #1a0900;
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
        .editor-input-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .editor-list {
          margin-top: 8px;
          max-height: 136px;
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
        .editor-chip {
          color: var(--editor-gold);
          font-size: 10px;
        }
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
          <div class="editor-note">Local-only editor. Changes are not permanent yet.</div>
          <div class="editor-note" id="editor-map-summary">Map: none</div>
          <div class="editor-note" id="editor-status-line">Editor Mode: OFF / Fly Mode: OFF / Collision: ON / Tool: Select / Selected: none</div>
          <div class="editor-actions"><button id="editor-close">Close Editor</button></div>
        </header>

        <section class="editor-section">
          <h3>Current Tool Mode</h3>
          <div class="editor-tool-row">
            <button data-tool-mode="select" class="active">Select</button>
            <button data-tool-mode="paint">Paint Texture Mode</button>
            <button data-tool-mode="place">Place Model Mode</button>
            <button data-tool-mode="edit">Move/Edit Object</button>
          </div>
          <div class="editor-actions"><button id="editor-toggle-collision">Collision ON/OFF</button></div>
          <div class="editor-help" id="editor-tool-help">Click a surface or placed model to select it.</div>
        </section>

        <section class="editor-section">
          <h3>Upload Texture</h3>
          <label>Texture file <input id="editor-texture-file" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></label>
          <div class="editor-note">Local texture only. Export/save permanently later.</div>
          <h3>My Textures</h3>
          <div class="editor-list" id="editor-texture-list"></div>
        </section>

        <section class="editor-section">
          <h3>Upload GLB</h3>
          <label>GLB model <input id="editor-model-file" type="file" accept=".glb,model/gltf-binary"></label>
          <div class="editor-note">Imported models are visual-only unless Codex later adds collision.</div>
          <h3>My Models</h3>
          <div class="editor-list" id="editor-model-list"></div>
        </section>

        <section class="editor-section">
          <h3>Placed Objects</h3>
          <div class="editor-list" id="editor-placed-list"></div>
        </section>

        <section class="editor-section">
          <h3>Selected Item</h3>
          <div class="editor-selected-info" id="editor-selected-info">Selected: none</div>
          <label>Brightness <input id="editor-brightness" type="range" min="0.25" max="2.5" step="0.05" value="1"></label>
          <div class="editor-input-grid" id="editor-surface-controls">
            <label>Repeat X <input id="editor-repeat-x" type="number" step="0.1" min="0.1" value="1"></label>
            <label>Repeat Y <input id="editor-repeat-y" type="number" step="0.1" min="0.1" value="1"></label>
          </div>
          <div class="editor-actions" id="editor-surface-actions">
            <button id="editor-apply-selected-texture">Apply Selected Texture</button>
            <button id="editor-reset-surface" class="danger">Reset Surface</button>
          </div>
        </section>

        <section class="editor-section" id="editor-model-controls">
          <h3>Model Edit Controls</h3>
          <div class="editor-input-grid">
            <label>Move Step <input id="editor-move-step" type="number" min="0.1" step="0.1" value="0.5"></label>
            <label>Vertical Step <input id="editor-vertical-step" type="number" min="0.1" step="0.1" value="0.5"></label>
            <label>Scale Step <input id="editor-scale-step" type="number" min="0.05" step="0.05" value="0.1"></label>
            <label>Rotate Step <input id="editor-rotate-step" type="number" min="1" step="1" value="15"></label>
            <label>Rotation <input id="editor-rotation-y" type="range" min="-180" max="180" step="1" value="0"></label>
            <label>Size <input id="editor-uniform-scale" type="range" min="0.1" max="5" step="0.05" value="1"></label>
            <label>Height <input id="editor-height-scale" type="range" min="0.1" max="5" step="0.05" value="1"></label>
            <label>Width <input id="editor-width-scale" type="range" min="0.1" max="5" step="0.05" value="1"></label>
            <label>Depth <input id="editor-depth-scale" type="range" min="0.1" max="5" step="0.05" value="1"></label>
          </div>
          <div class="editor-grid-actions">
            <button data-model-action="move-left">Move Left</button>
            <button data-model-action="move-forward">Move Forward</button>
            <button data-model-action="move-right">Move Right</button>
            <button data-model-action="move-up">Move Up</button>
            <button data-model-action="move-back">Move Back</button>
            <button data-model-action="move-down">Move Down</button>
            <button data-model-action="rotate-left">Rotate Left</button>
            <button data-model-action="reset-rotation">Reset Rotation</button>
            <button data-model-action="rotate-right">Rotate Right</button>
            <button data-model-action="bigger">Bigger</button>
            <button data-model-action="smaller">Smaller</button>
            <button data-model-action="reset-transform">Reset Transform</button>
            <button data-model-action="taller">Taller</button>
            <button data-model-action="shorter">Shorter</button>
            <button data-model-action="wider">Wider</button>
            <button data-model-action="narrower">Narrower</button>
            <button data-model-action="deeper">Deeper</button>
            <button data-model-action="thinner">Thinner</button>
          </div>
          <div class="editor-actions">
            <button id="editor-duplicate-model">Duplicate</button>
            <button id="editor-delete-model" class="danger">Delete</button>
          </div>
        </section>

        <section class="editor-section">
          <h3>Save / Export</h3>
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
          <h3>Help</h3>
          <div class="editor-help">
            Status labels show Editor Mode: ON, Fly Mode: ON, Collision ON/OFF, current tool, and selected object/model id.
            Upload a texture, then drag it onto a wall/floor or select texture and click surface in Paint Texture Mode.
            Upload a GLB, then drag it into the map or select model and click placement location.
            Click placed models to resize/move them.
            Editor Fly Controls: W/A/S/D = fly around, Space = fly up, Shift/Ctrl = fly down, C = toggle collision.
            Selected Model Controls: Select a model, then use Q/E to scale, WASD to move, Arrow Up/Down to change height, Arrow Left/Right to rotate.
            Export Editor JSON = quick metadata export. Export Codex Package = full package for Codex with manifest + assets.
            To make permanent: put ZIP in editor_imports/inbox and ask Codex to import it.
            Local edits are not permanent until imported into the repo. Blob URLs are temporary.
            If package export says files are missing, re-upload the missing files and export again.
          </div>
        </section>

        <section class="editor-section">
          <h3>Diagnostics</h3>
          <div class="editor-note" id="editor-counts">Textures: 0 / Models: 0 / Placements: 0 / Surface edits: 0</div>
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
    q('#editor-texture-file').addEventListener('change', (event) => this.callbacks.importTexture?.(event.target.files?.[0]));
    q('#editor-model-file').addEventListener('change', (event) => this.callbacks.importModel?.(event.target.files?.[0]));
    q('#editor-brightness').addEventListener('input', (event) => this.callbacks.changeBrightness?.(Number(event.target.value)));
    q('#editor-repeat-x').addEventListener('input', () => this.callbacks.updateSurfaceRepeat?.(this.surfaceRepeat()));
    q('#editor-repeat-y').addEventListener('input', () => this.callbacks.updateSurfaceRepeat?.(this.surfaceRepeat()));
    q('#editor-apply-selected-texture').addEventListener('click', () => this.callbacks.applySelectedTexture?.());
    q('#editor-reset-surface').addEventListener('click', () => this.callbacks.resetSurface?.());
    q('#editor-duplicate-model').addEventListener('click', () => this.callbacks.duplicateModel?.());
    q('#editor-delete-model').addEventListener('click', () => this.callbacks.deleteModel?.());
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
    this.root.querySelectorAll('[data-tool-mode]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.setToolMode?.(button.dataset.toolMode));
    });
    this.root.querySelectorAll('[data-model-action]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.modelAction?.(button.dataset.modelAction, this.controlSteps()));
    });
    this.root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) return;
      const texture = target.closest('[data-texture-id]');
      const model = target.closest('[data-model-id]');
      const placed = target.closest('[data-placed-id]');
      const removeTexture = target.closest('[data-remove-texture]');
      const removeModel = target.closest('[data-remove-model]');
      if (removeTexture) return this.callbacks.removeTexture?.(removeTexture.dataset.removeTexture);
      if (removeModel) return this.callbacks.removeModel?.(removeModel.dataset.removeModel);
      if (texture) return this.callbacks.selectTexture?.(texture.dataset.textureId);
      if (model) return this.callbacks.selectModel?.(model.dataset.modelId);
      if (placed) return this.callbacks.selectPlacedModel?.(placed.dataset.placedId);
    });
    this.root.addEventListener('dragstart', (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) return;
      const texture = target.closest('[data-texture-id]');
      const model = target.closest('[data-model-id]');
      const payload = texture
        ? { kind: 'texture', id: texture.dataset.textureId }
        : model
          ? { kind: 'model', id: model.dataset.modelId }
          : null;
      if (!payload) return;
      event.dataTransfer?.setData('application/x-rule-beast-editor', JSON.stringify(payload));
      event.dataTransfer?.setData('text/plain', `${payload.kind}:${payload.id}`);
    });
  }

  setUnlocked(unlocked) {
    this.unlock.classList.toggle('hidden', unlocked);
    this.panel.classList.toggle('hidden', !unlocked);
  }

  setToolMode(mode) {
    this.toolMode = mode;
    this.root.querySelectorAll('[data-tool-mode]').forEach((button) => button.classList.toggle('active', button.dataset.toolMode === mode));
    const help = {
      select: 'Click a surface or placed model to select it.',
      paint: 'Select a texture, then click a surface. You can also drag a texture onto the canvas.',
      place: 'Select a GLB, then click the map. You can also drag a model into the canvas.',
      edit: 'Click a placed model, then use the PowerPoint-style controls.'
    };
    this.root.querySelector('#editor-tool-help').textContent = help[mode] || help.select;
  }

  setMapSummary(text) {
    this.root.querySelector('#editor-map-summary').textContent = text;
  }

  setStatus({ editorActive, flyActive, collisionEnabled, toolMode, selectedId }) {
    this.root.querySelector('#editor-status-line').textContent = `Editor Mode: ${editorActive ? 'ON' : 'OFF'} / Fly Mode: ${flyActive ? 'ON' : 'OFF'} / Collision: ${collisionEnabled ? 'ON' : 'OFF'} / Tool: ${toolLabel[toolMode] || toolMode} / Selected: ${selectedId || 'none'}`;
  }

  setTextures(textures, selectedId) {
    const list = this.root.querySelector('#editor-texture-list');
    list.innerHTML = textures.length ? textures.map((texture) => `
      <button class="editor-list-item ${texture.id === selectedId ? 'selected' : ''}" draggable="true" data-texture-id="${escapeHtml(texture.id)}">
        <img alt="" src="${escapeHtml(texture.temporaryLocalUrl || '')}">
        <span>${escapeHtml(texture.name)}<br><span class="editor-chip">${texture.missingLocalFile ? 'missing local file' : 'drag or click'}</span></span>
        <span data-remove-texture="${escapeHtml(texture.id)}" class="editor-chip">Remove</span>
      </button>
    `).join('') : '<div class="editor-note">No textures uploaded.</div>';
  }

  setModels(models, selectedId) {
    const list = this.root.querySelector('#editor-model-list');
    list.innerHTML = models.length ? models.map((model) => `
      <button class="editor-list-item ${model.id === selectedId ? 'selected' : ''}" draggable="true" data-model-id="${escapeHtml(model.id)}">
        <span class="editor-chip">GLB</span>
        <span>${escapeHtml(model.name)}<br><span class="editor-chip">${model.missingLocalFile ? 'missing local file' : 'drag or click'}</span></span>
        <span data-remove-model="${escapeHtml(model.id)}" class="editor-chip">Remove</span>
      </button>
    `).join('') : '<div class="editor-note">No models uploaded.</div>';
  }

  setPlacedModels(placements, selectedId) {
    const list = this.root.querySelector('#editor-placed-list');
    list.innerHTML = placements.length ? placements.map((placement) => `
      <button class="editor-list-item ${placement.id === selectedId ? 'selected' : ''}" data-placed-id="${escapeHtml(placement.id)}">
        <span class="editor-chip">OBJ</span>
        <span>${escapeHtml(placement.modelName || placement.id)}<br><span class="editor-chip">${escapeHtml(placement.id)}</span></span>
        <span class="editor-chip">Select</span>
      </button>
    `).join('') : '<div class="editor-note">No placed objects yet.</div>';
  }

  setSelectedInfo(meta, details = {}) {
    const info = this.root.querySelector('#editor-selected-info');
    if (!meta) info.textContent = 'Selected: none';
    else if (meta.supportsTransform) info.textContent = `Selected model: ${details.modelName || meta.id} / ${meta.id}`;
    else info.textContent = `Selected surface: ${meta.id} / ${meta.type} / ${meta.mapId || 'map'} / ${meta.floor || 'floor'} / texture: ${details.textureName || 'none'}`;
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

  setCounts({ textures, models, placements, surfaceEdits }) {
    this.root.querySelector('#editor-counts').textContent = `Textures: ${textures} / Models: ${models} / Placements: ${placements} / Surface edits: ${surfaceEdits}`;
  }

  setJsonText(text) {
    this.root.querySelector('#editor-json-text').value = text;
  }

  log(lines) {
    this.root.querySelector('#editor-log').textContent = lines.join('\n');
  }
}
