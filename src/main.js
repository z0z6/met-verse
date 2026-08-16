import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildRoom, ROOM } from './room.js';
import { loadArtworks } from './artworks.js';
import { GalleryControls } from './controls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111114);
scene.fog = new THREE.Fog(0x111114, 12, 28);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Rig gracza — w VR headset steruje kamerą lokalnie, a my przesuwamy rig (teleportacja).
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);

const { floorMesh } = buildRoom(scene);
loadArtworks(scene).then(list => { interactiveArtworks = list; });
let interactiveArtworks = [];

const controls = new GalleryControls(camera, renderer.domElement, scene);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
let inXR = false;
let dwell = 0;
const TELEPORT_DWELL = 1.5;

renderer.xr.addEventListener('sessionstart', () => {
  inXR = true;
  rig.position.set(controls.player.x, 0, controls.player.z);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  document.getElementById('reticle-ring').style.display = 'block';
});
renderer.xr.addEventListener('sessionend', () => {
  inXR = false;
  controls.player.set(rig.position.x, 0, rig.position.z);
  rig.position.set(0, 0, 0);
  document.getElementById('reticle-ring').style.display = 'none';
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
        const p = hits[0].point;
        const margin = 0.6;
        rig.position.x = Math.max(-ROOM.width / 2 + margin, Math.min(ROOM.width / 2 - margin, p.x));
        rig.position.z = Math.max(-ROOM.depth / 2 + margin, Math.min(ROOM.depth / 2 - margin, p.z));
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
  const hits = raycaster.intersectObjects(interactiveArtworks.map(g => g).flatMap(g => g.children), false);
  const captionEl = document.getElementById('artwork-caption');
  if (hits.length && hits[0].distance < 6) {
    let group = hits[0].object.parent;
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
  } else {
    controls.update(dt);
    updateCaption();
  }
  renderer.render(scene, camera);
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
