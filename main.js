import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { init } from '@instantdb/core';
import { INSTANT_DB_APP_ID } from './instant_db_config.js';
import { PlayerController, FirstPersonCameraController } from './rosie/controls/rosieControls.js';
import { AudioSystem } from './audio.js';
import { GameUI } from './ui.js';
import { initAssetEditor } from './editor/assetEditor.js';
import { applyPermanentEditorOverrides, clearPermanentEditorOverrides, getPermanentEditorCollisionColliders, updatePermanentEditorOverrides } from './editor/editorOverrides.js';
import { MONSTER_ABILITY_POOL, PUZZLE_TYPES, TUNING, LOBBY_STATES } from './data.js';
import { DEFAULT_MAP_ID, MAP_OPTIONS, createBlankMapMakerLayout } from './maps.js';
import {
  createMaterials,
  createWorld,
  clearWorld,
  generateMapLayout,
  createPlayerModel,
  createLocalHands,
  createPuzzleStations,
  clearPuzzles,
  createRemoteMarker,
  updatePuzzleLabel,
  setPuzzleActive,
  markPuzzleSolved,
  makeCorpse,
  distance3D
} from './entities.js';

const container = document.getElementById('game-container') || document.body;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);
if (navigator.xr) document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
const BASE_FOG_DENSITY = 0.034;
const DEFAULT_LIGHTING = {
  fogColor: 0x060914,
  fogDensity: BASE_FOG_DENSITY,
  ambientIntensity: 0.34,
  hemiIntensity: 0.5,
  keyIntensity: 0.78
};
scene.background = new THREE.Color(DEFAULT_LIGHTING.fogColor);
scene.fog = new THREE.FogExp2(DEFAULT_LIGHTING.fogColor, BASE_FOG_DENSITY);
const ambient = new THREE.AmbientLight(0xcfe4ff, DEFAULT_LIGHTING.ambientIntensity);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xbfdcff, 0x08020a, DEFAULT_LIGHTING.hemiIntensity);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xcbdcff, DEFAULT_LIGHTING.keyIntensity);
key.position.set(-8, 12, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const editorBoost = new THREE.HemisphereLight(0xe8fbff, 0x19101e, 0);
scene.add(editorBoost);

const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 90);
scene.add(camera);
const timer = new THREE.Timer();
const materials = createMaterials();
const audio = new AudioSystem();
const ui = new GameUI(audio);
let availableMapOptions = [...MAP_OPTIONS];
ui.setMapOptions(availableMapOptions, DEFAULT_MAP_ID);
const db = init({ appId: INSTANT_DB_APP_ID });

const myId = `player_${Math.random().toString(36).slice(2, 8)}`;
let myName = ui.playerName();
const INTERACT_KEY = 'KeyE';
// Prototype-only local unlock. This is not real security and does not grant upload/cloud access.
const EDITOR_ADMIN_CODE = 'edit';
const keys = new Set();
const remoteMarkers = new Map();
const vrControllers = [];
const vrMenuItems = [];
const vrMoveInput = new THREE.Vector2();
const vrPointerRaycaster = new THREE.Raycaster();
const vrPointerMatrix = new THREE.Matrix4();
const vrMenuGroup = new THREE.Group();
let vrMenuSignature = '';
scene.add(vrMenuGroup);
const joinAttempts = new Map();
const banList = new Set();
let directoryRoom = null;
let room = null;
let lobby = null;
let game = null;
let selectedMapId = DEFAULT_MAP_ID;
let world = null;
let currentLayout = null;
let mapMakerMode = false;
let mapMakerSession = null;
let puzzles = [];
let colliders = [];
let interactables = { doors: [], roomLabels: [], stairs: [] };
let playerModel = createPlayerModel('survivor');
let localHands = createLocalHands(camera, materials);
localHands.visible = false;
scene.add(playerModel);
let controller = new PlayerController(playerModel, { moveSpeed: TUNING.survivorSpeed, jumpSpeed: 0, groundLevel: 0, cameraMode: 'first-person', rotateToMovement: false, mobileControls: false });
let fpCamera = new FirstPersonCameraController(camera, playerModel, renderer.domElement, { enabled: false, eyeHeight: 1.55, mouseSensitivity: 0.0022 });
let assetEditor = null;
let currentBaseFogDensity = BASE_FOG_DENSITY;

function setControllerGroundLevel(y = 0) {
  controller.groundLevel = y;
  if (controller.velocity) controller.velocity.y = 0;
}

function applyMapLighting(layout = {}) {
  const lighting = { ...DEFAULT_LIGHTING, ...(layout.lighting || {}) };
  currentBaseFogDensity = lighting.fogDensity;
  scene.background.setHex(lighting.fogColor);
  if (scene.fog) {
    scene.fog.color.setHex(lighting.fogColor);
    scene.fog.density = lighting.fogDensity;
  }
  ambient.intensity = lighting.ambientIntensity;
  hemi.intensity = lighting.hemiIntensity;
  key.intensity = lighting.keyIntensity;
}

function setEditorBrightnessBoost(enabled) {
  editorBoost.intensity = enabled ? 0.42 : 0;
}

function setupVRControllers() {
  if (!navigator.xr) return;
  for (let i = 0; i < 2; i += 1) {
    const grip = renderer.xr.getControllerGrip(i);
    const controllerObject = renderer.xr.getController(i);
    const beam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1.8)]),
      new THREE.LineBasicMaterial({ color: i === 0 ? 0x66f7ff : 0xff3159, transparent: true, opacity: 0.75 })
    );
    beam.name = 'vr-action-beam';
    beam.visible = false;
    controllerObject.add(beam);
    controllerObject.addEventListener('selectstart', () => {
      audio.unlock();
      if (isAnyMenuOpen()) selectVRMenuItem(controllerObject);
    });
    controllerObject.addEventListener('squeezestart', () => {
      audio.unlock();
    });
    controllerObject.addEventListener('squeezeend', () => {});
    scene.add(controllerObject, grip);
    vrControllers.push({ controller: controllerObject, grip, previousPrimary: false, previousSecondary: false, previousAxisY: 0 });
  }
}
setupVRControllers();

function updateLocalHandVisibility() {
  const visible = renderer.xr.isPresenting && !isAnyMenuOpen() && Boolean(game?.local?.alive);
  if (localHands) localHands.visible = visible;
}

renderer.xr.addEventListener('sessionstart', () => {
  updateLocalHandVisibility();
  refreshVRMenu();
});
renderer.xr.addEventListener('sessionend', () => {
  updateLocalHandVisibility();
  refreshVRMenu();
});

function resizeRenderer() {
  if (renderer.xr.isPresenting) return;
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeRenderer);
resizeRenderer();

assetEditor = initAssetEditor({
  scene,
  camera,
  renderer,
  adminCode: EDITOR_ADMIN_CODE,
  getCurrentMapId: () => selectedMapId,
  getCurrentMapName: () => mapMakerSession?.displayName || availableMapOptions.find((map) => map.id === selectedMapId)?.name || selectedMapId,
  getCurrentMapLayout: () => currentLayout,
  getPlayerPosition: () => playerModel.position.clone(),
  onEditorModeChange: handleEditorModeChange
});

function handleEditorModeChange(enabled) {
  setEditorBrightnessBoost(enabled);
  if (!enabled && mapMakerMode) exitMapMaker();
}

function isInteractKey(event) {
  return event.code === INTERACT_KEY || event.key?.toLowerCase() === 'e';
}

document.addEventListener('keydown', (event) => {
  if (assetEditor?.handleEditorKeyboard?.(event, true)) return;
  if (event.code === 'Escape') { toggleServerMenu(); return; }
  keys.add(isInteractKey(event) ? INTERACT_KEY : event.code);
  if (isInteractKey(event) && !event.repeat) handleInteractTap();
  if (event.code === 'KeyF' || event.code === 'Space') tryAttack();
  if (event.code === 'KeyQ') activateSelectedAbility();
  if (event.code === 'KeyR') cycleAbility(1);
});
document.addEventListener('keyup', (event) => {
  if (assetEditor?.handleEditorKeyboard?.(event, false)) return;
  keys.delete(isInteractKey(event) ? INTERACT_KEY : event.code);
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (event.button === 0) tryAttack();
});

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makePublicId() {
  return `PUBLIC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)}`;
}

function lobbyRoomId(type, keyValue) {
  return type === 'Private' ? `PRIVATE-${keyValue}` : keyValue;
}

function connectedPlayers() {
  return (lobby?.players || []).filter((p) => p.connected !== false).slice(0, TUNING.maxPlayers);
}

function isHost() {
  return lobby?.hostId === myId;
}

function canStart() {
  const players = connectedPlayers();
  return Boolean(lobby && isHost() && lobby.state === LOBBY_STATES.WAITING && players.length >= 2 && players.length <= 4);
}

function lobbyConditionText() {
  if (!lobby) return '';
  const players = connectedPlayers();
  if (players.length < 2) return 'Waiting for more players.';
  if (!isHost()) return 'Waiting for host to start the game.';
  return canStart() ? 'Host can start the game.' : 'Start requirements not met.';
}

function validMapId(mapId) {
  return availableMapOptions.some((map) => map.id === mapId) ? mapId : DEFAULT_MAP_ID;
}

function setSelectedMap(mapId, publish = true) {
  selectedMapId = validMapId(mapId);
  if (lobby) lobby.mapId = selectedMapId;
  ui.setMapSelection(selectedMapId, isHost());
  if (publish) publishLobbyPresence();
  refreshVRMenu();
}

function isAnyMenuOpen() {
  return !ui.mainMenu.classList.contains('hidden') || !ui.mapMakerSetup.classList.contains('hidden') || !ui.lobby.classList.contains('hidden') || !ui.roundMenu.classList.contains('hidden') || !ui.serverMenu.classList.contains('hidden') || !ui.end.classList.contains('hidden');
}

