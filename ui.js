export class GameUI {
  constructor(audioSystem) {
    this.audio = audioSystem;
    this.root = document.getElementById('ui-container');
    this.onRefreshPublic = null;
    this.onCreatePublic = null;
    this.onCreatePrivate = null;
    this.onJoinPublic = null;
    this.onJoinPrivate = null;
    this.onStartGame = null;
    this.onEnterVR = null;
    this.onStartNextRound = null;
    this.onLeaveLobby = null;
    this.onCloseServerMenu = null;
    this.onKick = null;
    this.onBan = null;
    this.onMapSelected = null;
    this.muted = false;
    this.root.innerHTML = `
      <section id="main-menu" class="panel lobby menu-panel">
        <div class="eyebrow">REAL PLAYER MULTIPLAYER HORROR</div>
        <h1>Rule Beast VR</h1>
        <p>No bots. The host starts with 2–4 real players; one connected player becomes the Monster.</p>
        <div class="menu-fields compact-fields">
          <label>Player Name <input id="player-name" maxlength="18" placeholder="Player 123" autocomplete="off"></label>
          <label>Private Code <span class="inline-join"><input id="private-code" maxlength="6" placeholder="ABC123" autocomplete="off"><button id="join-private">Join</button></span></label>
        </div>
        <div class="menu-actions two-up">
          <button id="create-public">Create Public Lobby</button>
          <button id="create-private">Create Private Lobby</button>
          <button id="enter-vr">Enter VR</button>
        </div>
        <div class="browser-head"><h3>Public Servers</h3><button id="refresh-public">Refresh</button></div>
        <div id="public-list" class="public-list"><div class="empty-row">No public lobbies loaded.</div></div>
        <p id="menu-message" class="hint">Type a name, join by private code, or create a public/private lobby.</p>
      </section>
      <section id="lobby" class="panel lobby hidden">
        <div class="eyebrow" id="lobby-state">Waiting For Players</div>
        <h2>Server</h2>
        <div class="lobby-meta">
          <div><strong>Type</strong><span id="lobby-type">Public</span></div>
          <div><strong>Players</strong><span id="player-count">1/4</span></div>
          <div id="code-wrap"><strong>Private Code</strong><span id="lobby-code">------</span></div>
        </div>
        <div class="settings-card">Max players: 4 · Rounds: 10 · Monster: Random real player · Map: Host selected · Puzzles: 5–10 per round</div>
        <label class="map-picker">Map <select id="lobby-map-select"></select></label>
        <div class="actions compact">
          <button id="copy-code">Copy Code</button>
          <button id="start-game">Start Game</button>
          <button id="leave-lobby">Leave Lobby</button>
        </div>
        <div id="presence-list" class="presence">Waiting…</div>
        <p id="start-condition" class="hint">Waiting for more players.</p>
      </section>
      <section id="hud" class="hud hidden">
        <div class="top-row">
          <div class="badge" id="role-badge">Role</div>
          <div class="round-box"><span id="round">Round 1 / 10</span><small id="ability">Abilities</small></div>
          <div class="badge" id="puzzles-left">Puzzles: 0</div>
        </div>
        <div id="objective" class="objective">Objective</div>
        <div id="prompt" class="prompt"></div>
        <div class="meter hidden"><span id="progress"></span></div>
        <div id="center-warning" class="center-warning"></div>
      </section>
      <section id="round-menu" class="panel lobby hidden">
        <div class="eyebrow">ROUND COMPLETE</div>
        <h2 id="round-menu-title">Between Rounds</h2>
        <p id="round-menu-copy">Players may join between rounds. Host controls the next round.</p>
        <label class="map-picker">Map <select id="round-map-select"></select></label>
        <div id="round-player-list" class="presence"></div>
        <div class="actions compact">
          <button id="start-next-round">Start Next Round</button>
          <button id="leave-round-server">Leave Server</button>
        </div>
      </section>
      <section id="server-menu" class="panel lobby hidden">
        <div class="eyebrow">SERVER MENU</div>
        <h2>Server</h2>
        <div class="lobby-meta">
          <div><strong>Type</strong><span id="server-type">Public</span></div>
          <div id="server-code-wrap"><strong>Private Code</strong><span id="server-code">------</span></div>
          <div><strong>Status</strong><span id="server-status">Lobby · 1/4</span></div>
        </div>
        <div id="server-player-list" class="presence"></div>
        <div class="actions compact">
          <button id="close-server-menu">Close</button>
          <button id="server-leave">Leave Server</button>
        </div>
      </section>
      <section id="end-screen" class="panel end hidden">
        <h2 id="end-title">Match Ended</h2>
        <p id="end-copy"></p>
        <button id="back-menu">Return to Main Menu</button>
      </section>`;

    this.mainMenu = this.root.querySelector('#main-menu');
    this.lobby = this.root.querySelector('#lobby');
    this.hud = this.root.querySelector('#hud');
    this.roundMenu = this.root.querySelector('#round-menu');
    this.serverMenu = this.root.querySelector('#server-menu');
    this.end = this.root.querySelector('#end-screen');
    this.presence = this.root.querySelector('#presence-list');
    this.prompt = this.root.querySelector('#prompt');
    this.warning = this.root.querySelector('#center-warning');
    this.menuMessage = this.root.querySelector('#menu-message');
    this.publicList = this.root.querySelector('#public-list');
    this.progressMeter = this.root.querySelector('.meter');
    this.mapSelects = [this.root.querySelector('#lobby-map-select'), this.root.querySelector('#round-map-select')];

    this.root.querySelector('#player-name').value = localStorage.getItem('ruleBeastName') || '';
    this.root.querySelector('#refresh-public').addEventListener('click', () => this.onRefreshPublic?.());
    this.root.querySelector('#create-public').addEventListener('click', async () => { await this.audio.unlock(); this.onCreatePublic?.(); });
    this.root.querySelector('#create-private').addEventListener('click', async () => { await this.audio.unlock(); this.onCreatePrivate?.(); });
    this.root.querySelector('#join-private').addEventListener('click', async () => { await this.audio.unlock(); this.onJoinPrivate?.(this.privateCode()); });
    this.root.querySelector('#enter-vr').addEventListener('click', async () => { await this.audio.unlock(); this.onEnterVR?.(); });
    this.root.querySelector('#start-game').addEventListener('click', () => this.onStartGame?.());
    this.root.querySelector('#leave-lobby').addEventListener('click', () => this.onLeaveLobby?.());
    this.root.querySelector('#copy-code').addEventListener('click', () => this.copyLobbyCode());
    this.root.querySelector('#start-next-round').addEventListener('click', () => this.onStartNextRound?.());
    this.root.querySelector('#leave-round-server').addEventListener('click', () => this.onLeaveLobby?.());
    this.root.querySelector('#close-server-menu').addEventListener('click', () => this.onCloseServerMenu?.());
    this.root.querySelector('#server-leave').addEventListener('click', () => this.onLeaveLobby?.());
    this.root.querySelector('#back-menu').addEventListener('click', () => this.showMain('Match ended. Create or join another lobby for a new generated map.'));
    this.mapSelects.forEach((select) => {
      select.addEventListener('change', () => this.onMapSelected?.(select.value));
    });
  }

  playerName() {
    const typed = this.root.querySelector('#player-name').value.trim();
    const fallback = `Player ${Math.floor(100 + Math.random() * 900)}`;
    const name = typed || localStorage.getItem('ruleBeastGeneratedName') || fallback;
    localStorage.setItem('ruleBeastGeneratedName', name);
    localStorage.setItem('ruleBeastName', typed);
    return name.slice(0, 18);
  }

  privateCode() { return this.root.querySelector('#private-code').value.trim().toUpperCase(); }
  setMenuMessage(message) { this.menuMessage.textContent = message; }

  setMapOptions(options, selectedId) {
    this.mapSelects.forEach((select) => {
      select.innerHTML = options.map((map) => `<option value="${map.id}">${map.name}</option>`).join('');
      select.value = selectedId;
    });
  }

  setMapSelection(selectedId, isHost) {
    this.mapSelects.forEach((select) => {
      select.value = selectedId;
      select.disabled = !isHost;
    });
  }

  setPublicLobbies(lobbies) {
    this.publicList.innerHTML = lobbies.length ? lobbies.map((lobby) => `
      <div class="public-row">
        <span><strong>Public Server</strong><small>Host: ${lobby.hostName}</small></span>
        <span>${lobby.count}/4</span>
        <span>${lobby.state}</span>
        <button data-join-public="${lobby.id}" data-host-id="${lobby.hostId || ''}" data-host-name="${lobby.hostName || 'Host'}" ${lobby.joinable ? '' : 'disabled'}>Join</button>
      </div>`).join('') : '<div class="empty-row">No joinable public lobbies found.</div>';
    this.publicList.querySelectorAll('[data-join-public]').forEach((button) => {
      button.addEventListener('click', () => this.onJoinPublic?.(button.getAttribute('data-join-public'), {
        hostId: button.getAttribute('data-host-id'),
        hostName: button.getAttribute('data-host-name')
      }));
    });
  }

  async copyLobbyCode() {
    const code = this.root.querySelector('#lobby-code').textContent;
    try { await navigator.clipboard.writeText(code); this.flash(`Copied lobby code ${code}`); }
    catch { this.flash('Copy unavailable. Read the code from the lobby screen.'); }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
  }

  showMain(message = '') {
    this.mainMenu.classList.remove('hidden');
    this.lobby.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.roundMenu.classList.add('hidden');
    this.serverMenu.classList.add('hidden');
    this.end.classList.add('hidden');
    if (message) this.setMenuMessage(message);
  }

  setLobby(state) {
    this.mainMenu.classList.add('hidden');
    this.lobby.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.roundMenu.classList.add('hidden');
    this.serverMenu.classList.add('hidden');
    this.end.classList.add('hidden');
    this.root.querySelector('#lobby-state').textContent = state.state;
    this.root.querySelector('#lobby-type').textContent = state.type;
    this.root.querySelector('#player-count').textContent = `${state.players.length}/4`;
    this.root.querySelector('#code-wrap').classList.toggle('hidden', state.type !== 'Private');
    this.root.querySelector('#lobby-code').textContent = state.code || '------';
    this.root.querySelector('#copy-code').classList.toggle('hidden', state.type !== 'Private');
    this.root.querySelector('#start-game').classList.toggle('hidden', !state.isHost);
    this.root.querySelector('#start-game').disabled = !state.canStart;
    this.setMapSelection(state.mapId, state.isHost);
    this.presence.innerHTML = state.players.map((p) => `
      <div class="player-row ${p.self ? 'self' : ''}">
        <span>${p.host ? '👑 ' : ''}${p.name}${p.self ? ' (you)' : ''}</span>
        <span>${p.host ? 'Host' : 'Player'}</span>
        <span class="host-actions ${state.isHost && !p.host ? '' : 'hidden'}">
          <button data-kick="${p.id}">Kick</button><button data-ban="${p.id}">Ban</button>
        </span>
      </div>`).join('');
    this.presence.querySelectorAll('[data-kick]').forEach((button) => button.addEventListener('click', () => this.onKick?.(button.getAttribute('data-kick'))));
    this.presence.querySelectorAll('[data-ban]').forEach((button) => button.addEventListener('click', () => this.onBan?.(button.getAttribute('data-ban'))));
    this.root.querySelector('#start-condition').textContent = state.condition;
  }

  showGame() {
    this.mainMenu.classList.add('hidden');
    this.lobby.classList.add('hidden');
    this.roundMenu.classList.add('hidden');
    this.serverMenu.classList.add('hidden');
    this.end.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  showRoundMenu(state) {
    this.mainMenu.classList.add('hidden');
    this.lobby.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.serverMenu.classList.add('hidden');
    this.end.classList.add('hidden');
    this.roundMenu.classList.remove('hidden');
    this.root.querySelector('#round-menu-title').textContent = `Round ${state.roundCompleted} Complete`;
    this.root.querySelector('#round-menu-copy').textContent = state.isHost
      ? 'Host controls the next round. Players can join while the match is between rounds.'
      : `${state.players.length} players are in the server. You can wait or leave the server.`;
    this.root.querySelector('#start-next-round').textContent = state.roundCompleted > 0 ? 'Next Round' : 'Start Game';
    this.root.querySelector('#start-next-round').classList.toggle('hidden', !state.isHost);
    this.setMapSelection(state.mapId, state.isHost);
    this.root.querySelector('#round-player-list').innerHTML = state.players.map((p) => `
      <div class="player-row ${p.self ? 'self' : ''}">
        <span>${p.host ? '👑 ' : ''}${p.name}${p.self ? ' (you)' : ''}</span>
        <span>${p.alive === false ? 'Dead' : p.role || 'Player'}</span>
        <span class="host-actions ${state.isHost && !p.host ? '' : 'hidden'}"><button data-round-kick="${p.id}">Kick</button></span>
      </div>`).join('');
    this.root.querySelectorAll('[data-round-kick]').forEach((button) => button.addEventListener('click', () => this.onKick?.(button.getAttribute('data-round-kick'))));
  }

  showServerMenu(state) {
    this.mainMenu.classList.add('hidden');
    this.lobby.classList.add('hidden');
    this.roundMenu.classList.add('hidden');
    this.end.classList.add('hidden');
    this.hud.classList.toggle('hidden', !state.inMatch);
    this.serverMenu.classList.remove('hidden');
    this.root.querySelector('#server-type').textContent = state.type;
    this.root.querySelector('#server-code-wrap').classList.toggle('hidden', state.type !== 'Private');
    this.root.querySelector('#server-code').textContent = state.code || '------';
    this.root.querySelector('#server-status').textContent = `${state.statusLabel} · ${state.players.length}/4`;
    this.root.querySelector('#server-player-list').innerHTML = state.players.map((p) => `
      <div class="player-row ${p.self ? 'self' : ''}">
        <span>${p.host ? '👑 ' : ''}${p.name}${p.self ? ' (you)' : ''}</span>
        <span>${p.alive === false ? 'Dead' : p.role || 'Player'}</span>
        <span>${p.host ? 'Host' : p.connected === false ? 'Offline' : 'Connected'}</span>
      </div>`).join('');
  }

  update(state) {
    this.root.querySelector('#role-badge').textContent = state.role === 'monster' ? 'YOU ARE THE MONSTER' : state.dead ? 'DEAD — SPECTATING' : 'YOU ARE A SURVIVOR';
    this.root.querySelector('#role-badge').className = `badge ${state.role}`;
    this.root.querySelector('#round').textContent = `Round ${state.round} / 10`;
    this.root.querySelector('#ability').textContent = state.abilities;
    this.root.querySelector('#puzzles-left').textContent = `Puzzles: ${state.puzzlesRemaining}`;
    this.root.querySelector('#objective').textContent = state.objective;
    this.root.querySelector('#progress').style.width = `${Math.round(state.progress * 100)}%`;
    this.progressMeter.classList.toggle('hidden', !(state.role === 'survivor' && !state.dead && state.progress > 0));
    this.prompt.textContent = state.prompt || '';
    this.warning.textContent = state.warning || '';
  }

  endMatch(winner, copy) {
    this.mainMenu.classList.add('hidden');
    this.lobby.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.end.classList.remove('hidden');
    this.root.querySelector('#end-title').textContent = winner === 'survivors' ? 'Survivors Win' : 'Monster Wins';
    this.root.querySelector('#end-copy').textContent = copy;
  }

  flash(message) {
    this.warning.textContent = message;
    this.menuMessage.textContent = message;
    setTimeout(() => { if (this.warning.textContent === message) this.warning.textContent = ''; }, 1800);
  }
}
