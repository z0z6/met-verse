import * as THREE from 'three';
import { buildRoom, ROOM_HEIGHT } from './room.js';
import { loadArtworks } from './artworks.js';
import {
  buildLoungeSet, buildCornerSofa, buildCoffeeTable,
  buildPottedPlant, buildBushyPlant, buildBench, buildBonsai, buildLamellaJamb, buildLamellaReveal,
} from './furniture.js';
import { ROOMS, OBSTACLES, resolveCollision, crossesSolidWall, DEPTH, PARTITIONS, DOOR_HALF_WIDTH, WALL_THICKNESS, BOUNDS } from './collision.js';
import { GalleryControls } from './controls.js';
import { CardboardMode } from './cardboard.js';
import { getActiveGamepad, applyGamepadMovement } from './gamepad.js';
import { initMobileControls } from './mobileControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111114);
scene.fog = new THREE.Fog(0x111114, 14, 34);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const isMobileDevice = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
if (isMobileDevice) {
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;
}

document.body.appendChild(renderer.domElement);
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

// Stolik kawowy
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

// Donica z draceną (sala zachodnia)
{
  const plantX = westCenterX + rugHalfW - SOFA_GAP;
  const plantZ = rugHalfD - SOFA_GAP;
  buildBushyPlant(scene, plantX, plantZ);
  OBSTACLES.push({ x: plantX, z: plantZ, radius: 0.5 });
}

// Donica z draceną (sala główna)
buildPottedPlant(scene, loungeX + 1.55, -1.75);
OBSTACLES.push({ x: loungeX + 1.55, z: -1.75, radius: 0.45 });

// Sala wschodnia: ławeczka + bonsai
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

// Lamele na futrynach
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

const vrBtn = document.getElementById('start-vr');
if (!isMobileDevice) {
  vrBtn.disabled = true;
  vrBtn.classList.add('long-label');
  vrBtn.querySelector('span').textContent = 'VR dostępne tylko w urządzeniach mobilnych';
}

// Wall boundaries for camera clamping in VR
const WALL_MARGIN = 0.3;
const MIN_X = BOUNDS.minX + WALL_MARGIN;
const MAX_X = BOUNDS.maxX - WALL_MARGIN;
const MIN_Z = -DEPTH/2 + WALL_MARGIN;
const MAX_Z = DEPTH/2 - WALL_MARGIN;

// Safe teleportation with improved collision checking
function updateGazeTeleport(dt) {
  const dir = new THREE.Vector3();
  const origin = new THREE.Vector3();
  camera.getWorldDirection(dir);
  camera.getWorldPosition(origin);
  const fill = document.getElementById('reticle-fill');

  if (dir.y < -0.15) {
    raycaster.set(origin, dir);
    const hits = raycaster.intersectObject(floorMesh);
    if (hits.length) {
      dwell += dt;
      fill.style.height = Math.min(100, (dwell / TELEPORT_DWELL) * 100) + '%';
      if (dwell >= TELEPORT_DWELL) {
        const targetPoint = hits[0].point.clone();
        const PLAYER_VR_RADIUS = 0.55;

        resolveCollision(targetPoint, PLAYER_VR_RADIUS, 1.0);

        // Check intermediate positions for wall collisions
        const tempVec = new THREE.Vector3();
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          tempVec.lerpVectors(rig.position, targetPoint, t);
          resolveCollision(tempVec, PLAYER_VR_RADIUS, 1.0);
        }

        if (!crossesSolidWall(rig.position, targetPoint, PLAYER_VR_RADIUS)) {
          rig.position.copy(targetPoint);
          resolveCollision(rig.position, PLAYER_VR_RADIUS, 1.0);
        }

        dwell = 0;
        fill.style.height = '0%';
      }
      return;
    }
  }
  dwell = 0;
  fill.style.height = '0%';
}

function updateCaption() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = new THREE.Vector3();
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