function makeTextTexture(text, width = 1024, height = 160, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = options.background || 'rgba(3, 8, 16, 0.92)';
  ctx.fillRect(0, 0, width, height);
  if (options.border) {
    ctx.strokeStyle = options.border;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);
  }
  ctx.fillStyle = options.color || '#d8fbff';
  ctx.font = `${options.weight || '700'} ${options.size || 54}px Orbitron, sans-serif`;
  ctx.textAlign = options.align || 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n').slice(0, 4);
  const lineHeight = options.lineHeight || (options.size || 54) * 1.18;
  lines.forEach((line, index) => ctx.fillText(line, options.align === 'left' ? 42 : width / 2, height / 2 + (index - (lines.length - 1) / 2) * lineHeight));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addVRTextButton(label, position, size, action, options = {}) {
  const material = new THREE.MeshBasicMaterial({ map: makeTextTexture(label, 1024, 220, { border: '#4df4ff', color: options.color || '#d8fbff', size: options.size || 52 }), transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
  mesh.position.copy(position);
  mesh.userData.vrAction = action;
  mesh.userData.defaultScale = mesh.scale.clone();
  mesh.userData.label = label;
  vrMenuGroup.add(mesh);
  vrMenuItems.push(mesh);
  return mesh;
}

function getVRMenuState() {
  if (!renderer.xr.isPresenting || !isAnyMenuOpen()) return null;
  const state = { title: 'Rule Beast VR', buttons: [], playerLines: '' };
  if (!ui.mainMenu.classList.contains('hidden')) {
    state.title = 'Rule Beast VR\nMain Menu';
    state.buttons.push(['Enter VR', () => ui.onEnterVR?.()]);
    state.buttons.push(['Create Public', () => ui.onCreatePublic?.()]);
    state.buttons.push(['Create Private', () => ui.onCreatePrivate?.()]);
    state.buttons.push(['Refresh Servers', () => ui.onRefreshPublic?.()]);
    if (ui.privateCode()) state.buttons.push([`Join ${ui.privateCode()}`, () => ui.onJoinPrivate?.(ui.privateCode())]);
    const publicEntries = Array.from(ui.publicList.querySelectorAll('[data-join-public]')).slice(0, 3);
    publicEntries.forEach((button) => {
      const hostName = button.getAttribute('data-host-name') || 'Host';
      const lobbyId = button.getAttribute('data-join-public');
      state.buttons.push([`Join ${hostName}`, () => ui.onJoinPublic?.(lobbyId, { hostId: button.getAttribute('data-host-id'), hostName })]);
    });
  } else if (!ui.lobby.classList.contains('hidden')) {
    state.title = `${lobby?.type || 'Server'} Lobby${lobby?.type === 'Private' ? `\nCode ${lobby.code}` : ''}`;
    if (isHost()) state.buttons.push(['Start Game', () => ui.onStartGame?.()]);
    state.buttons.push(['Leave Server', () => ui.onLeaveLobby?.()]);
  } else if (!ui.roundMenu.classList.contains('hidden')) {
    state.title = `Round ${game?.round || 1} Complete`;
    if (isHost()) state.buttons.push(['Next Round', () => ui.onStartNextRound?.()]);
    state.buttons.push(['Leave Server', () => ui.onLeaveLobby?.()]);
  } else if (!ui.serverMenu.classList.contains('hidden')) {
    state.title = `${lobby?.type || 'Server'} Server${lobby?.type === 'Private' ? `\nCode ${lobby.code}` : ''}`;
    state.buttons.push(['Close Menu', () => ui.onCloseServerMenu?.()]);
    state.buttons.push(['Leave Server', () => ui.onLeaveLobby?.()]);
  } else if (!ui.end.classList.contains('hidden')) {
    state.title = 'Match Ended';
    state.buttons.push(['Main Menu', () => ui.showMain('Create or join another server.')]);
  }
  state.playerLines = (lobby || game)
    ? serverRows().slice(0, 4).map((p) => `${p.host ? '👑 ' : ''}${p.name}${p.self ? ' (you)' : ''}`).join('\n')
    : '';
  return state;
}

function rebuildVRMenu() {
  vrMenuItems.length = 0;
  vrMenuGroup.clear();
  vrMenuSignature = '';
  const menuState = getVRMenuState();
  if (!menuState) return;
  vrMenuSignature = JSON.stringify({
    title: menuState.title,
    buttons: menuState.buttons.map(([label]) => label),
    playerLines: menuState.playerLines
  });
  vrMenuGroup.visible = true;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
  forward.normalize();
  const yaw = Math.atan2(forward.x, forward.z);
  vrMenuGroup.position.copy(camera.position).addScaledVector(forward, 3.0);
  vrMenuGroup.position.y = Math.max(1.45, camera.position.y);
  vrMenuGroup.rotation.set(0, yaw + Math.PI, 0);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.65), new THREE.MeshBasicMaterial({ color: 0x030812, transparent: true, opacity: 0.88 }));
  panel.position.set(0, 0, -0.02);
  vrMenuGroup.add(panel);
  addVRTextButton(menuState.title, new THREE.Vector3(0, 0.86, 0.01), new THREE.Vector2(3.05, 0.52), null, { color: '#ff4967', size: 46 });
  const rows = menuState.buttons.slice(0, 7);
  rows.forEach(([label, action], index) => {
    const y = 0.46 - index * 0.28;
    addVRTextButton(label, new THREE.Vector3(0, y, 0.02), new THREE.Vector2(2.55, 0.22), action, { size: 42 });
  });
  if (menuState.playerLines) addVRTextButton(menuState.playerLines, new THREE.Vector3(0, -0.86, 0.015), new THREE.Vector2(2.8, 0.5), null, { size: 32, color: '#9dfbff' });
}

function updateVRMenuPointers() {
  const menuOpen = isAnyMenuOpen();
  vrMenuGroup.visible = renderer.xr.isPresenting && menuOpen;
  vrControllers.forEach(({ controller }) => {
    const beam = controller.getObjectByName('vr-action-beam');
    if (beam) beam.visible = renderer.xr.isPresenting && menuOpen;
  });
  if (!renderer.xr.isPresenting || !menuOpen) return;
  const menuState = getVRMenuState();
  const nextSignature = menuState ? JSON.stringify({
    title: menuState.title,
    buttons: menuState.buttons.map(([label]) => label),
    playerLines: menuState.playerLines
  }) : '';
  if (!vrMenuItems.length || nextSignature !== vrMenuSignature) rebuildVRMenu();
  vrMenuItems.forEach((item) => item.scale.copy(item.userData.defaultScale || new THREE.Vector3(1, 1, 1)));
  vrControllers.forEach(({ controller }) => {
    vrPointerMatrix.identity().extractRotation(controller.matrixWorld);
    vrPointerRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    vrPointerRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(vrPointerMatrix);
    const hit = vrPointerRaycaster.intersectObjects(vrMenuItems, false).find((item) => item.object.userData.vrAction);
    if (hit) hit.object.scale.setScalar(1.08);
  });
}

function selectVRMenuItem(controllerObject) {
  if (!renderer.xr.isPresenting || !isAnyMenuOpen()) return false;
  if (!vrMenuItems.length) rebuildVRMenu();
  vrPointerMatrix.identity().extractRotation(controllerObject.matrixWorld);
  vrPointerRaycaster.ray.origin.setFromMatrixPosition(controllerObject.matrixWorld);
  vrPointerRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(vrPointerMatrix);
  const hit = vrPointerRaycaster.intersectObjects(vrMenuItems, false).find((item) => item.object.userData.vrAction);
  if (!hit) return false;
  hit.object.userData.vrAction?.();
  vrMenuItems.length = 0;
  vrMenuGroup.clear();
  return true;
}

function refreshVRMenu() {
  vrMenuSignature = '';
  vrMenuItems.length = 0;
  vrMenuGroup.clear();
}

function setPreviewWorldVisible(visible) {
  world?.objects?.forEach((object) => { object.visible = visible; });
  puzzles?.forEach((puzzle) => { if (!visible) puzzle.group.visible = false; else setPuzzleActive(puzzle, puzzle.active); });
  playerModel.visible = visible || Boolean(game);
}

function updateVRMenuEnvironment() {
  const menuVoid = renderer.xr.isPresenting && isAnyMenuOpen() && !game;
  setPreviewWorldVisible(!menuVoid);
  if (menuVoid) scene.background.set(0x000000);
  else scene.background.set(0x03050a);
}

function presentLobby() {
  if (!lobby || (game && !game.ended)) return;
  if (lobby.state === LOBBY_STATES.IN_MATCH || lobby.state === LOBBY_STATES.INTERMISSION) return;
  const rows = connectedPlayers().map((p) => ({ ...p, self: p.id === myId, host: p.id === lobby.hostId }));
  ui.setLobby({
    ...lobby,
    players: rows,
    isHost: isHost(),
    canStart: canStart(),
    mapId: lobby.mapId || selectedMapId,
    condition: lobbyConditionText()
  });
  refreshServerMenuIfOpen();
  publishDirectory();
}

function getLocalYaw() {
  if (renderer.xr.isPresenting) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    return Math.atan2(-direction.x, -direction.z);
  }
  return fpCamera?.getYaw?.() ?? playerModel.rotation.y;
}

function publishLobbyPresence() {
  if (!room || !lobby) return;
  room.publishPresence({
    id: myId,
    name: myName,
    hostId: lobby.hostId,
    lobbyId: lobby.id,
    lobbyName: lobby.name,
    lobbyType: lobby.type,
    lobbyCode: lobby.code,
    lobbyState: lobby.state,
    monsterId: game?.monsterId || null,
    mapId: game?.waitingBetweenRounds ? selectedMapId : (game?.mapId || lobby?.mapId || selectedMapId),
    mapSeed: game?.mapSeed || null,
    matchPlayers: game?.players?.map((p) => ({ id: p.id, name: p.name, role: p.role, alive: p.alive, x: p.lastX, y: p.lastY, z: p.lastZ, yaw: p.lastYaw })) || null,
    roundState: game?.lastPublishedState || null,
    round: game?.round || 0,
    role: game?.local?.role || 'lobby',
    alive: game?.local?.alive ?? true,
    x: playerModel.position.x,
    y: playerModel.position.y,
    z: playerModel.position.z,
    yaw: getLocalYaw()
  });
}

function publishDirectory() {
  if (!directoryRoom || !lobby || !isHost() || lobby.type !== 'Public') return;
  const count = connectedPlayers().length;
  if (count <= 0) return;
  directoryRoom.publishPresence({
    id: lobby.id,
    hostId: myId,
    hostName: myName,
    name: lobby.name,
    type: 'Public',
    count,
    state: count >= 4 ? 'Full' : lobby.state,
    mapId: lobby.mapId || selectedMapId,
    joinable: count < 4 && (lobby.state === LOBBY_STATES.WAITING || lobby.state === LOBBY_STATES.INTERMISSION)
  });
}

