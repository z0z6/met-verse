import * as THREE from 'three';
import { buildRoom, ROOM_HEIGHT } from './room.js';
import { loadArtworks } from './artworks.js';
import {
  buildLoungeSet, buildCornerSofa, buildCoffeeTable,
  buildPottedPlant, buildBushyPlant, buildBench, buildBonsai, buildLamellaJamb, buildLamellaReveal,
} from './furniture.js';
import { ROOMS, OBSTACLES, resolveCollision, crossesSolidWall, DEPTH, PARTITIONS, DOOR_HALF_WIDTH, WALL_THICKNESS, BOUNDS } from './collision.js';
import { GalleryControls, keys } from './controls.js';
import { CardboardMode } from './cardboard.js';
import { getActiveGamepad, applyGamepadMovement } from './gamepad.js';
import { initMobileControls } from './mobileControls.js';

const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111114);
scene.fog = new THREE.Fog(0x111114, 14, 34);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 100);

const renderer = new THREE.WebGLRenderer({
  antialias: !IS_MOBILE,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const CLIP_MARGIN = 0.03;
renderer.clippingPlanes = [
  new THREE.Plane(new THREE.Vector3(0, 0, 1), DEPTH / 2 + CLIP_MARGIN),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), DEPTH / 2 + CLIP_MARGIN),
  new THREE.Plane(new THREE.Vector3(1, 0, 0), -BOUNDS.minX + CLIP_MARGIN),
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), BOUNDS.maxX + CLIP_MARGIN),
];

// Canvas ukryty domyślnie, dopóki użytkownik nie wybierze trybu
renderer.domElement.style.display = 'none';

const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);

const { floorMesh } = buildRoom(scene);
const mainRoom = ROOMS[1];
const loungeX = (mainRoom.minX + mainRoom.maxX) / 2;
buildLoungeSet(scene, loungeX, 0);
OBSTACLES.push({ x: loungeX, z: -0.4, radius: 2.1 });

const westRoom = ROOMS[0];
const westCenterX = (westRoom.minX + westRoom.maxX) / 2;
const ARM_A = 4, ARM_B = 4;
const rugHalfW = (westRoom.maxX - westRoom.minX) * 0.5 / 2;
const rugHalfD = DEPTH * 0.45 / 2;
const SOFA_GAP = 0.85;
const sofaX = westCenterX - rugHalfW + SOFA_GAP;
const sofaZ = -rugHalfD + SOFA_GAP;
const { group: sofaGroup, footprint } = buildCornerSofa(scene, sofaX, sofaZ, ARM_A, ARM_B);
OBSTACLES.push(
  { x: sofaX + footprint.depth / 2, z: sofaZ + footprint.depth / 2, radius: footprint.depth / 2 + 0.15 },
  { x: sofaX + footprint.depth + (footprint.armA - footprint.depth) / 2, z: sofaZ + footprint.depth / 2, radius: (footprint.armA - footprint.depth) / 2 + 0.5 },
  { x: sofaX + footprint.depth / 2, z: sofaZ + footprint.depth + (footprint.armB - footprint.depth) / 2, radius: (footprint.armB - footprint.depth) / 2 + 0.5 }
);

{
  const D = footprint.depth, EPS = 0.02, nearGap = 0.3;
  const tableShort = 0.6 * 1.5;
  const extraGap = tableShort / 4;
  const tableLongStart = D + nearGap;
  const tableLongEnd = footprint.armB + EPS;
  const tableLong = tableLongEnd - tableLongStart;
  const westTable = buildCoffeeTable(tableLong, tableShort);
  westTable.rotation.y = Math.PI / 2;
  westTable.position.set(D + nearGap + extraGap + tableShort / 2, 0, (tableLongStart + tableLongEnd) / 2);
  sofaGroup.add(westTable);
  const tWorldX = sofaX + D + nearGap + extraGap + tableShort / 2;
  const tWorldZ = sofaZ + (tableLongStart + tableLongEnd) / 2;
  OBSTACLES.push({ x: tWorldX, z: tWorldZ, radius: Math.max(tableShort, 0.4) / 2 + 0.15 });
}

