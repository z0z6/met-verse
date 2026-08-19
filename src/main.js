import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildRoom, ROOM_HEIGHT } from './room.js';
import { loadArtworks } from './artworks.js';
import {
  buildLoungeSet, buildCornerSofa, buildCoffeeTable,
  buildPottedPlant, buildBushyPlant, buildBench, buildBonsai, buildLamellaJamb, buildLamellaReveal,
} from './furniture.js';
import { ROOMS, OBSTACLES, resolveCollision, DEPTH, PARTITIONS, DOOR_HALF_WIDTH, WALL_THICKNESS } from './collision.js';
import { GalleryControls } from './controls.js';
import { CardboardMode } from './cardboard.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111114);
scene.fog = new THREE.Fog(0x111114, 14, 34);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

// Rig gracza — w VR headset steruje kamerą lokalnie, a my przesuwamy rig (teleportacja).
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);

const { floorMesh } = buildRoom(scene);
const mainRoom = ROOMS[1];
const loungeX = (mainRoom.minX + mainRoom.maxX) / 2;
buildLoungeSet(scene, loungeX, 0);
OBSTACLES.push({ x: loungeX, z: -0.4, radius: 2.1 });

// Kanapa narożna w sali zachodniej — zbliżona do rogu dywanika, krawędzie
// równoległe do jego krawędzi, w odległości równej długości boczków (podłokietników, D = 0,85 m).
const westRoom = ROOMS[0];
const westCenterX = (westRoom.minX + westRoom.maxX) / 2;
const ARM_A = 4, ARM_B = 4;
const rugHalfW = (westRoom.maxX - westRoom.minX) * 0.5 / 2; // połowa szerokości dywanika
const rugHalfD = DEPTH * 0.45 / 2; // połowa głębokości dywanika
const SOFA_GAP = 0.85; // = długość boczków (podłokietników)
const sofaX = westCenterX - rugHalfW + SOFA_GAP;
const sofaZ = -rugHalfD + SOFA_GAP;
const { group: sofaGroup, footprint } = buildCornerSofa(scene, sofaX, sofaZ, ARM_A, ARM_B);
OBSTACLES.push(
  { x: sofaX + footprint.depth / 2, z: sofaZ + footprint.depth / 2, radius: footprint.depth / 2 + 0.15 },
  { x: sofaX + footprint.depth + (footprint.armA - footprint.depth) / 2, z: sofaZ + footprint.depth / 2, radius: (footprint.armA - footprint.depth) / 2 + 0.5 },
  { x: sofaX + footprint.depth / 2, z: sofaZ + footprint.depth + (footprint.armB - footprint.depth) / 2, radius: (footprint.armB - footprint.depth) / 2 + 0.5 }
);

// Stolik kawowy — obrócony o 90° (dłuższa krawędź równoległa do wewnętrznej
// krawędzi skrzydła B), wydłużony tak, żeby krótsza krawędź kończyła się
// tam, gdzie kończy się boczek sofy, i powiększony o 50% w krótszej krawędzi.
{
  const D = footprint.depth, EPS = 0.02, nearGap = 0.3;
  const tableShort = 0.6 * 1.5; // +50% w krótszej krawędzi
  const extraGap = tableShort / 4; // dodatkowe odsunięcie od krawędzi sofy — 1/4 krótszej krawędzi stolika
  const tableLongStart = D + nearGap;
  const tableLongEnd = footprint.armB + EPS; // = koniec boczka B
  const tableLong = tableLongEnd - tableLongStart;
  const westTable = buildCoffeeTable(tableLong, tableShort);
  westTable.rotation.y = Math.PI / 2;
  westTable.position.set(D + nearGap + extraGap + tableShort / 2, 0, (tableLongStart + tableLongEnd) / 2);
  sofaGroup.add(westTable);
  const tWorldX = sofaX + D + nearGap + extraGap + tableShort / 2;
  const tWorldZ = sofaZ + (tableLongStart + tableLongEnd) / 2;
  OBSTACLES.push({ x: tWorldX, z: tWorldZ, radius: Math.max(tableShort, 0.4) / 2 + 0.15 });
}

// Donica z draceną (wariant rozłożysty) — w przeciwległym rogu dywanika,
// odsunięta od jego krawędzi tak samo jak sofa.
{
  const plantX = westCenterX + rugHalfW - SOFA_GAP;
  const plantZ = rugHalfD - SOFA_GAP;
  buildBushyPlant(scene, plantX, plantZ);
  OBSTACLES.push({ x: plantX, z: plantZ, radius: 0.5 });
}

// Donica z draceną w sali głównej — ta sama funkcja, teraz z poprawionym
// zaczepieniem liści (patrz furniture.js) i większą liczbą liści.
buildPottedPlant(scene, loungeX + 1.55, -1.75);
OBSTACLES.push({ x: loungeX + 1.55, z: -1.75, radius: 0.45 });