function refreshPublicLobbies() {
  if (!directoryRoom) {
    directoryRoom = db.joinRoom('rule-beast-directory', 'public-lobbies');
    directoryRoom.subscribePresence({}, ({ user, peers }) => {
      const entriesById = new Map();
      const collect = (entry) => {
        if (!entry || entry.type !== 'Public' || entry.state === LOBBY_STATES.CLOSED) return;
        if (entry.state === LOBBY_STATES.IN_MATCH || entry.count >= TUNING.maxPlayers || !entry.joinable) return;
        entriesById.set(entry.id, { id: entry.id, name: entry.name || `${entry.hostName}'s Lobby`, hostId: entry.hostId || '', hostName: entry.hostName || 'Host', count: entry.count || 1, state: entry.state || 'Waiting', joinable: Boolean(entry.joinable) });
      };
      collect(user);
      Object.values(peers || {}).forEach(collect);
      ui.setPublicLobbies([...entriesById.values()]);
    });
  }
}

function leaveCurrentRoomSilently() {
  if (!room || !lobby) return;
  room.publishPresence({ id: myId, name: myName, hostId: lobby.hostId, lobbyId: lobby.id, lobbyState: LOBBY_STATES.CLOSED, connected: false, role: 'left' });
}

function joinLobbyObject(type, roomKey, options = {}) {
  myName = ui.playerName();
  leaveCurrentRoomSilently();
  game = null;
  remoteMarkers.forEach((entry) => scene.remove(entry.object));
  remoteMarkers.clear();
  const code = type === 'Private' ? roomKey : '';
  lobby = {
    id: roomKey,
    name: options.name || `${myName}'s ${type} Lobby`,
    type,
    code,
    state: LOBBY_STATES.WAITING,
    hostId: options.hostId === null ? '' : (options.hostId || myId),
    mapId: selectedMapId,
    players: [{ id: myId, name: myName, connected: true }]
  };
  room = db.joinRoom('rule-beast-vr', lobbyRoomId(type, roomKey));
  joinAttempts.set(roomKey, performance.now());
  ui.setLobby({ ...lobby, players: [{ id: myId, name: myName, connected: true, self: true, host: lobby.hostId === myId }], isHost: lobby.hostId === myId, canStart: false, mapId: selectedMapId, condition: lobby.hostId === myId ? 'Waiting for more players.' : 'Joining server…' });
  room.publishPresence({ id: myId, name: myName, hostId: lobby.hostId, lobbyId: lobby.id, lobbyName: lobby.name, lobbyType: type, lobbyCode: code, lobbyState: lobby.state, connected: true, role: 'lobby', alive: true, mapId: selectedMapId, x: playerModel.position.x, y: playerModel.position.y, z: playerModel.position.z, yaw: getLocalYaw() });
  room.subscribePresence({}, ({ user, peers }) => {
    if (!lobby) return;
    const peerValues = Object.values(peers || {});
    const allPresence = [user, ...peerValues].filter(Boolean);
    const advertisedHostId = allPresence.map((peer) => peer?.hostId).find(Boolean);
    if (!lobby.hostId && advertisedHostId) lobby.hostId = advertisedHostId;
    const hostPresence = allPresence.find((peer) => peer?.id === lobby.hostId) || allPresence.find((peer) => peer?.hostId && peer.hostId === lobby.hostId);
    if (hostPresence?.mapId && !isHost()) setSelectedMap(hostPresence.mapId, false);
    else if (isHost()) lobby.mapId = selectedMapId;
    const advertisedState = hostPresence?.lobbyState || allPresence.map((peer) => peer?.lobbyState).find((state) => state === LOBBY_STATES.IN_MATCH || state === LOBBY_STATES.INTERMISSION || state === LOBBY_STATES.ENDED);
    if (advertisedState && advertisedState !== LOBBY_STATES.CLOSED) lobby.state = advertisedState;
    const hostSnapshot = hostPresence?.mapSeed && hostPresence?.monsterId ? hostPresence : allPresence.find((peer) => peer?.hostId && peer.hostId === (lobby.hostId || peer.id) && peer?.mapSeed && peer?.monsterId);
    const list = [];
    const addPeer = (peerKey, peer, self = false) => {
      if (!peer || peer.kicked || peer.banned || peer.lobbyState === LOBBY_STATES.CLOSED || peer.connected === false) return;
      list.push({
        id: peer.id || peerKey,
        name: peer.name || 'Player',
        connected: true,
        self,
        peer,
        role: peer.role || game?.players.find((gp) => gp.id === (peer.id || peerKey))?.role || 'lobby',
        alive: peer.alive !== false,
        x: peer.x,
        y: peer.y,
        z: peer.z,
        yaw: peer.yaw,
        roundState: peer.roundState,
        mapId: peer.mapId,
        mapSeed: peer.mapSeed,
        monsterId: peer.monsterId
      });
    };
    addPeer(myId, user || { id: myId, name: myName, hostId: lobby.hostId }, true);
    Object.entries(peers || {}).forEach(([peerKey, peer]) => addPeer(peerKey, peer, false));
    if (isHost() && lobby.state === LOBBY_STATES.WAITING && list.length > TUNING.maxPlayers) {
      const overflow = list.slice(TUNING.maxPlayers);
      overflow.forEach((player) => room.publishTopic('lobby-event', { type: 'kicked', targetId: player.id, message: 'That lobby is full.' }));
    }
    lobby.players = list.slice(0, TUNING.maxPlayers);
    if (!lobby.players.some((p) => p.id === lobby.hostId)) {
      const elapsed = performance.now() - (joinAttempts.get(lobby.id) || 0);
      if (!isHost() && elapsed < 5000) {
        presentLobby();
        return;
      }
      if (lobby.state === LOBBY_STATES.IN_MATCH) endMatch('survivors', 'Host or monster disconnected. Match ended.');
      else {
        ui.showMain('Host left the lobby.');
        room?.publishPresence({ lobbyState: LOBBY_STATES.CLOSED, connected: false });
        lobby = null;
        return;
      }
    }
    if (isHost()) {
      const banned = list.find((p) => banList.has(p.id));
      if (banned) room.publishTopic('lobby-event', { type: 'banned', targetId: banned.id, message: 'You are banned from this lobby.' });
    }
    const otherPlayerCount = list.filter((p) => p.id !== myId).length;
    if (!isHost() && lobby.state === LOBBY_STATES.WAITING && otherPlayerCount >= TUNING.maxPlayers) {
      ui.showMain('That lobby is full.');
      room.publishPresence({ lobbyState: LOBBY_STATES.CLOSED, connected: false });
      lobby = null;
      return;
    }
    if (!game && advertisedState === LOBBY_STATES.IN_MATCH && hostSnapshot?.mapSeed && hostSnapshot?.monsterId && hostSnapshot.roundState) {
      startMatch({ ...hostSnapshot.roundState, players: hostSnapshot.matchPlayers || hostSnapshot.roundState.players, monsterId: hostSnapshot.monsterId, mapId: hostSnapshot.mapId || hostSnapshot.roundState.mapId, mapSeed: hostSnapshot.mapSeed, round: hostSnapshot.round || hostSnapshot.roundState.round });
    } else if (!game && advertisedState === LOBBY_STATES.INTERMISSION && hostSnapshot?.mapSeed && hostSnapshot?.monsterId) {
      if (otherPlayerCount >= TUNING.maxPlayers) {
        ui.showMain('That server is full.');
        room.publishPresence({ lobbyState: LOBBY_STATES.CLOSED, connected: false });
        lobby = null;
        return;
      }
      startMatch({
        players: hostSnapshot.matchPlayers || list.map((p) => ({ id: p.id, name: p.name })),
        monsterId: hostSnapshot.monsterId,
        mapId: hostSnapshot.mapId,
        mapSeed: hostSnapshot.mapSeed,
        round: hostSnapshot.round || 1,
        intermission: true
      });
    } else if (!game && advertisedState === LOBBY_STATES.IN_MATCH) {
      ui.showMain('That match is already in progress. Join again between rounds.');
      room.publishPresence({ lobbyState: LOBBY_STATES.CLOSED, connected: false });
      lobby = null;
      return;
    }
    updateRemoteMarkers(list);
    if (game && !game.ended) {
      const beforeCount = game.players.length;
      game.players = mergeLivePlayers(list);
      if (isHost() && game.waitingBetweenRounds && game.players.length !== beforeCount && game.lastPublishedState) {
        game.lastPublishedState.players = game.players.map((p) => ({ id: p.id, name: p.name, role: p.role, alive: p.alive }));
      }
      updateRemoteMarkers(list);
      refreshServerMenuIfOpen();
      if (game.waitingBetweenRounds) showRoundIntermission();
      return;
    }
    presentLobby();
  });
  room.subscribeTopic('lobby-event', (event) => handleLobbyEvent(event));
  publishLobbyPresence();
  presentLobby();
}

function handleLobbyEvent(event) {
  if (!event) return;
  if ((event.type === 'kicked' || event.type === 'banned') && event.targetId === myId) {
    room?.publishPresence({ kicked: true, banned: event.type === 'banned', lobbyState: LOBBY_STATES.CLOSED, connected: false });
    remoteMarkers.forEach((entry) => scene.remove(entry.object));
    remoteMarkers.clear();
    lobby = null;
    game = null;
    ui.showMain(event.message || (event.type === 'banned' ? 'You are banned from this lobby.' : 'You were kicked from the lobby.'));
    return;
  }
  if (event.type === 'match-start') {
    if (!game || game.ended) startMatch(event);
  }
  if (event.type === 'puzzle-solved') applyPuzzleSolved(event.puzzleId);
  if (event.type === 'round-complete') enterRoundIntermission(event.round);
  if (event.type === 'round-state') {
    if (!game && lobby && event.mapSeed && event.monsterId) startMatch({ ...event, intermission: false });
    else applyRoundState(event);
  }
  if (event.type === 'puzzle-progress') applyPuzzleProgress(event.puzzleId, event.progress);
  if (event.type === 'ability-used') handleAbilityWarning(event);
  if (event.type === 'player-killed') applyPlayerKilled(event.playerId);
  if (event.type === 'match-ended') endMatch(event.winner, event.message);
}