// Camera boundary clamping in VR mode
function clampCameraInVR() {
  const cameraWorldPos = new THREE.Vector3();
  camera.getWorldPosition(cameraWorldPos);

  cameraWorldPos.x = Math.max(MIN_X, Math.min(MAX_X, cameraWorldPos.x));
  cameraWorldPos.z = Math.max(MIN_Z, Math.min(MAX_Z, cameraWorldPos.z));

  const cameraDir = new THREE.Vector3();
  camera.getWorldDirection(cameraDir);
  const WALL_DISTANCE = 0.8;

  const walls = [
    { normal: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(0, 0, DEPTH/2) },
    { normal: new THREE.Vector3(0, 0, -1), point: new THREE.Vector3(0, 0, -DEPTH/2) },
    { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3(BOUNDS.maxX, 0, 0) },
    { normal: new THREE.Vector3(-1, 0, 0), point: new THREE.Vector3(BOUNDS.minX, 0, 0) }
  ];

  for (const wall of walls) {
    const dist = cameraDir.dot(wall.normal);
    if (dist > 0.7) {
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(wall.normal, wall.point);
      const distToWall = plane.distanceToPoint(cameraWorldPos);
      if (distToWall < WALL_DISTANCE) {
        const offset = new THREE.Vector3().copy(wall.normal)
          .multiplyScalar(WALL_DISTANCE - distToWall);
        cameraWorldPos.add(offset);
      }
    }
  }

  camera.position.copy(cameraWorldPos.clone().sub(rig.position));
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (inVR) {
    resolveCollision(rig.position, 0.55, 1.0);
    clampCameraInVR();

    const gp = getActiveGamepad();
    const reticle = document.getElementById('reticle-ring');
    if (gp) {
      applyGamepadMovement(gp, camera, rig, dt, 2.4, (pos, r) => resolveCollision(pos, Math.max(r, 0.55), 1.0));
      dwell = 0;
      document.getElementById('reticle-fill').style.height = '0%';
      reticle.style.display = 'none';
    } else {
      reticle.style.display = 'block';
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

function startExperience(mode) {
  renderer.domElement.style.display = 'block';

  controls.setMode(mode);
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');

  if (isMobileDevice) {
    document.getElementById('joystick-base').classList.remove('hidden');
    document.getElementById('exit-metaverse').classList.remove('hidden');
  } else {
    renderer.domElement.requestPointerLock();
  }
}

document.getElementById('start-fpp').addEventListener('click', () => startExperience('fpp'));
document.getElementById('start-tpp').addEventListener('click', () => startExperience('tpp'));
document.getElementById('toggle-mode').addEventListener('click', () => controls.toggleMode());

if (isMobileDevice) initMobileControls(controls);

vrBtn.addEventListener('click', async () => {
  if (vrBtn.disabled) return;

  renderer.domElement.style.display = 'block';

  const vrStart = new THREE.Vector3(loungeX, 0, 0);
  resolveCollision(vrStart, 0.55, 1.0);
  rig.position.copy(vrStart);

  rig.position.y = 0;

  camera.position.set(0, 1.65, 0);
  camera.near = 0.15;
  cardboard.updateAspect();

  await cardboard.enable();
  inVR = true;
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('reticle-ring').style.display = 'block';
  document.getElementById('exit-vr').classList.remove('hidden');
});

// UNIVERSAL EXIT FUNCTION - works in all modes
document.getElementById('exit-metaverse').addEventListener('click', () => exitToIntro());
document.getElementById('exit-vr').addEventListener('click', () => exitToIntro());

function exitToIntro() {
  const intro = document.getElementById('intro');
  if (!intro.classList.contains('hidden')) return;

  if (inVR) {
    cardboard.disable();
    inVR = false;
    controls.player.set(rig.position.x, 0, rig.position.z);
    rig.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    document.getElementById('reticle-ring').style.display = 'none';
    document.getElementById('exit-vr').classList.add('hidden');
  }

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }

  document.getElementById('joystick-base').classList.add('hidden');
  document.getElementById('exit-metaverse').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  intro.classList.remove('hidden');
  renderer.domElement.style.display = 'none';
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') exitToIntro();
});

// Back button on mobile to exit
history.pushState(null, null, window.location.href);
window.addEventListener('popstate', () => {
  if (!document.getElementById('intro').classList.contains('hidden')) return;
  exitToIntro();
});
