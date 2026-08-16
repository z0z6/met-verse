import * as THREE from 'three';
import { buildGallery, DOOR_TRIGGERS, SPAWN_POINTS } from './room.js';
import { loadArtworks } from './artworks.js';
import { GalleryControls } from './controls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f3ef);
scene.fog = new THREE.Fog(0xf5f3ef, 15, 50);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

/* --- MANUALNY PRZYCISK VR --- */
const vrBtn = document.createElement('button');
vrBtn.id = 'vr-toggle';
vrBtn.textContent = 'Wejdź w VR';
vrBtn.className = 'hud-btn';
vrBtn.style.top = '16px';
vrBtn.style.right = '140px';
document.body.appendChild(vrBtn);

vrBtn.addEventListener('click', async () => {
  if (!navigator.xr) {
    alert('Twoja przeglądarka nie obsługuje WebXR. Użyj Chrome na Androidzie lub Quest Browser.');
    return;
  }
  if (renderer.xr.isPresenting) {
    await renderer.xr.getSession().end();
  } else {
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor']
      });
      await renderer.xr.setSession(session);
    } catch (e) {
      console.error('VR error:', e);
      alert('Nie udało się uruchomić VR: ' + e.message);
    }
  }
});

const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);

const { floors } = buildGallery(scene);
loadArtworks(scene).then(list => { interactiveArtworks = list; });
let interactiveArtworks = [];

const controls = new GalleryControls(camera, renderer.domElement, scene);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
let inXR = false;
let dwell = 0;
const TELEPORT_DWELL = 1.5;

renderer.xr.addEventListener('sessionstart', () => {
  vrBtn.textContent = 'Wyjdź z VR';
  inXR = true;
  rig.position.set(controls.player.x, 0, controls.player.z);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  document.getElementById('reticle-ring').style.display = 'block';
});
renderer.xr.addEventListener('sessionend', () => {
  vrBtn.textContent = 'Wejdź w VR';
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
    const hits = raycaster.intersectObjects(floors);
    if (hits.length) {
      dwell += dt;
      fill.style.height = Math.min(100, (dwell / TELEPORT_DWELL) * 100) + '%';
      if (dwell >= TELEPORT_DWELL) {
        const p = hits[0].point;
        rig.position.set(p.x, 0, p.z);
        dwell = 0;
        fill.style.height = '0%';
      }
      return;
    }
  }
  dwell = 0;
  fill.style.height = '0%';
}

function checkDoorTriggers() {
  const pos = inXR ? rig.position : controls.player;
  for (const trigger of DOOR_TRIGGERS) {
    if (trigger.pos.distanceTo(pos) < 1.8) {
      const target = SPAWN_POINTS[trigger.to];
      if (inXR) rig.position.copy(target);
      else controls.player.copy(target);
      return;
    }
  }
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
  checkDoorTriggers();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* --- UI start --- */
function startExperience(mode) {
  controls.setMode(mode);
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  renderer.domElement.requestPointerLock();
}
document.getElementById('start-fpp').addEventListener('click', () => startExperience('fpp'));
document.getElementById('start-tpp').addEventListener('click', () => startExperience('tpp'));
document.getElementById('toggle-mode').addEventListener('click', () => controls.toggleMode());