ui.onRefreshPublic = () => { refreshPublicLobbies(); refreshVRMenu(); };
ui.onEnterVR = async () => {
  if (!navigator.xr) {
    ui.flash('VR is not available in this browser.');
    return;
  }
  try {
    if (!renderer.xr.isPresenting) {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      await renderer.xr.setSession(session);
      refreshVRMenu();
    }
  } catch {
    ui.flash('Unable to enter VR.');
  }
};
ui.onCreatePublic = () => {
  refreshPublicLobbies();
  joinLobbyObject('Public', makePublicId());
};
ui.onCreatePrivate = () => joinLobbyObject('Private', makeCode());
ui.onJoinPublic = (lobbyId, meta = {}) => joinLobbyObject('Public', lobbyId, { hostId: meta.hostId || null, name: `${meta.hostName || 'Host'}'s Public Lobby` });
ui.onJoinPrivate = (code) => {
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    ui.setMenuMessage('Lobby not found.');
    return;
  }
  joinLobbyObject('Private', code, { hostId: null });
  setTimeout(() => {
    if (lobby && connectedPlayers().length <= 1 && !isHost()) ui.setMenuMessage('Lobby not found.');
  }, 1600);
};
ui.onOpenMapMaker = () => ui.showMapMakerSetup(availableMapOptions, selectedMapId);
ui.onCancelMapMaker = () => ui.showMain('Map Maker cancelled.');
ui.onCreateNewMap = ({ mapId, displayName }) => {
  const safeMapId = String(mapId || 'my_custom_map').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'my_custom_map';
  const safeName = String(displayName || safeMapId).trim() || safeMapId;
  enterMapMaker({ packageType: 'newMap', mapId: safeMapId, displayName: safeName });
};
ui.onEditExistingMap = (mapId) => {
  const safeMapId = validMapId(mapId || selectedMapId);
  const displayName = availableMapOptions.find((map) => map.id === safeMapId)?.name || safeMapId;
  enterMapMaker({ packageType: 'updateExistingMap', mapId: safeMapId, displayName });
};
ui.onStartNextRound = () => {
  if (!isHost() || !game?.waitingBetweenRounds) return;
  startNextRoundFromIntermission();
};
ui.onCloseServerMenu = () => closeServerMenu();
ui.onMapSelected = (mapId) => {
  if (!isHost()) return;
  setSelectedMap(mapId);
  presentLobby();
  if (game?.waitingBetweenRounds) showRoundIntermission();
};
ui.onStartGame = () => {
  if (!isHost()) { ui.flash('Only the host can start the game.'); return; }
  if (!canStart()) { ui.flash(lobbyConditionText()); return; }
  const players = connectedPlayers().map((p) => ({ id: p.id, name: p.name }));
  const monster = players[Math.floor(Math.random() * players.length)];
  if (!monster || players.length < 2) { ui.flash('Waiting for more players.'); return; }
  const matchSeed = Date.now() % 1000000;
  const mapSeed = Math.floor(Math.random() * 999999);
  const mapId = selectedMapId;
  room.publishTopic('lobby-event', { type: 'match-start', players, monsterId: monster.id, matchSeed, mapSeed, mapId });
  startMatch({ players, monsterId: monster.id, matchSeed, mapSeed, mapId });
};
ui.onKick = (targetId) => {
  if (!isHost()) return;
  room?.publishTopic('lobby-event', { type: 'kicked', targetId, message: 'You were kicked from the lobby.' });
};
ui.onBan = (targetId) => {
  if (!isHost()) return;
  banList.add(targetId);
  room?.publishTopic('lobby-event', { type: 'banned', targetId, message: 'You are banned from this lobby.' });
};
ui.onLeaveLobby = () => {
  if (lobby && isHost()) room?.publishTopic('lobby-event', { type: 'match-ended', winner: 'survivors', message: 'Host left the server.' });
  else if (game?.local?.role === 'monster') room?.publishTopic('lobby-event', { type: 'match-ended', winner: 'survivors', message: 'Monster left the server.' });
  else if (game?.local?.role === 'survivor') room?.publishTopic('lobby-event', { type: 'player-killed', playerId: myId, byId: 'disconnect' });
  room?.publishPresence({ lobbyState: LOBBY_STATES.CLOSED, connected: false });
  remoteMarkers.forEach((entry) => scene.remove(entry.object));
  remoteMarkers.clear();
  closeServerMenu();
  lobby = null;
  game = null;
  ui.showMain('Left server.');
};

function serverRows() {
  const live = connectedPlayers();
  const source = live.length ? live : (game?.players || []);
  return source.map((p) => {
    const gp = game?.players?.find((item) => item.id === p.id) || p;
    return { ...p, role: gp.role || p.role, alive: gp.alive, self: p.id === myId, host: p.id === lobby?.hostId };
  });
}

function openServerMenu() {
  if (!lobby) return;
  const inMatch = Boolean(game && !game.waitingBetweenRounds && !game.ended);
  const statusLabel = game?.waitingBetweenRounds ? 'Between Rounds' : inMatch ? `Round ${game.round}` : lobby.state || 'Lobby';
  ui.showServerMenu({ type: lobby.type, code: lobby.code, players: serverRows(), inMatch, statusLabel });
}

function refreshServerMenuIfOpen() {
  if (!lobby || !ui.serverMenu || ui.serverMenu.classList.contains('hidden')) return;
  openServerMenu();
}

function closeServerMenu() {
  if (!ui.serverMenu || ui.serverMenu.classList.contains('hidden')) return;
  ui.serverMenu.classList.add('hidden');
  if (game?.waitingBetweenRounds) showRoundIntermission();
  else if (game && !game.ended) ui.showGame();
  else if (lobby) presentLobby();
  else ui.showMain();
}

function toggleServerMenu() {
  if (!lobby) return;
  if (ui.serverMenu.classList.contains('hidden')) openServerMenu();
  else closeServerMenu();
}

function rebuildMap(seed, mapId = selectedMapId, layoutOverride = null) {
  clearPermanentEditorOverrides(scene);
  clearWorld(world);
  clearPuzzles(puzzles);
  const layout = layoutOverride || generateMapLayout(seed, mapId);
  selectedMapId = layout.id || validMapId(mapId);
  currentLayout = layout;
  applyMapLighting(layout);
  world = createWorld(scene, materials, layout);
  colliders = world.colliders;
  interactables = world.interactables;
  puzzles = createPuzzleStations(scene, materials, layout);
  assetEditor?.refreshObjects?.();
  applyPermanentEditorOverrides({ scene, mapId: selectedMapId })
    .then(() => assetEditor?.refreshObjects?.())
    .catch((error) => console.warn('[Rule Beast] editor override load failed:', error.message));
  return layout;
}

function ensureAvailableMapOption(mapId, name) {
  if (!availableMapOptions.some((map) => map.id === mapId)) {
    availableMapOptions = [...availableMapOptions, { id: mapId, name }];
    ui.setMapOptions(availableMapOptions, mapId);
  }
}

async function loadEditorMapIndex() {
  try {
    const response = await fetch('assets/editor_maps/index.json');
    if (response.status === 404) return;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const maps = Array.isArray(data.maps) ? data.maps : [];
    const next = [...availableMapOptions];
    maps.forEach((map) => {
      if (map?.id && !next.some((item) => item.id === map.id)) next.push({ id: map.id, name: map.name || map.id });
    });
    availableMapOptions = next;
    ui.setMapOptions(availableMapOptions, selectedMapId);
  } catch (error) {
    console.warn('[Rule Beast] editor map index skipped:', error.message);
  }
}

function enterMapMaker({ packageType, mapId, displayName }) {
  mapMakerMode = true;
  mapMakerSession = { packageType, mapId, displayName };
  game = null;
  lobby = null;
  selectedMapId = mapId;
  if (packageType === 'updateExistingMap') ensureAvailableMapOption(mapId, displayName);
  const seed = Date.now() % 1000000;
  const layout = packageType === 'newMap'
    ? createBlankMapMakerLayout(seed, mapId, displayName)
    : generateMapLayout(seed, mapId);
  rebuildMap(seed, mapId, layout);
  const spawn = layout.survivorSpawn || { x: 0, y: 0, z: 4 };
  playerModel.position.set(spawn.x || 0, spawn.y || 0, spawn.z || 4);
  playerModel.visible = true;
  setControllerGroundLevel(spawn.y || 0);
  controller.setEnabled(false);
  fpCamera.eyeHeight = 1.55;
  fpCamera.enable();
  ui.showMapMakerWorkspace(displayName);
  assetEditor?.startMapMakerSession?.({ packageType, mapId, displayName });
  refreshVRMenu();
}

function exitMapMaker() {
  mapMakerMode = false;
  mapMakerSession = null;
  fpCamera.disable();
  controller.setEnabled(false);
  selectedMapId = DEFAULT_MAP_ID;
  rebuildMap(12345, DEFAULT_MAP_ID);
  ui.setMapOptions(availableMapOptions, selectedMapId);
  ui.showMain('Map Maker closed. Export a Codex Package when you are ready to make changes permanent.');
  refreshVRMenu();
}

function placeLocalPlayerAtSpawn(layout) {
  if (!game) return;
  const survivorIndex = Math.max(0, game.players.filter((p) => p.id !== game.monsterId).findIndex((p) => p.id === myId));
  const survivorSpawns = layout.survivorSpawns?.length ? layout.survivorSpawns : [layout.survivorSpawn];
  const baseSpawn = game.local.role === 'monster' ? layout.monsterSpawn : survivorSpawns[survivorIndex % survivorSpawns.length];
  const spawn = game.local.role === 'monster' ? baseSpawn : { ...baseSpawn, x: baseSpawn.x + (survivorIndex % survivorSpawns.length) * 0.6 };
  playerModel.position.set(spawn.x, spawn.y || 0, spawn.z);
  setControllerGroundLevel(spawn.y || 0);
}