{
  const plantX = westCenterX + rugHalfW - SOFA_GAP;
  const plantZ = rugHalfD - SOFA_GAP;
  buildBushyPlant(scene, plantX, plantZ);
  OBSTACLES.push({ x: plantX, z: plantZ, radius: 0.5 });
}

buildPottedPlant(scene, loungeX + 1.55, -1.75);
OBSTACLES.push({ x: loungeX + 1.55, z: -1.75, radius: 0.45 });

{
  const eastRoom = ROOMS[2];
  const eastCenterX = (eastRoom.minX + eastRoom.maxX) / 2;
  const rugHalfWE = (eastRoom.maxX - eastRoom.minX) * 0.5 / 2;
  const rugHalfDE = DEPTH * 0.45 / 2;

  const benchLength = rugHalfWE * 2 * 0.5;
  const benchSideEdge = 0.42;
  const benchX = eastCenterX - rugHalfWE + benchSideEdge + benchSideEdge / 2;
  buildBench(scene, benchX, 0, benchLength, Math.PI / 2);
  OBSTACLES.push({
    minX: benchX - benchSideEdge / 2 - 0.1, maxX: benchX + benchSideEdge / 2 + 0.1,
    minZ: -benchLength / 2 - 0.1, maxZ: benchLength / 2 + 0.1,
  });

  const bonsaiX = eastCenterX + rugHalfWE - SOFA_GAP;
  const bonsaiZ = -(rugHalfDE - SOFA_GAP);
  buildBonsai(scene, bonsaiX, bonsaiZ);
  OBSTACLES.push({ x: bonsaiX, z: bonsaiZ, radius: 0.65 });
}

{
  const LAMELLA_DEPTH = footprint.depth;
  const LAMELLA_SLAT_T = 0.08;
  const LAMELLA_DARK = 0x2a1e16;
  const LAMELLA_LIGHT = 0x94743f;
  for (const px of PARTITIONS) {
    for (const xDir of [-1, 1]) {
      const wallX = px + xDir * (WALL_THICKNESS / 2);
      for (const zDir of [-1, 1]) {
        const doorEdgeZ = zDir * DOOR_HALF_WIDTH;
        buildLamellaJamb(scene, wallX, doorEdgeZ, zDir, xDir, LAMELLA_DEPTH, ROOM_HEIGHT, LAMELLA_SLAT_T, LAMELLA_DARK, LAMELLA_LIGHT);
      }
    }
    for (const zDir of [-1, 1]) {
      const doorEdgeZ = zDir * DOOR_HALF_WIDTH;
      buildLamellaReveal(scene, doorEdgeZ, px, WALL_THICKNESS, ROOM_HEIGHT, LAMELLA_SLAT_T, LAMELLA_DARK, LAMELLA_LIGHT, -zDir);
    }
  }
}

let interactiveArtworks = [];
loadArtworks(scene).then(list => { interactiveArtworks = list; });

const controls = new GalleryControls(camera, renderer.domElement, scene);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
let dwell = 0;
const TELEPORT_DWELL = 2.2;

const cardboard = new CardboardMode(renderer, camera);
let inVR = false;

const reticleRings = document.querySelectorAll('.reticle-ring');
const reticleFills = document.querySelectorAll('.reticle-fill');
function setReticleDisplay(display) {
  reticleRings.forEach(r => { r.style.display = display; });
}
function setReticleFillHeight(pct) {
  reticleFills.forEach(f => { f.style.height = pct; });
}

const isMobileDevice = IS_MOBILE;
const vrBtn = document.getElementById('start-vr');
if (!isMobileDevice) {
  vrBtn.disabled = true;
  vrBtn.classList.add('long-label');
  vrBtn.querySelector('span').textContent = 'VR dostępne tylko w urządzeniach mobilnych';
}