// --- Sala wschodnia: ławeczka + bonsai ---
{
  const eastRoom = ROOMS[2];
  const eastCenterX = (eastRoom.minX + eastRoom.maxX) / 2;
  const rugHalfWE = (eastRoom.maxX - eastRoom.minX) * 0.5 / 2;
  const rugHalfDE = DEPTH * 0.45 / 2;

  // Ławeczka — długość = połowa długości dywanika, oś symetrii pokrywa się
  // z osią symetrii dywanika (z = 0), przysunięta bliżej drzwi: odległość od
  // krawędzi dywanika = długość bocznej (krótszej, końcowej) krawędzi ławeczki.
  const benchLength = rugHalfWE * 2 * 0.5; // połowa "długości" (szerokości) dywanika
  const benchSideEdge = 0.42; // = głębokość ławeczki (seatD w furniture.js) — jej boczna krawędź
  const benchX = eastCenterX - rugHalfWE + benchSideEdge + benchSideEdge / 2;
  buildBench(scene, benchX, 0, benchLength, Math.PI / 2);
  OBSTACLES.push({
    minX: benchX - benchSideEdge / 2 - 0.1, maxX: benchX + benchSideEdge / 2 + 0.1,
    minZ: -benchLength / 2 - 0.1, maxZ: benchLength / 2 + 0.1,
  });

  // Donica z bonsai — po lewej stronie osoby wchodzącej do sali (od strony
  // sali głównej, patrząc w głąb, czyli po stronie -Z), w rogu dywanika,
  // odsunięta od krawędzi tak samo jak sofa w sali zachodniej.
  const bonsaiX = eastCenterX + rugHalfWE - SOFA_GAP;
  const bonsaiZ = -(rugHalfDE - SOFA_GAP);
  buildBonsai(scene, bonsaiX, bonsaiZ);
  OBSTACLES.push({ x: bonsaiX, z: bonsaiZ, radius: 0.65 });
}

// --- Lamele na futrynach obu przejść (od podłogi do sufitu, obie strony ściany
// + wewnętrzna powierzchnia framugi, żeby lamele łączyły się w rogach) ---
{
  const LAMELLA_DEPTH = footprint.depth; // = długość (krótszego) boczka sofy, 0.85 m
  const LAMELLA_SLAT_T = 0.08; // = grubość zagłówków z sofy
  const LAMELLA_DARK = 0x2a1e16; // = kolor krawędzi stolika
  const LAMELLA_LIGHT = 0x94743f; // = kolor dywaników
  for (const px of PARTITIONS) {
    for (const xDir of [-1, 1]) {
      const wallX = px + xDir * (WALL_THICKNESS / 2);
      for (const zDir of [-1, 1]) {
        const doorEdgeZ = zDir * DOOR_HALF_WIDTH;
        buildLamellaJamb(scene, wallX, doorEdgeZ, zDir, xDir, LAMELLA_DEPTH, ROOM_HEIGHT, LAMELLA_SLAT_T, LAMELLA_DARK, LAMELLA_LIGHT);
      }
    }
    // Łącznik — wewnętrzna powierzchnia framugi w grubości ściany, żeby lamele
    // ze ścian po obu stronach wizualnie się łączyły zamiast urywać na gołym murze
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
let inXR = false;
let dwell = 0;
const TELEPORT_DWELL = 1.5;

const cardboard = new CardboardMode(renderer, camera);
let inCardboard = false;

// --- Przycisk VR: wbudowujemy natywny VRButton (rozpoznaje wsparcie WebXR)
// w ekran startowy, zamiast pozwalać mu doczepiać się automatycznie do body.
const vrBtn = VRButton.createButton(renderer);
vrBtn.id = 'vr-btn';
vrBtn.classList.add('mode-btn');
document.getElementById('intro-buttons').appendChild(vrBtn);

renderer.xr.addEventListener('sessionstart', () => {
  inXR = true;
  rig.position.set(controls.player.x, 0, controls.player.z);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('reticle-ring').style.display = 'block';
});
renderer.xr.addEventListener('sessionend', () => {
  inXR = false;
  controls.player.set(rig.position.x, 0, rig.position.z);
  rig.position.set(0, 0, 0);
  document.getElementById('reticle-ring').style.display = 'none';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('intro').classList.remove('hidden');
});

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
        const p = hits[0].point.clone();
        resolveCollision(p, 0.45);
        rig.position.x = p.x;
        rig.position.z = p.z;
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

function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (inXR) {
    updateGazeTeleport(dt);
    renderer.render(scene, camera);
  } else if (inCardboard) {
    updateGazeTeleport(dt);
    cardboard.render(scene);
  } else {
    controls.update(dt);
    updateCaption();
    renderer.render(scene, camera);
  }
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- UI: ekran startowy ---
function startExperience(mode) {
  controls.setMode(mode);
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  renderer.domElement.requestPointerLock();
}
document.getElementById('start-fpp').addEventListener('click', () => startExperience('fpp'));
document.getElementById('start-tpp').addEventListener('click', () => startExperience('tpp'));
document.getElementById('toggle-mode').addEventListener('click', () => controls.toggleMode());

document.getElementById('start-cardboard').addEventListener('click', async () => {
  rig.position.set(controls.player.x, 0, controls.player.z);
  camera.position.set(0, 0, 0);
  await cardboard.enable();
  inCardboard = true;
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('reticle-ring').style.display = 'block';
  document.getElementById('exit-cardboard').classList.remove('hidden');
});

document.getElementById('exit-cardboard').addEventListener('click', () => {
  cardboard.disable();
  inCardboard = false;
  controls.player.set(rig.position.x, 0, rig.position.z);
  rig.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  document.getElementById('reticle-ring').style.display = 'none';
  document.getElementById('exit-cardboard').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('intro').classList.remove('hidden');
});