function startMatch(event) {
  let baseRoster = event?.players?.length ? event.players : connectedPlayers().map((p) => ({ id: p.id, name: p.name, role: p.role, alive: p.alive, x: p.x, y: p.y, z: p.z, yaw: p.yaw }));
  if (!lobby) return;
  if (!baseRoster || baseRoster.length < 2) return;
  if (!baseRoster.some((p) => p.id === event.monsterId)) return;
  const liveSnapshot = new Map(connectedPlayers().map((p) => [p.id, p]));
  baseRoster = baseRoster.map((p) => ({ ...p, ...(liveSnapshot.get(p.id) || {}) }));
  const roster = baseRoster.some((p) => p.id === myId) ? baseRoster : [...baseRoster, { id: myId, name: myName, role: 'survivor', alive: true, lateJoin: true }];
  const localRole = event.monsterId === myId ? 'monster' : 'survivor';
  lobby.state = event.intermission ? LOBBY_STATES.INTERMISSION : LOBBY_STATES.IN_MATCH;
  const mapId = validMapId(event.mapId || selectedMapId);
  const layout = rebuildMap(event.mapSeed || Date.now(), mapId);
  selectedMapId = mapId;
  if (lobby) lobby.mapId = mapId;
  fpCamera.disable();
  playerModel.clear();
  const fresh = createPlayerModel(localRole);
  fresh.children.slice().forEach((child) => playerModel.add(child));
  playerModel.visible = true;
  controller.setEnabled(true);
  controller.moveSpeed = localRole === 'monster' ? TUNING.monsterBaseSpeed : TUNING.survivorSpeed;
  fpCamera.eyeHeight = localRole === 'monster' ? 2.05 : 1.55;
  fpCamera.enable();
  game = {
    players: roster.map((p) => ({ ...p, role: p.role && p.role !== 'lobby' ? p.role : (p.id === event.monsterId ? 'monster' : 'survivor'), alive: p.alive !== false, lastX: Number.isFinite(p.x) ? p.x : undefined, lastY: Number.isFinite(p.y) ? p.y : undefined, lastZ: Number.isFinite(p.z) ? p.z : undefined, lastYaw: Number.isFinite(p.yaw) ? p.yaw : undefined })),
    local: { id: myId, name: myName, role: localRole, alive: roster.find((p) => p.id === myId)?.alive !== false, attackCooldown: 0, howlCooldown: 0 },
    monsterId: event.monsterId,
    mapId,
    mapSeed: event.mapSeed || Date.now(),
    round: event.round || 1,
    activePuzzles: [],
    monsterAbilities: [],
    abilityCooldowns: {},
    selectedAbilityIndex: 0,
    activeAbilityEffects: {},
    survivorDebuffs: {},
    availableAbilities: [...MONSTER_ABILITY_POOL],
    ended: false,
    interactHeld: 0,
    roundBannerTime: 4,
    countdown: 4,
    publishTimer: 0,
    activeInteractPuzzleId: null,
    waitingBetweenRounds: false,
    lastPublishedState: null
  };
  placeLocalPlayerAtSpawn(layout);
  controller.setEnabled(game.local.alive && !event.intermission);
  if (!game.local.alive) fpCamera.eyeHeight = 1.25;
  updateRemoteMarkers(connectedPlayers());
  if (event.intermission) {
    game.waitingBetweenRounds = true;
    showRoundIntermission(event.round || game.round);
  } else if (event.assignments) {
    applyRoundAssignments(event.assignments);
    game.lastPublishedState = { type: 'round-state', round: game.round, abilities: event.abilities || [], assignments: event.assignments, players: roundPlayerSnapshots(), monsterId: game.monsterId, mapId: game.mapId, mapSeed: game.mapSeed };
  } else if (isHost()) {
    const assignments = randomRoundAssignments();
    applyRoundAssignments(assignments);
    const players = roundPlayerSnapshots();
    const roundState = { type: 'round-state', round: 1, abilities: [], assignments, players, monsterId: game.monsterId, mapId: game.mapId, mapSeed: game.mapSeed };
    game.lastPublishedState = roundState;
    room?.publishTopic('lobby-event', roundState);
  }
  if (!event.intermission) ui.showGame();
  refreshServerMenuIfOpen();
  audio.play('round');
  publishLobbyPresence();
}

function randomRoundAssignments() {
  const desiredCount = TUNING.minPuzzlesPerRound + Math.floor(Math.random() * (TUNING.maxPuzzlesPerRound - TUNING.minPuzzlesPerRound + 1));
  const count = Math.min(desiredCount, puzzles.length);
  const puzzlePool = [...PUZZLE_TYPES].sort(() => Math.random() - 0.5).slice(0, count);
  const stationPool = spreadPuzzleStations(puzzles, count);
  return puzzlePool.map((type, index) => ({ stationId: stationPool[index].id, puzzleTypeId: type.id }));
}

function roundPlayerSnapshots() {
  return game.players.map((p) => {
    const local = p.id === myId;
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      alive: p.alive,
      x: local ? playerModel.position.x : p.lastX,
      y: local ? playerModel.position.y : p.lastY,
      z: local ? playerModel.position.z : p.lastZ,
      yaw: local ? getLocalYaw() : p.lastYaw
    };
  });
}

function spreadPuzzleStations(stations, count) {
  const pool = [...stations].sort(() => Math.random() - 0.5);
  const selected = [];
  const usedFloors = new Set();
  const usedZones = new Set();
  const floorKey = (station) => station.floor || 'ground';
  const zoneKey = (station) => `${floorKey(station)}:${station.zone || station.room || station.id}`;
  const allFloors = new Set(pool.map(floorKey));
  const allZones = new Set(pool.map(zoneKey));
  while (selected.length < count && pool.length) {
    const needsFloor = usedFloors.size < allFloors.size;
    const needsZone = usedZones.size < allZones.size;
    let index = pool.findIndex((station) => needsFloor && !usedFloors.has(floorKey(station)) && (!needsZone || !usedZones.has(zoneKey(station))));
    if (index < 0 && needsFloor) index = pool.findIndex((station) => !usedFloors.has(floorKey(station)));
    if (index < 0 && needsZone) index = pool.findIndex((station) => !usedZones.has(zoneKey(station)));
    if (index < 0) index = 0;
    const [station] = pool.splice(index, 1);
    selected.push(station);
    usedFloors.add(floorKey(station));
    usedZones.add(zoneKey(station));
  }
  return selected;
}

function applyRoundAssignments(assignments) {
  puzzles.forEach((puzzle) => {
    puzzle.solved = false;
    puzzle.progress = 0;
    puzzle.base.material = materials.puzzle;
    setPuzzleActive(puzzle, false);
  });
  game.activePuzzles = assignments.map((assignment) => {
    const station = puzzles.find((p) => p.id === assignment.stationId);
    const type = PUZZLE_TYPES.find((p) => p.id === assignment.puzzleTypeId);
    if (!station || !type) return null;
    station.type = type;
    updatePuzzleLabel(station);
    station.solved = false;
    station.progress = 0;
    setPuzzleActive(station, true);
    station.assignment = assignment;
    return station;
  }).filter(Boolean);
}

function beginRound() {
  if (!game) return;
  applyRoundAssignments(randomRoundAssignments());
  game.roundBannerTime = 2.8;
}

function applyPuzzleSolved(puzzleId) {
  const puzzle = puzzles.find((p) => p.id === puzzleId);
  if (puzzle && !puzzle.solved) markPuzzleSolved(puzzle, materials);
}

function applyPuzzleProgress(puzzleId, progress) {
  const puzzle = puzzles.find((p) => p.id === puzzleId);
  if (!puzzle || puzzle.solved) return;
  puzzle.progress = Math.max(0, Math.min(1, progress || 0));
}

function handleAbilityWarning(event) {
  if (!game || event.userId === myId) return;
  if (event.effect) applyRemoteAbilityEffect(event);
  ui.flash(`Monster used ${event.name}`);
  audio.play('round');
}

function enterRoundIntermission(roundCompleted) {
  if (!game) return;
  game.waitingBetweenRounds = true;
  lobby.state = LOBBY_STATES.INTERMISSION;
  controller.setEnabled(false);
  publishLobbyPresence();
  showRoundIntermission(roundCompleted);
}

function showRoundIntermission(roundCompleted = game?.round || 1) {
  if (!game) return;
  const players = connectedPlayers().map((p) => {
    const gp = game.players.find((item) => item.id === p.id) || p;
    return { ...p, role: gp.role, alive: gp.alive, self: p.id === myId, host: p.id === lobby.hostId };
  });
  ui.showRoundMenu({ roundCompleted, players, isHost: isHost(), mapId: selectedMapId });
  refreshServerMenuIfOpen();
}

function startNextRoundFromIntermission() {
  if (!game || !isHost()) return;
  game.players = mergeLivePlayers(connectedPlayers());
  const aliveSurvivors = game.players.filter((p) => p.role === 'survivor' && p.alive).length;
  if (aliveSurvivors <= 0) {
    room?.publishTopic('lobby-event', { type: 'match-ended', winner: 'monster', message: 'No living survivors remain for the next round.' });
    endMatch('monster', 'No living survivors remain for the next round.');
    return;
  }
  game.waitingBetweenRounds = false;
  lobby.state = LOBBY_STATES.IN_MATCH;
  game.round += 1;
  const nextMapId = validMapId(selectedMapId);
  lobby.mapId = nextMapId;
  const nextMapSeed = nextMapId === game.mapId ? game.mapSeed : Math.floor(Math.random() * 999999);
  const index = Math.floor(Math.random() * game.availableAbilities.length);
  const unlocked = game.availableAbilities[index] ? game.availableAbilities.splice(index, 1)[0] : null;
  if (unlocked) {
    game.monsterAbilities.push(unlocked);
    game.selectedAbilityIndex = game.monsterAbilities.length - 1;
  }
  if (nextMapId !== game.mapId) {
    const layout = rebuildMap(nextMapSeed, nextMapId);
    game.mapId = nextMapId;
    game.mapSeed = nextMapSeed;
    placeLocalPlayerAtSpawn(layout);
  }
  const assignments = randomRoundAssignments();
  const players = roundPlayerSnapshots();
  const roundState = { type: 'round-state', round: game.round, abilities: game.monsterAbilities, assignments, players, monsterId: game.monsterId, mapId: game.mapId, mapSeed: game.mapSeed };
  game.lastPublishedState = roundState;
  room.publishTopic('lobby-event', roundState);
  applyRoundState(roundState);
}