const _gazeDir = new THREE.Vector3();
const _gazeOrigin = new THREE.Vector3();
function updateGazeTeleport(dt) {
  const dir = _gazeDir;
  const origin = _gazeOrigin;
  camera.getWorldDirection(dir);
  camera.getWorldPosition(origin);

  if (dir.y < -0.15) {
    raycaster.set(origin, dir);
    const hits = raycaster.intersectObject(floorMesh);
    if (hits.length) {
      dwell += dt;
      setReticleFillHeight(Math.min(100, (dwell / TELEPORT_DWELL) * 100) + '%');
      if (dwell >= TELEPORT_DWELL) {
        const targetPoint = hits[0].point.clone();
        const PLAYER_VR_RADIUS = 0.55; 
        resolveCollision(targetPoint, PLAYER_VR_RADIUS, 1.0);
        if (!crossesSolidWall(rig.position, targetPoint, PLAYER_VR_RADIUS)) {
          rig.position.x = targetPoint.x;
          rig.position.z = targetPoint.z;
          resolveCollision(rig.position, PLAYER_VR_RADIUS, 1.0);
        }
        dwell = 0;
        setReticleFillHeight('0%');
      }
      return;
    }
  }
  dwell = 0;
  setReticleFillHeight('0%');
}

const _captionDir = new THREE.Vector3();
const _captionOrigin = new THREE.Vector3();
function updateCaption() {
  const dir = _captionDir;
  camera.getWorldDirection(dir);
  const origin = _captionOrigin;
  camera.getWorldPosition(origin);
  raycaster.set(origin, dir);
  const targets = interactiveArtworks.flatMap(g => g.children);
  const hits = raycaster.intersectObjects(targets, false);
  const captionEl = document.getElementById('artwork-caption');
  if (hits.length && hits[0].distance < 6) {
    const group = hits[0].object.parent;
    captionEl.textContent = group.userData.caption || '';
    captionEl.classList.remove('hidden');
  } else {
    captionEl.classList.add('hidden');
  }
}

const _kbDir = new THREE.Vector3();
const _kbRight = new THREE.Vector3();
const _kbMove = new THREE.Vector3();
function applyKeyboardMovementVR(dt, speed, collisionFn) {
  let fwd = 0, strafe = 0;
  if (keys['w'] || keys['arrowup']) fwd += 1;
  if (keys['s'] || keys['arrowdown']) fwd -= 1;
  if (keys['a'] || keys['arrowleft']) strafe -= 1;
  if (keys['d'] || keys['arrowright']) strafe += 1;
  if (fwd === 0 && strafe === 0) return false;

  camera.getWorldDirection(_kbDir);
  _kbDir.y = 0;
  _kbDir.normalize();
  _kbRight.crossVectors(_kbDir, new THREE.Vector3(0, 1, 0)).normalize();

  _kbMove.set(0, 0, 0)
    .addScaledVector(_kbDir, fwd)
    .addScaledVector(_kbRight, strafe)
    .multiplyScalar(speed * dt);

  const p = rig.position.clone().add(_kbMove);
  collisionFn(p, 0.45);
  rig.position.copy(p);
  return true;
}

window.addEventListener('gamepadconnected', (e) => {
  console.log('[Pilot VR] gamepad podłączony:', e.gamepad.id, '| przyciski:', e.gamepad.buttons.length, '| osie:', e.gamepad.axes.length);
});
window.addEventListener('gamepaddisconnected', (e) => {
  console.log('[Pilot VR] gamepad odłączony:', e.gamepad.id);
});
window.addEventListener('keydown', (e) => {
  if (inVR) console.log('[Pilot VR] keydown:', JSON.stringify(e.key), 'code:', e.code, 'keyCode:', e.keyCode);
});

