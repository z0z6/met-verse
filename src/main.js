import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// --- INICJALIZACJA SCENY I RENDERERA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 0); // Wysokość wzroku gracza (1.6m)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true; // Włączenie obsługi VR (WebXR)
document.body.appendChild(renderer.domElement);

// Przycisk aktywacji WebXR / VR
const vrContainer = document.getElementById('vr-button-container');
if (vrContainer) {
  vrContainer.appendChild(VRButton.createButton(renderer));
}

// --- OŚWIETLENIE ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.5);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(3, 10, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- TWORZENIE GALERII (PODŁOGA I ŚCIANY - KOLEKCJA KOLIZYJNA) ---
const collidableObjects = [];

// Podłoga
const floorGeometry = new THREE.PlaneGeometry(30, 30);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
collidableObjects.push(floor);

// Tworzenie ścian wokół pokoju
function createWall(x, z, width, depth) {
  const wallGeo = new THREE.BoxGeometry(width, 4, depth);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(x, 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  collidableObjects.push(wall);
}

// Ściany zewnętrzne
createWall(0, -15, 30, 0.5); // Północ
createWall(0, 15, 30, 0.5);  // Południe
createWall(-15, 0, 0.5, 30); // Zachód
createWall(15, 0, 0.5, 30);  // Wschód

// --- STEROWANIE FPP ---
const controls = new PointerLockControls(camera, document.body);

const startFppBtn = document.getElementById('start-fpp');
if (startFppBtn) {
  startFppBtn.addEventListener('click', () => {
    controls.lock();
  });
}

controls.addEventListener('lock', () => {
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
});

controls.addEventListener('unlock', () => {
  document.getElementById('intro').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
});

// --- STAN KLAWIATURY ---
const moveState = { forward: false, backward: false, left: false, right: false, run: false };

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': moveState.forward = true; break;
    case 'KeyS': case 'ArrowDown': moveState.backward = true; break;
    case 'KeyA': case 'ArrowLeft': moveState.left = true; break;
    case 'KeyD': case 'ArrowRight': moveState.right = true; break;
    case 'ShiftLeft': case 'ShiftRight': moveState.run = true; break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': moveState.forward = false; break;
    case 'KeyS': case 'ArrowDown': moveState.backward = false; break;
    case 'KeyA': case 'ArrowLeft': moveState.left = false; break;
    case 'KeyD': case 'ArrowRight': moveState.right = false; break;
    case 'ShiftLeft': case 'ShiftRight': moveState.run = false; break;
  }
});

// --- SYSTEM KOLIZJI I FIZYKI ---
const raycaster = new THREE.Raycaster();
const playerRadius = 0.6; // Bezpieczny promień gracza od ściany
const clock = new THREE.Clock();

function checkWallCollision(newPosition) {
  // Sprawdzanie promieni w 4 głównych kierunkach poziomu
  const directions = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1)
  ];

  for (const dir of directions) {
    raycaster.set(newPosition, dir);
    const intersections = raycaster.intersectObjects(collidableObjects);
    if (intersections.length > 0 && intersections[0].distance < playerRadius) {
      return true; // Wykryto kolizję ze ścianą
    }
  }
  return false;
}

// --- PĘTLA RENDEROWANIA (DZIAŁA POPRAWNIE Z VR I NON-VR) ---
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();

  if (controls.isLocked) {
    const speed = (moveState.run ? 7.0 : 3.5) * delta;
    
    // Obliczenie wektorów kierunku
    const frontVector = new THREE.Vector3(0, 0, 0);
    const sideVector = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3();

    // POPRAWKA KIERUNKU: W = Ruch do przodu (-Z), S = Ruch do tyłu (+Z)
    frontVector.set(0, 0, Number(moveState.backward) - Number(moveState.forward));
    sideVector.set(Number(moveState.right) - Number(moveState.left), 0, 0);

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(speed)
      .applyEuler(camera.rotation);
    
    // Zablokowanie poruszania się w pionie Y przy zwykłym chodzeniu
    direction.y = 0;

    // Propozycja nowej pozycji
    const targetPosition = camera.position.clone().add(direction);

    // Sprawdzenie kolizji przed wykonaniem kroku
    if (!checkWallCollision(targetPosition)) {
      camera.position.copy(targetPosition);
    }

    // Utrzymywanie stałej wysokości wzroku nad podłogą (brak wypadania pod mapę)
    camera.position.y = 1.6;
  }

  renderer.render(scene, camera);
});

// --- RESIZE OKNA ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