function applyRoundState(event) {
  if (!game) return;
  game.lastPublishedState = event;
  game.waitingBetweenRounds = false;
  if (lobby) lobby.state = LOBBY_STATES.IN_MATCH;
  if (event.players?.length) {
    const previous = new Map(game.players.map((p) => [p.id, p]));
    game.players = event.players.map((p) => {
      const old = previous.get(p.id) || {};
      return {
        ...old,
        ...p,
        role: p.role || (p.id === game.monsterId ? 'monster' : 'survivor'),
        alive: p.alive !== false,
        lastX: Number.isFinite(p.x) ? p.x : old.lastX,
        lastY: Number.isFinite(p.y) ? p.y : old.lastY,
        lastZ: Number.isFinite(p.z) ? p.z : old.lastZ,
        lastYaw: Number.isFinite(p.yaw) ? p.yaw : old.lastYaw
      };
    });
    const localSnapshot = game.players.find((p) => p.id === myId);
    if (localSnapshot) game.local.alive = localSnapshot.alive !== false;
  }
  controller.setEnabled(game.local.alive);
  ui.showGame();
  game.round = event.round;
  const incomingMapId = validMapId(event.mapId || game.mapId);
  selectedMapId = incomingMapId;
  if (lobby) lobby.mapId = incomingMapId;
  if (incomingMapId !== game.mapId) {
    const layout = rebuildMap(event.mapSeed || Date.now(), incomingMapId);
    game.mapId = incomingMapId;
    game.mapSeed = event.mapSeed || game.mapSeed;
    placeLocalPlayerAtSpawn(layout);
  }
  game.monsterAbilities = event.abilities || game.monsterAbilities;
  game.selectedAbilityIndex = Math.min(game.selectedAbilityIndex || 0, Math.max(0, game.monsterAbilities.length - 1));
  puzzles.forEach((p) => setPuzzleActive(p, false));
  if (event.assignments) applyRoundAssignments(event.assignments);
  else {
    game.activePuzzles = (event.activePuzzleIds || []).map((puzzleId) => puzzles.find((p) => p.id === puzzleId)).filter(Boolean);
    game.activePuzzles.forEach((p) => setPuzzleActive(p, true));
  }
  game.roundBannerTime = 2.8;
}

function completePuzzle(puzzle) {
  if (!puzzle || puzzle.solved) return;
  markPuzzleSolved(puzzle, materials);
  audio.play('puzzle');
  room?.publishTopic('lobby-event', { type: 'puzzle-solved', puzzleId: puzzle.id });
  if (isHost() && game.activePuzzles.every((p) => p.solved)) {
    if (game.round >= TUNING.roundCount) {
      room.publishTopic('lobby-event', { type: 'match-ended', winner: 'survivors', message: 'Survivors completed Round 10 with at least one survivor alive.' });
      endMatch('survivors', 'Survivors completed Round 10 with at least one survivor alive.');
    } else {
      room.publishTopic('lobby-event', { type: 'round-complete', round: game.round });
      enterRoundIntermission(game.round);
    }
  }
}

function mergeLivePlayers(list) {
  if (!game) return [];
  const known = new Map(game.players.map((p) => [p.id, p]));
  list.forEach((p) => {
    const existing = known.get(p.id);
    if (existing) {
      existing.name = p.name || existing.name;
      existing.alive = p.alive !== false && existing.alive !== false;
      if (Number.isFinite(p.x) && Number.isFinite(p.z)) {
        existing.lastX = p.x;
        existing.lastY = Number.isFinite(p.y) ? p.y : existing.lastY;
        existing.lastZ = p.z;
      }
      if (Number.isFinite(p.yaw)) existing.lastYaw = p.yaw;
      if (p.role && p.role !== 'lobby') existing.role = p.role;
    } else if (game.waitingBetweenRounds && p.id !== game.monsterId) {
      known.set(p.id, { id: p.id, name: p.name, role: 'survivor', alive: true, lateJoin: true });
    }
  });
  return [...known.values()];
}

function updateRemoteMarkers(players) {
  if (!game) {
    remoteMarkers.forEach((entry) => scene.remove(entry.object));
    remoteMarkers.clear();
    return;
  }
  const seen = new Set();
  players.forEach((p) => {
    if (p.id === myId) return;
    const source = p.peer || p;
    const known = game.players.find((gp) => gp.id === p.id);
    const role = known?.role || p.role || source.role || 'survivor';
    const alive = known?.alive !== false && source.alive !== false;
    seen.add(p.id);
    let entry = remoteMarkers.get(p.id);
    if (!entry || entry.role !== role || entry.name !== p.name) {
      if (entry?.object) scene.remove(entry.object);
      entry = { object: createRemoteMarker(role, p.name || known?.name || 'Player'), role, name: p.name || known?.name || 'Player' };
      scene.add(entry.object);
      remoteMarkers.set(p.id, entry);
    }
    const x = Number.isFinite(source.x) ? source.x : known?.lastX;
    const y = Number.isFinite(source.y) ? source.y : known?.lastY || 0;
    const z = Number.isFinite(source.z) ? source.z : known?.lastZ;
    const yaw = Number.isFinite(source.yaw) ? source.yaw : known?.lastYaw;
    if (Number.isFinite(x) && Number.isFinite(z)) entry.object.position.set(x, y, z);
    if (Number.isFinite(yaw)) entry.object.rotation.y = yaw;
    entry.object.visible = alive && Number.isFinite(x) && Number.isFinite(z);
  });
  remoteMarkers.forEach((entry, idKey) => {
    if (!seen.has(idKey) || !game.players.some((p) => p.id === idKey)) {
      scene.remove(entry.object);
      remoteMarkers.delete(idKey);
    }
  });
}

function nearest(list, maxDistance) {
  if (!game) return null;
  return list.map((item) => ({ item, d: distance3D(playerModel.position, item.position) })).filter((x) => x.d <= maxDistance).sort((a, b) => a.d - b.d)[0]?.item || null;
}

function setDoorOpen(door, open) {
  door.open = open;
  door.mesh.rotation.y = (door.baseRotation || 0) + (door.open ? Math.PI / 2 : 0);
  door.mesh.material.emissiveIntensity = door.open ? 0.65 : 0.22;
}

function useStairs(stair) {
  if (!stair?.target) return;
  playerModel.position.set(stair.target.x, stair.target.y || 0, stair.target.z);
  setControllerGroundLevel(stair.target.y || 0);
  game.activeInteractPuzzleId = null;
  game.interactHeld = 0;
  resolveWalls(playerModel);
  publishLobbyPresence();
  ui.flash(`${stair.name}: ${stair.target.label || stair.target.floor}`);
}

function handleInteractTap() {
  if (!game || game.ended || game.waitingBetweenRounds || !game.local.alive) return;
  const stair = nearest(interactables.stairs, 1.65);
  if (stair) {
    useStairs(stair);
    return;
  }
  const door = nearest(interactables.doors, 1.45);
  if (door) {
    setDoorOpen(door, !door.open);
    ui.flash(`${door.open ? 'Opened' : 'Closed'} ${door.room} door`);
  }
}

function hasAbility(name) {
  return game?.monsterAbilities.some((ability) => ability.id === name) || false;
}
function activeEffect(name) {
  return (game?.activeAbilityEffects?.[name] || 0) > 0;
}
function monsterRangeBonus() {
  const passive = (game?.monsterAbilities || []).filter((ability) => ability.type === 'passive').reduce((s, a) => s + (a.range || 0), 0);
  const active = (game?.monsterAbilities || []).filter((ability) => activeEffect(ability.id)).reduce((s, a) => s + (a.range || 0), 0);
  return passive + active;
}
function monsterSpeedBonus() {
  const passive = (game?.monsterAbilities || []).filter((ability) => ability.type === 'passive').reduce((s, a) => s + (a.speed || 0), 0);
  const active = (game?.monsterAbilities || []).filter((ability) => activeEffect(ability.id)).reduce((s, a) => s + (a.speed || 0), 0);
  return passive + active;
}
function selectedAbility() {
  if (!game?.monsterAbilities?.length) return null;
  return game.monsterAbilities[game.selectedAbilityIndex % game.monsterAbilities.length];
}
function cycleAbility(direction = 1) {
  if (!game || game.local.role !== 'monster' || !game.monsterAbilities.length) return;
  game.selectedAbilityIndex = (game.selectedAbilityIndex + direction + game.monsterAbilities.length) % game.monsterAbilities.length;
  const ability = selectedAbility();
  if (ability) ui.flash(`Selected ability: ${ability.name}`);
}
function activateSelectedAbility() {
  if (!game || game.waitingBetweenRounds || game.local.role !== 'monster') return;
  const ability = selectedAbility();
  if (!ability) return ui.flash('No monster abilities unlocked yet.');
  if (ability.type === 'passive') return ui.flash(`${ability.name} is passive and always active.`);
  const cooldown = game.abilityCooldowns[ability.id] || 0;
  if (cooldown > 0) return ui.flash(`${ability.name} cooling down: ${Math.ceil(cooldown)}s`);
  const finalCooldown = Math.max(8, ability.cooldown * (1 - cooldownBonus()));
  game.abilityCooldowns[ability.id] = finalCooldown;
  game.activeAbilityEffects[ability.id] = ability.tags?.includes('once') ? 0 : 5;
  const effect = applyAbilityImmediateEffect(ability);
  room?.publishTopic('lobby-event', { type: 'ability-used', abilityId: ability.id, name: ability.name, userId: myId, effect });
  ui.flash(`Activated: ${ability.name}`);
  audio.play(ability.tags?.includes('warning') ? 'round' : 'puzzle');
}
function cooldownBonus() {
  return (game?.monsterAbilities || []).reduce((sum, ability) => sum + (ability.cooldownBonus || 0), 0);
}
function abilityDuration(ability) {
  if (ability.tags?.includes('blackout') || ability.tags?.includes('fog') || ability.tags?.includes('stealth')) return 8;
  if (ability.tags?.includes('sense') || ability.tags?.includes('warning') || ability.tags?.includes('illusion')) return 6;
  if (ability.tags?.includes('slow') || ability.tags?.includes('puzzle')) return 7;
  return 5;
}

function nearestRemoteSurvivor(maxDistance = 999) {
  let best = null;
  remoteMarkers.forEach((entry, idKey) => {
    const player = game?.players.find((p) => p.id === idKey && p.role === 'survivor' && p.alive);
    if (!player || !entry.object.visible) return;
    const d = distance3D(entry.object.position, playerModel.position);
    if (d <= maxDistance && (!best || d < best.d)) best = { id: idKey, entry, player, d };
  });
  return best;
}

function pushAwayFromMonster(targetId, force = 2.2) {
  const entry = remoteMarkers.get(targetId);
  if (!entry) return;
  const direction = entry.object.position.clone().sub(playerModel.position).setY(0).normalize();
  entry.object.position.addScaledVector(direction, force);
}