function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (inVR) {
    resolveCollision(rig.position, 0.55, 1.0);
    const gp = getActiveGamepad();
    const collisionFn = (pos, r) => resolveCollision(pos, Math.max(r, 0.55), 1.0);
    if (gp) {
      applyGamepadMovement(gp, camera, rig, dt, 2.4, collisionFn);
      dwell = 0;
      setReticleFillHeight('0%');
      setReticleDisplay('none');
    } else if (applyKeyboardMovementVR(dt, 2.4, collisionFn)) {
      dwell = 0;
      setReticleFillHeight('0%');
      setReticleDisplay('none');
    } else {
      setReticleDisplay('block');
      updateGazeTeleport(dt);
    }
    cardboard.render(scene);
  } else {
    controls.update(dt);
    updateCaption();
    renderer.render(scene, camera);
  }
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (inVR) {
    cardboard.updateAspect();
  } else {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
});

// --- LOGIKA EKRANU STARTOWEGO ---

function startExperience(mode) {
  renderer.domElement.style.display = 'block';
  controls.setMode(mode);
  
  // Ukryj ekran startowy, pokaż HUD
  document.getElementById('intro').style.display = 'none';
  document.getElementById('hud').classList.remove('hidden');

  const exitBtn = document.getElementById('exit-btn');
  exitBtn.textContent = '✕ Wyjdź';
  exitBtn.classList.remove('hidden');
  
  if (isMobileDevice) {
    document.getElementById('joystick-base').classList.remove('hidden');
  } else {
    renderer.domElement.requestPointerLock();
  }
}

// Nasłuchiwanie kliknięć w przyciski trybu
document.getElementById('start-fpp').addEventListener('click', () => startExperience('fpp'));
document.getElementById('start-tpp').addEventListener('click', () => startExperience('tpp'));

if (isMobileDevice) initMobileControls(controls);

async function enterVR(startPos) {
  renderer.domElement.style.display = 'block';
  const vrStart = startPos ? startPos.clone() : new THREE.Vector3(controls.player.x, 0, controls.player.z);
  resolveCollision(vrStart, 0.55, 1.0);
  rig.position.copy(vrStart);
  rig.position.y = 0;

  camera.position.set(0, 1.65, 0);
  camera.near = 0.15;
  cardboard.updateAspect();
  controls.avatar.visible = false;

  await cardboard.enable();
  inVR = true;
  
  document.getElementById('intro').style.display = 'none';
  document.getElementById('hud').classList.remove('hidden');
  setReticleDisplay('block');
  document.getElementById('crosshair').classList.add('hidden');
  
  const exitBtn = document.getElementById('exit-btn');
  exitBtn.textContent = '✕ Wyjdź z VR';
  exitBtn.classList.remove('hidden');
}

function exitVR() {
  cardboard.disable();
  inVR = false;
  controls.player.set(rig.position.x, 0, rig.position.z);
  rig.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  setReticleDisplay('none');
  document.getElementById('crosshair').classList.remove('hidden');
  document.getElementById('exit-btn').textContent = '✕ Wyjdź';
}

async function cycleViewMode() {
  const sequence = isMobileDevice ? ['fpp', 'tpp', 'vr'] : ['fpp', 'tpp'];
  const current = inVR ? 'vr' : controls.mode;
  const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];

  if (next === 'vr') {
    if (!inVR) await enterVR();
  } else {
    if (inVR) exitVR();
    controls.setMode(next);
  }
}
document.getElementById('toggle-mode').addEventListener('click', () => cycleViewMode());

vrBtn.addEventListener('click', () => {
  if (vrBtn.disabled) return;
  enterVR(new THREE.Vector3(loungeX, 0, 0));
});

document.getElementById('exit-btn').addEventListener('click', () => exitToIntro());

function exitToIntro() {
  if (inVR) exitVR();
  
  document.getElementById('exit-btn').classList.add('hidden');
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  document.getElementById('joystick-base').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  
  // Przywróć ekran startowy
  document.getElementById('intro').style.display = 'flex';
  renderer.domElement.style.display = 'none';
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') exitToIntro();
});
