const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char]);

export class EditorUI {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('div');
    this.root.id = 'asset-editor-root';
    this.root.innerHTML = `
      <style>
        #asset-editor-root { position: fixed; inset: 0; pointer-events: none; z-index: 22; font-family: Orbitron, system-ui, sans-serif; color: #d8fbff; }
        .editor-unlock { pointer-events: auto; position: absolute; left: 16px; bottom: 16px; width: min(320px, calc(100vw - 32px)); padding: 12px; border: 1px solid rgba(115,247,255,.3); background: rgba(3,8,16,.9); border-radius: 10px; box-shadow: 0 0 24px rgba(80,240,255,.14); }
        .editor-unlock h3, .asset-editor-panel h2, .asset-editor-panel h3 { margin: 0 0 8px; color: #73f7ff; }
        .editor-unlock-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        .asset-editor-panel { pointer-events: auto; position: absolute; right: 16px; top: 16px; width: min(430px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 14px; border: 1px solid rgba(115,247,255,.34); background: linear-gradient(145deg, rgba(4,9,18,.96), rgba(28,3,12,.92)); border-radius: 12px; box-shadow: 0 0 40px rgba(255, 20, 60, .18); }
        .asset-editor-panel.hidden, .editor-unlock.hidden { display: none; }
        .editor-enabled-chip { color: #ffd15f; font-size: 11px; margin: 6px 0 10px; }
        .asset-editor-section { margin: 12px 0; padding-top: 12px; border-top: 1px solid rgba(115,247,255,.18); }
        .asset-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .asset-editor-panel label { display: grid; gap: 4px; color: #83f8ff; font-size: 11px; text-transform: uppercase; }
        .asset-editor-panel input, .asset-editor-panel select, .asset-editor-panel textarea, .editor-unlock input { min-height: 32px; border: 1px solid rgba(115,247,255,.35); background: rgba(0,0,0,.48); color: #d8fbff; border-radius: 7px; padding: 6px 8px; font-family: inherit; box-sizing: border-box; width: 100%; }
        .asset-editor-panel textarea { min-height: 130px; resize: vertical; text-transform: none; }
        .asset-editor-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .asset-editor-actions button, .editor-unlock button { border: 0; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-weight: 700; color: #051016; background: linear-gradient(180deg, #86fbff, #29b8d0); cursor: pointer; }
        .asset-editor-actions button.danger { background: linear-gradient(180deg, #ff8aa1, #d73555); color: #140208; }
        .asset-editor-small { font-size: 11px; color: #a9c0c8; line-height: 1.45; }
        .asset-editor-log { min-height: 52px; max-height: 130px; overflow: auto; padding: 8px; background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; font-size: 11px; white-space: pre-wrap; }
        .texture-preview { width: 72px; height: 48px; object-fit: cover; border: 1px solid rgba(115,247,255,.3); border-radius: 6px; background: #02060c; }
      </style>
      <div class="editor-unlock" id="editor-unlock">
        <h3>Admin / Editor</h3>
        <div class="editor-unlock-row">
          <input id="editor-admin-code" type="password" placeholder="Admin code">
          <button id="editor-unlock-button">Unlock</button>
        </div>
        <div class="asset-editor-small">Prototype-only local editor. No cloud publishing.</div>
      </div>
      <aside class="asset-editor-panel hidden" id="asset-editor-panel">
        <header>
          <h2>Asset Editor</h2>
          <div class="editor-enabled-chip">EDITOR MODE ENABLED - LOCAL ONLY</div>
          <div class="asset-editor-small" id="editor-map-summary">Map: none</div>
          <div class="asset-editor-actions"><button id="editor-close">Close Editor</button></div>
        </header>

        <section class="asset-editor-section">
          <h3>Object Selection</h3>
          <label>Selectable object <select id="editor-object-select"></select></label>
          <div class="asset-editor-small" id="editor-selected-info">Selected: none</div>
          <label><input id="editor-highlight-toggle" type="checkbox" checked> Highlight selected object</label>
          <div class="asset-editor-actions"><button id="editor-refresh-objects">Refresh Object List</button></div>
        </section>

        <section class="asset-editor-section">
          <h3>Texture Import</h3>
          <label>Texture file <input id="editor-texture-file" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></label>
          <label>Imported texture <select id="editor-texture-select"></select></label>
          <img id="editor-texture-preview" class="texture-preview" alt="Texture preview">
          <div class="asset-editor-actions">
            <button id="editor-apply-texture">Apply Texture</button>
            <button id="editor-remove-texture" class="danger">Remove Texture</button>
          </div>
        </section>

        <section class="asset-editor-section">
          <h3>Texture Settings</h3>
          <div class="asset-editor-grid">
            <label>Repeat X <input id="editor-repeat-x" type="number" step="0.1" value="1"></label>
            <label>Repeat Y <input id="editor-repeat-y" type="number" step="0.1" value="1"></label>
            <label>Offset X <input id="editor-offset-x" type="number" step="0.05" value="0"></label>
            <label>Offset Y <input id="editor-offset-y" type="number" step="0.05" value="0"></label>
            <label>Rotation Degrees <input id="editor-rotation" type="number" step="1" value="0"></label>
          </div>
          <div class="asset-editor-actions">
            <button id="editor-update-texture-settings">Apply / Update</button>
            <button id="editor-reset-texture-settings">Reset Settings</button>
          </div>
        </section>

        <section class="asset-editor-section">
          <h3>GLB Model Import</h3>
          <label>GLB file <input id="editor-model-file" type="file" accept=".glb,model/gltf-binary"></label>
          <label>Imported model <select id="editor-model-select"></select></label>
          <div class="asset-editor-actions">
            <button id="editor-place-model">Place Model</button>
            <button id="editor-duplicate-model">Duplicate Selected</button>
            <button id="editor-delete-model" class="danger">Delete Selected</button>
          </div>
        </section>

        <section class="asset-editor-section">
          <h3>Transform Controls</h3>
          <div class="asset-editor-grid">
            <label>Position X <input id="editor-pos-x" type="number" step="0.1" value="0"></label>
            <label>Position Y <input id="editor-pos-y" type="number" step="0.1" value="0"></label>
            <label>Position Z <input id="editor-pos-z" type="number" step="0.1" value="0"></label>
            <label>Uniform Scale <input id="editor-uniform-scale" type="number" step="0.1" value="1"></label>
            <label>Rotation X Degrees <input id="editor-rot-x" type="number" step="1" value="0"></label>
            <label>Rotation Y Degrees <input id="editor-rot-y" type="number" step="1" value="0"></label>
            <label>Rotation Z Degrees <input id="editor-rot-z" type="number" step="1" value="0"></label>
            <label>Scale X <input id="editor-scale-x" type="number" step="0.1" value="1"></label>
            <label>Scale Y <input id="editor-scale-y" type="number" step="0.1" value="1"></label>
            <label>Scale Z <input id="editor-scale-z" type="number" step="0.1" value="1"></label>
          </div>
          <div class="asset-editor-actions">
            <button id="editor-apply-transform">Apply Transform</button>
            <button id="editor-reset-transform">Reset Transform</button>
            <button id="editor-move-to-player">Move To Player</button>
          </div>
        </section>

        <section class="asset-editor-section">
          <h3>Local Draft</h3>
          <div class="asset-editor-small" id="editor-last-saved">Last saved: never</div>
          <div class="asset-editor-actions">
            <button id="editor-save-draft">Save Local Draft</button>
            <button id="editor-load-draft">Load Local Draft</button>
            <button id="editor-clear-draft" class="danger">Clear Local Draft</button>
          </div>
        </section>

        <section class="asset-editor-section">
          <h3>Manifest</h3>
          <div class="asset-editor-actions">
            <button id="editor-export-manifest">Export Asset Manifest JSON</button>
            <button id="editor-copy-manifest">Copy Manifest</button>
          </div>
          <label>Import / Export Manifest JSON <textarea id="editor-manifest-text"></textarea></label>
          <div class="asset-editor-actions"><button id="editor-apply-manifest">Apply Imported Manifest</button></div>
        </section>

        <section class="asset-editor-section">
          <h3>Diagnostics</h3>
          <div class="asset-editor-small" id="editor-counts">Textures: 0 / Models: 0 / Placements: 0 / Surface edits: 0</div>
          <div class="asset-editor-log" id="editor-log"></div>
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
    q('#editor-refresh-objects').addEventListener('click', () => this.callbacks.refreshObjects?.());
    q('#editor-object-select').addEventListener('change', (event) => this.callbacks.selectObject?.(event.target.value));
    q('#editor-highlight-toggle').addEventListener('change', (event) => this.callbacks.toggleHighlight?.(event.target.checked));
    q('#editor-texture-file').addEventListener('change', (event) => this.callbacks.importTexture?.(event.target.files?.[0]));
    q('#editor-texture-select').addEventListener('change', () => this.updateTexturePreview());
    q('#editor-apply-texture').addEventListener('click', () => this.callbacks.applyTexture?.());
    q('#editor-remove-texture').addEventListener('click', () => this.callbacks.removeTexture?.());
    q('#editor-update-texture-settings').addEventListener('click', () => this.callbacks.updateTextureSettings?.());
    q('#editor-reset-texture-settings').addEventListener('click', () => this.callbacks.resetTextureSettings?.());
    q('#editor-model-file').addEventListener('change', (event) => this.callbacks.importModel?.(event.target.files?.[0]));
    q('#editor-place-model').addEventListener('click', () => this.callbacks.placeModel?.());
    q('#editor-duplicate-model').addEventListener('click', () => this.callbacks.duplicateModel?.());
    q('#editor-delete-model').addEventListener('click', () => this.callbacks.deleteModel?.());
    q('#editor-apply-transform').addEventListener('click', () => this.callbacks.applyTransform?.());
    q('#editor-reset-transform').addEventListener('click', () => this.callbacks.resetTransform?.());
    q('#editor-move-to-player').addEventListener('click', () => this.callbacks.moveToPlayer?.());
    q('#editor-save-draft').addEventListener('click', () => this.callbacks.saveDraft?.());
    q('#editor-load-draft').addEventListener('click', () => this.callbacks.loadDraft?.());
    q('#editor-clear-draft').addEventListener('click', () => this.callbacks.clearDraft?.());
    q('#editor-export-manifest').addEventListener('click', () => this.callbacks.exportManifest?.());
    q('#editor-copy-manifest').addEventListener('click', () => this.callbacks.copyManifest?.());
    q('#editor-apply-manifest').addEventListener('click', () => this.callbacks.applyManifest?.());
  }

  showEditor(show) {
    this.panel.classList.toggle('hidden', !show);
  }

  setUnlocked(unlocked) {
    this.unlock.classList.toggle('hidden', unlocked);
    this.showEditor(unlocked);
  }

  setMapSummary(text) {
    this.root.querySelector('#editor-map-summary').textContent = text;
  }

  setObjectOptions(objects, selectedId) {
    const select = this.root.querySelector('#editor-object-select');
    select.innerHTML = `<option value="">None</option>${objects.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} (${escapeHtml(item.type)})</option>`).join('')}`;
    select.value = selectedId || '';
  }

  setTextureOptions(textures) {
    const select = this.root.querySelector('#editor-texture-select');
    const current = select.value;
    select.innerHTML = `<option value="">Select texture</option>${textures.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}`;
    if (textures.some((item) => item.id === current)) select.value = current;
    this.updateTexturePreview();
  }

  setModelOptions(models) {
    const select = this.root.querySelector('#editor-model-select');
    const current = select.value;
    select.innerHTML = `<option value="">Select model</option>${models.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}`;
    if (models.some((item) => item.id === current)) select.value = current;
  }

  selectedObjectId() { return this.root.querySelector('#editor-object-select').value; }
  selectedTextureId() { return this.root.querySelector('#editor-texture-select').value; }
  selectedModelId() { return this.root.querySelector('#editor-model-select').value; }
  manifestText() { return this.root.querySelector('#editor-manifest-text').value; }
  setManifestText(text) { this.root.querySelector('#editor-manifest-text').value = text; }

  textureSettings() {
    return {
      repeat: { x: Number(this.root.querySelector('#editor-repeat-x').value), y: Number(this.root.querySelector('#editor-repeat-y').value) },
      offset: { x: Number(this.root.querySelector('#editor-offset-x').value), y: Number(this.root.querySelector('#editor-offset-y').value) },
      rotation: Number(this.root.querySelector('#editor-rotation').value) * Math.PI / 180
    };
  }

  setTextureSettings(settings) {
    this.root.querySelector('#editor-repeat-x').value = settings?.repeat?.x ?? 1;
    this.root.querySelector('#editor-repeat-y').value = settings?.repeat?.y ?? 1;
    this.root.querySelector('#editor-offset-x').value = settings?.offset?.x ?? 0;
    this.root.querySelector('#editor-offset-y').value = settings?.offset?.y ?? 0;
    this.root.querySelector('#editor-rotation').value = settings?.rotation ? Math.round(settings.rotation * 180 / Math.PI) : 0;
  }

  transformValues() {
    const deg = Math.PI / 180;
    const uniform = Math.max(0.001, Number(this.root.querySelector('#editor-uniform-scale').value) || 1);
    return {
      position: {
        x: Number(this.root.querySelector('#editor-pos-x').value),
        y: Number(this.root.querySelector('#editor-pos-y').value),
        z: Number(this.root.querySelector('#editor-pos-z').value)
      },
      rotation: {
        x: Number(this.root.querySelector('#editor-rot-x').value) * deg,
        y: Number(this.root.querySelector('#editor-rot-y').value) * deg,
        z: Number(this.root.querySelector('#editor-rot-z').value) * deg
      },
      scale: {
        x: Math.max(0.001, Number(this.root.querySelector('#editor-scale-x').value) || 1) * uniform,
        y: Math.max(0.001, Number(this.root.querySelector('#editor-scale-y').value) || 1) * uniform,
        z: Math.max(0.001, Number(this.root.querySelector('#editor-scale-z').value) || 1) * uniform
      }
    };
  }

  setTransformValues(transform) {
    const radToDeg = 180 / Math.PI;
    this.root.querySelector('#editor-pos-x').value = transform?.position?.x ?? 0;
    this.root.querySelector('#editor-pos-y').value = transform?.position?.y ?? 0;
    this.root.querySelector('#editor-pos-z').value = transform?.position?.z ?? 0;
    this.root.querySelector('#editor-uniform-scale').value = 1;
    this.root.querySelector('#editor-rot-x').value = Math.round((transform?.rotation?.x || 0) * radToDeg);
    this.root.querySelector('#editor-rot-y').value = Math.round((transform?.rotation?.y || 0) * radToDeg);
    this.root.querySelector('#editor-rot-z').value = Math.round((transform?.rotation?.z || 0) * radToDeg);
    this.root.querySelector('#editor-scale-x').value = transform?.scale?.x ?? 1;
    this.root.querySelector('#editor-scale-y').value = transform?.scale?.y ?? 1;
    this.root.querySelector('#editor-scale-z').value = transform?.scale?.z ?? 1;
  }

  setSelectedInfo(meta) {
    this.root.querySelector('#editor-selected-info').textContent = meta
      ? `Selected: ${meta.id} / ${meta.type} / ${meta.mapId || 'map'} / ${meta.floor || 'floor'} / ${meta.zone || 'zone'}`
      : 'Selected: none';
  }

  setLastSaved(timestamp) {
    this.root.querySelector('#editor-last-saved').textContent = `Last saved: ${timestamp ? new Date(timestamp).toLocaleString() : 'never'}`;
  }

  setCounts({ textures, models, placements, surfaceEdits }) {
    this.root.querySelector('#editor-counts').textContent = `Textures: ${textures} / Models: ${models} / Placements: ${placements} / Surface edits: ${surfaceEdits}`;
  }

  log(lines) {
    this.root.querySelector('#editor-log').textContent = lines.join('\n');
  }

  updateTexturePreview() {
    const texture = this.callbacks.getTexture?.(this.selectedTextureId());
    this.root.querySelector('#editor-texture-preview').src = texture?.temporaryLocalUrl || '';
  }
}