function applyAbilityImmediateEffect(ability) {
  const effect = { abilityId: ability.id, tags: ability.tags || [], origin: { x: playerModel.position.x, z: playerModel.position.z }, duration: abilityDuration(ability), targetId: null };
  if (ability.tags?.includes('lunge') || ability.tags?.includes('teleport')) {
    const forward = new THREE.Vector3(-Math.sin(getLocalYaw()), 0, -Math.cos(getLocalYaw()));
    playerModel.position.addScaledVector(forward, ability.tags.includes('teleport') ? 3.6 : 2.25 + (ability.range || 0));
    resolveWalls(playerModel);
    effect.teleportTo = { x: playerModel.position.x, z: playerModel.position.z };
  }
  if (ability.tags?.includes('sense')) {
    remoteMarkers.forEach((entry, idKey) => {
      const survivor = game.players.find((p) => p.id === idKey && p.role === 'survivor' && p.alive);
      if (survivor) {
        entry.object.visible = true;
        entry.object.traverse((child) => {
          if (child.material?.emissive) child.material.emissiveIntensity = Math.max(child.material.emissiveIntensity || 0, 1.6);
        });
      }
    });
  }
  if (ability.tags?.includes('attack') || ability.tags?.includes('range')) {
    const target = nearestRemoteSurvivor(TUNING.attackRangeBase + monsterRangeBonus() + 1.2);
    if (target) {
      effect.targetId = target.id;
      if (ability.id === 'chain_pull') {
        const toward = playerModel.position.clone().sub(target.entry.object.position).setY(0).normalize();
        target.entry.object.position.addScaledVector(toward, 1.2);
      } else if (ability.id === 'ground_pound') pushAwayFromMonster(target.id, 2.7);
    }
  }
  if (ability.tags?.includes('slow')) {
    game.survivorDebuffs.globalSlow = Math.max(game.survivorDebuffs.globalSlow || 0, effect.duration);
    effect.slow = true;
  }
  if (ability.id === 'door_slam' || ability.tags?.includes('door')) {
    interactables.doors.forEach((door) => {
      if (distance3D(playerModel.position, door.position) < (ability.id === 'door_phase' ? 2.2 : 6.5)) {
        setDoorOpen(door, ability.id === 'door_phase' || ability.id === 'heavy_charge');
      }
    });
  }
  if (ability.tags?.includes('puzzle') && game.activePuzzles.length) {
    const target = game.activePuzzles.find((p) => !p.solved);
    if (target) {
      target.progress = Math.max(0, target.progress - (ability.id === 'puzzle_reset_tap' ? 0.55 : 0.28));
      target.ring.scale.setScalar(1.35);
      effect.puzzleId = target.id;
      effect.progressPenalty = ability.id === 'puzzle_reset_tap' ? 0.55 : 0.28;
    }
  }
  if (ability.tags?.includes('blackout')) {
    scene.traverse((object) => {
      if (object.isPointLight) object.userData.blackoutTimer = effect.duration;
    });
  }
  if (ability.tags?.includes('fog')) {
    effect.fogDensity = scene.fog?.density || currentBaseFogDensity;
    scene.fog.density = Math.min(0.11, scene.fog.density + 0.028);
    game.survivorDebuffs.fog = Math.max(game.survivorDebuffs.fog || 0, effect.duration);
  }
  if (ability.tags?.includes('illusion') || ability.tags?.includes('warning')) {
    game.roundBannerTime = Math.max(game.roundBannerTime, 2.4);
  }
  if (ability.id === 'rule_breaker') {
    const extra = game.monsterAbilities.find((owned) => owned.type === 'active' && owned.id !== ability.id && (game.abilityCooldowns[owned.id] || 0) <= 0);
    if (extra) game.activeAbilityEffects[extra.id] = abilityDuration(extra);
  }
  return effect;
}

function applyRemoteAbilityEffect(event) {
  const effect = event.effect;
  if (effect.puzzleId) {
    const puzzle = puzzles.find((p) => p.id === effect.puzzleId);
    if (puzzle && !puzzle.solved) puzzle.progress = Math.max(0, puzzle.progress - (effect.progressPenalty || 0.25));
  }
  if (effect.tags?.includes('blackout')) {
    scene.traverse((object) => {
      if (object.isPointLight) object.userData.blackoutTimer = effect.duration || 5;
    });
  }
  if (effect.tags?.includes('fog') && scene.fog) {
    scene.fog.density = Math.min(0.11, scene.fog.density + 0.022);
    game.survivorDebuffs.fog = Math.max(game.survivorDebuffs.fog || 0, effect.duration || 5);
  }
  if (effect.tags?.includes('slow')) game.survivorDebuffs.globalSlow = Math.max(game.survivorDebuffs.globalSlow || 0, effect.duration || 5);
  if (effect.targetId === myId && effect.tags?.includes('attack')) game.survivorDebuffs.globalSlow = Math.max(game.survivorDebuffs.globalSlow || 0, 2.5);
}

function tryAttack() {
  if (!game || game.waitingBetweenRounds || game.local.role !== 'monster' || !game.local.alive || game.local.attackCooldown > 0 || game.countdown > 0) return;
  game.local.attackCooldown = Math.max(0.45, TUNING.attackCooldown * (1 - cooldownBonus()));
  const range = TUNING.attackRangeBase + monsterRangeBonus();
  let victimId = null;
  remoteMarkers.forEach((entry, idKey) => {
    const player = game.players.find((p) => p.id === idKey && p.role === 'survivor' && p.alive);
    if (player && distance3D(entry.object.position, playerModel.position) <= range) victimId = idKey;
  });
  if (victimId) {
    room?.publishTopic('lobby-event', { type: 'player-killed', playerId: victimId, byId: myId });
    applyPlayerKilled(victimId);
  } else ui.flash('No survivor in grab range');
}

function endMatch(winner, message) {
  if (game) game.ended = true;
  if (lobby) lobby.state = LOBBY_STATES.ENDED;
  controller.setEnabled(false);
  fpCamera.disable();
  publishLobbyPresence();
  ui.endMatch(winner, message || (winner === 'survivors' ? 'Survivors Win' : 'Monster Wins'));
}

function applyPlayerKilled(playerId) {
  if (!game) return;
  const player = game.players.find((p) => p.id === playerId);
  if (player) player.alive = false;
  if (playerId === myId) {
    game.local.alive = false;
    controller.setEnabled(false);
    makeCorpse(scene, playerModel.position);
    ui.flash('You died. Dead survivors do not respawn.');
  }
  const marker = remoteMarkers.get(playerId);
  if (marker) {
    makeCorpse(scene, marker.object.position);
    marker.object.visible = false;
  }
  refreshServerMenuIfOpen();
  audio.play('kill');
  if (isHost() && game.players.filter((p) => p.role === 'survivor' && p.alive).length === 0) {
    room.publishTopic('lobby-event', { type: 'match-ended', winner: 'monster', message: 'All survivors were killed or disconnected.' });
    endMatch('monster', 'All survivors were killed or disconnected.');
  }
}

function resolveWalls(object) {
  const pos = object.position;
  const radius = TUNING.playerRadius;
  pos.x = THREE.MathUtils.clamp(pos.x, -24.2, 24.2);
  pos.z = THREE.MathUtils.clamp(pos.z, -20.2, 20.2);
  const editorColliders = getEditorCollisionColliders();
  for (const wall of [...colliders, ...editorColliders]) {
    if (wall.minY !== undefined && wall.maxY !== undefined) {
      const playerMinY = pos.y || 0;
      const playerMaxY = playerMinY + 1.8;
      if (playerMaxY < wall.minY || playerMinY > wall.maxY) continue;
    } else if (Math.abs((pos.y || 0) - (wall.y || 0)) > 1.8) continue;
    const closestX = THREE.MathUtils.clamp(pos.x, wall.minX, wall.maxX);
    const closestZ = THREE.MathUtils.clamp(pos.z, wall.minZ, wall.maxZ);
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const dist = Math.hypot(dx, dz);
    if (dist > 0 && dist < radius) {
      pos.x += (dx / dist) * (radius - dist);
      pos.z += (dz / dist) * (radius - dist);
    }
  }
}

function getEditorCollisionColliders() {
  return [
    ...(assetEditor?.collisionColliders?.() || []),
    ...(getPermanentEditorCollisionColliders?.() || [])
  ];
}

function isEditorModeActive() {
  return Boolean(assetEditor?.isEditorModeActive?.());
}

function updateEditorFlyMovement(delta) {
  if (!assetEditor?.shouldUseEditorMovement?.()) return false;
  const input = assetEditor.editorFlyInput();
  const move = new THREE.Vector3();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 0.0001) right.set(Math.cos(getLocalYaw()), 0, -Math.sin(getLocalYaw()));
  right.normalize();
  if (input.forward) move.add(forward);
  if (input.back) move.sub(forward);
  if (input.right) move.add(right);
  if (input.left) move.sub(right);
  if (input.up) move.y += 1;
  if (input.down) move.y -= 1;
  if (move.lengthSq() > 0.0001) {
    move.normalize().multiplyScalar((input.speed || 8.5) * delta);
    playerModel.position.add(move);
    if (controller.velocity) controller.velocity.set(0, 0, 0);
  }
  if (input.collision) resolveWalls(playerModel);
  return true;
}

function resetActivePuzzleProgress() {
  if (!game?.activeInteractPuzzleId) {
    if (game) game.interactHeld = 0;
    return;
  }
  const puzzle = puzzles.find((p) => p.id === game.activeInteractPuzzleId);
  if (puzzle && !puzzle.solved) {
    puzzle.progress = 0;
    room?.publishTopic('lobby-event', { type: 'puzzle-progress', puzzleId: puzzle.id, progress: 0 });
  }
  game.activeInteractPuzzleId = null;
  game.interactHeld = 0;
}

function updateLocal(delta) {
  if (!game || game.ended) return;
  game.countdown = Math.max(0, game.countdown - delta);
  game.local.attackCooldown = Math.max(0, game.local.attackCooldown - delta);
  game.local.howlCooldown = Math.max(0, game.local.howlCooldown - delta);
  Object.keys(game.abilityCooldowns || {}).forEach((key) => { game.abilityCooldowns[key] = Math.max(0, game.abilityCooldowns[key] - delta); });
  Object.keys(game.activeAbilityEffects || {}).forEach((key) => { game.activeAbilityEffects[key] = Math.max(0, game.activeAbilityEffects[key] - delta); });
  Object.keys(game.survivorDebuffs || {}).forEach((key) => { game.survivorDebuffs[key] = Math.max(0, game.survivorDebuffs[key] - delta); });
  const editorActive = isEditorModeActive();
  if (game.local.alive && !game.waitingBetweenRounds && !isAnyMenuOpen()) {
    const slowed = game.local.role === 'survivor' && (game.survivorDebuffs.globalSlow || 0) > 0;
    if (editorActive) {
      updateEditorFlyMovement(delta);
    } else {
      controller.moveSpeed = game.local.role === 'monster' ? TUNING.monsterBaseSpeed + monsterSpeedBonus() : TUNING.survivorSpeed * (slowed ? 0.62 : 1);
      controller.update(delta, getLocalYaw());
      if (renderer.xr.isPresenting && vrMoveInput.lengthSq() > 0.001) {
        const yaw = getLocalYaw();
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        playerModel.position.addScaledVector(right, vrMoveInput.x * controller.moveSpeed * delta);
        playerModel.position.addScaledVector(forward, vrMoveInput.y * controller.moveSpeed * delta);
      }
      resolveWalls(playerModel);
    }
  }
  fpCamera.update();
  if (!editorActive && game.local.role === 'survivor' && game.local.alive && !game.waitingBetweenRounds && !isAnyMenuOpen()) {
    const active = game.activePuzzles.find((p) => !p.solved && distance3D(playerModel.position, p.position) < 1.75);
    if (active && keys.has('KeyE')) {
      if (game.activeInteractPuzzleId !== active.id) {
        game.interactHeld = 0;
        game.activeInteractPuzzleId = active.id;
      }
      game.interactHeld += delta;
      active.progress = Math.min(1, game.interactHeld / TUNING.puzzleHoldSeconds);
      if (!game.lastProgressPublish || performance.now() - game.lastProgressPublish > 120) {
        game.lastProgressPublish = performance.now();
        room?.publishTopic('lobby-event', { type: 'puzzle-progress', puzzleId: active.id, progress: active.progress });
      }
      if (active.progress >= 1) {
        game.interactHeld = 0;
        game.activeInteractPuzzleId = null;
        completePuzzle(active);
      }
    } else {
      resetActivePuzzleProgress();
    }
  } else resetActivePuzzleProgress();
}

function updateEffects(delta) {
  scene.traverse((object) => {
    if (object.isPointLight) {
      if (object.userData.blackoutTimer > 0) {
        object.userData.blackoutTimer = Math.max(0, object.userData.blackoutTimer - delta);
        object.intensity = Math.min(object.intensity, (object.userData.baseIntensity || 0.7) * 0.16);
      } else if (object.userData.flicker) object.intensity = object.userData.baseIntensity * (0.5 + Math.random() * 0.8);
      else if (object.userData.baseIntensity) object.intensity = THREE.MathUtils.lerp(object.intensity, object.userData.baseIntensity, delta * 2.5);
    }
  });
  puzzles.forEach((puzzle, index) => {
    puzzle.symbol.rotation.y += delta * (1.8 + index * 0.1);
    puzzle.symbol.position.y = 1.08 + Math.sin(performance.now() * 0.003 + index) * 0.08;
    if (puzzle.active && !puzzle.solved) puzzle.ring.rotation.z += delta * 1.9;
  });
  interactables.roomLabels.forEach(({ area, label }) => {
    label.visible = Math.abs((playerModel.position.y || 0) - (area.y || 0)) < 1.1 && Math.abs(playerModel.position.x - area.x) < area.w / 2 && Math.abs(playerModel.position.z - area.z) < area.d / 2;
  });
  if (game?.survivorDebuffs?.fog <= 0 && scene.fog) scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, currentBaseFogDensity, delta * 0.8);
  if (game) game.roundBannerTime = Math.max(0, game.roundBannerTime - delta);
}

function updateVRInput(delta) {
  if (!renderer.xr.isPresenting) {
    vrMoveInput.set(0, 0);
    return;
  }
  updateVRMenuPointers();
  const session = renderer.xr.getSession();
  if (!session) return;
  const menuOpen = isAnyMenuOpen();
  vrMoveInput.set(0, 0);
  let interactHeld = false;
  let index = 0;
  for (const source of session.inputSources) {
    const state = vrControllers[index];
    const controllerIndex = index;
    index += 1;
    if (!state || !source.gamepad) continue;
    const buttons = source.gamepad.buttons || [];
    const handedness = source.handedness || (controllerIndex === 0 ? 'left' : 'right');
    const primary = buttons[0]?.pressed || false;
    const secondary = buttons[1]?.pressed || buttons[3]?.pressed || false;
    const menuButton = buttons[4]?.pressed || buttons[2]?.pressed || false;
    const interactButton = handedness === 'left' ? secondary : primary;
    const abilityButton = handedness === 'left' ? primary : secondary;
    const moveAxes = handedness === 'left'
      ? [source.gamepad.axes?.[0] || 0, source.gamepad.axes?.[1] || 0]
      : [source.gamepad.axes?.[2] || source.gamepad.axes?.[0] || 0, source.gamepad.axes?.[3] || source.gamepad.axes?.[1] || 0];
    const abilityAxes = handedness === 'right'
      ? [source.gamepad.axes?.[2] || source.gamepad.axes?.[0] || 0, source.gamepad.axes?.[3] || source.gamepad.axes?.[1] || 0]
      : [source.gamepad.axes?.[0] || 0, source.gamepad.axes?.[1] || 0];
    const moveX = Math.abs(moveAxes[0]) > 0.18 ? moveAxes[0] : 0;
    const moveY = Math.abs(moveAxes[1]) > 0.18 ? moveAxes[1] : 0;
    const cycleY = Math.abs(abilityAxes[1]) > 0.22 ? abilityAxes[1] : 0;
    if (!menuOpen && game && !game.ended && !game.waitingBetweenRounds) {
      if (moveX || moveY) {
        vrMoveInput.x += moveX;
        vrMoveInput.y += -moveY;
      }
      if (game.local.role === 'survivor' && interactButton) interactHeld = true;
      if (abilityButton && !state.previousAbilityButton && game.local.role === 'monster') activateSelectedAbility();
      if (game.local.role === 'monster' && Math.abs(cycleY) > 0.75 && Math.abs(state.previousCycleAxisY || 0) <= 0.75) cycleAbility(cycleY > 0 ? 1 : -1);
    }
    if (handedness === 'left' && menuButton && !state.previousMenu) toggleServerMenu();
    state.previousPrimary = primary;
    state.previousSecondary = secondary;
    state.previousMenu = menuButton;
    state.previousAbilityButton = abilityButton;
    state.previousCycleAxisY = cycleY;
  }
  if (game?.local?.role === 'survivor' && !menuOpen && game && !game.ended && !game.waitingBetweenRounds) {
    if (interactHeld) keys.add(INTERACT_KEY);
    else keys.delete(INTERACT_KEY);
  } else {
    keys.delete(INTERACT_KEY);
  }
  if (vrMoveInput.lengthSq() > 1) vrMoveInput.normalize();
}

function updateHud(delta) {
  if (!game || game.ended || game.waitingBetweenRounds) return;
  game.publishTimer += delta;
  if (game.publishTimer > 0.12) {
    game.publishTimer = 0;
    publishLobbyPresence();
  }
  const remaining = game.activePuzzles.filter((p) => !p.solved).length;
  const activeNear = game.activePuzzles.find((p) => !p.solved && distance3D(playerModel.position, p.position) < 1.75);
  const door = nearest(interactables.doors, 1.45);
  const stair = nearest(interactables.stairs, 1.65);
  const selected = selectedAbility();
  const selectedCooldown = selected ? Math.ceil(game.abilityCooldowns[selected.id] || 0) : 0;
  const vrHint = renderer.xr.isPresenting ? ' · VR left stick move · VR interact button repair/use · VR ability button use power · right stick cycle' : '';
  const abilities = game.local.role === 'monster'
    ? (selected ? `Selected: ${selected.name}${selected.type === 'active' ? ` (${selectedCooldown}s)` : ' passive'} · Q use · R cycle${vrHint}` : `Basic movement and attack only${vrHint}`)
    : (game.monsterAbilities.length ? `Monster has unlocked powers.` : 'Monster has basic movement and attack only');
  let prompt = '';
  if (game.countdown > 0) prompt = `Round starts in ${Math.ceil(game.countdown)}… Survivors orient while Monster waits.`;
  else if (game.local.role === 'survivor') prompt = !game.local.alive ? 'You are dead. Spectate the remaining real players.' : activeNear ? 'Hold E or the VR interact button to repair. Release or walk away resets progress.' : stair ? `Press E to use ${stair.name} to ${stair.target.label || stair.target.floor}.` : door ? `Press E to ${door.open ? 'close' : 'open'} ${door.room} door.` : `Find and complete ${remaining} glowing station${remaining === 1 ? '' : 's'}.`;
  else prompt = `${stair ? `Press E to use ${stair.name} to ${stair.target.label || stair.target.floor}. ` : door ? `Press E to ${door.open ? 'close' : 'open'} ${door.room} door. ` : ''}Hunt real survivors. Click/F/Space or the VR interact button grabs. Q or the VR ability button activates the selected power. R or the right stick cycles abilities.`;
  ui.update({ role: game.local.role, dead: !game.local.alive, round: game.round, abilities, puzzlesRemaining: remaining, objective: game.local.role === 'monster' ? 'Kill every real survivor.' : 'Complete the active cyan stations and survive through Round 10.', prompt, progress: activeNear?.progress || 0, warning: game.roundBannerTime > 0 ? (game.round === 1 ? 'ROUND 1: BASIC MOVEMENT AND ATTACK ONLY' : `MONSTER ABILITY: ${abilities}`) : '' });
}

function animate(time) {
  timer.update(time);
  const delta = Math.min(timer.getDelta(), 0.05);
  updateLocalHandVisibility();
  updateVRMenuEnvironment();
  updateVRInput(delta);
  if (mapMakerMode && assetEditor?.isEditorModeActive?.() && !isAnyMenuOpen()) {
    updateEditorFlyMovement(delta);
    fpCamera.update();
  }
  assetEditor?.update?.(delta);
  updatePermanentEditorOverrides(delta);
  updateLocal(delta);
  updateEffects(delta);
  updateHud(delta);
  renderer.render(scene, camera);
}

rebuildMap(12345, DEFAULT_MAP_ID);
loadEditorMapIndex();
refreshPublicLobbies();
renderer.setAnimationLoop(animate);
