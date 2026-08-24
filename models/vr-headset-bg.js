// js/vr-headset-bg.js
// ---------------------------------------------------------------
// Tło: gogle VR jako czarny wireframe (zbudowany z prawdziwego
// modelu .glb przez GLTFLoader + EdgesGeometry), przechylone i
// powoli obracające się. W pełni sterowane przez Config
// (js/config.js) — kolor tła, kierunek/kąt wychylenia, skala,
// rotacja (kierunek + prędkość) oraz siatka w tle (włącz/wyłącz,
// kolor, zagęszczenie, grubość linii, prędkość X/Y).
//
// Podpina się pod istniejący #canvas-container z index.html.
// Korzysta z importmapu już zdefiniowanego w index.html:
//   "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
//   "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
// ---------------------------------------------------------------

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Config } from "./config.js";

const LINE_COLOR = 0x000000;
const LINE_OPACITY = 0.85;
const EDGE_ANGLE_THRESHOLD = 15;
const MODEL_TARGET_SIZE = 2.4;
const MODEL_URL = "./models/vr-headset.glb";

// Proste wykrycie telefonu/słabszego GPU — ograniczamy wtedy rozdzielczość
// renderowania, wyłączamy antyaliasing i przycinamy FPS, żeby obrót
// modelu nie przycinał się na Androidzie.
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
const MAX_PIXEL_RATIO = IS_MOBILE ? 1 : 2;
const TARGET_FPS = IS_MOBILE ? 30 : 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
// Telefon rysuje tło w mniejszej rozdzielczości wewnętrznej (canvas jest
// mimo to rozciągnięty przez CSS na cały ekran) — mniej pikseli do
// zacieniowania w shaderze siatki i linii gogli = mniej pracy dla GPU.
// Okno wyboru widoku (#intro) jest zwykłym DOM-em, więc jego rozmiar
// się nie zmienia — skaluje się wyłącznie renderowane tło 3D.
const RENDER_SCALE = IS_MOBILE ? 0.6 : 1;

// --- Shader siatki w tle (ten sam efekt co w poprzednim panelu admina) ---
const GRID_VERTEX = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const GRID_FRAGMENT = `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uDensity;
    uniform float uThickness;
    uniform vec3 uColor;
    uniform vec2 uSpeed;

    void main() {
        vec2 uv = vUv * uDensity + (uTime * uSpeed);
        vec2 grid = abs(fract(uv - 0.5) - 0.5) / fwidth(uv);
        float line = min(grid.x, grid.y);
        float alpha = 1.0 - min(line * (1.0 / max(uThickness, 0.01)), 1.0);
        float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) *
                         smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        gl_FragColor = vec4(uColor, alpha * 0.4 * edgeFade);
    }
`;

let mountEl, scene, camera, renderer;
let rig, modelGroup;
let gridMesh, gridMaterial;
let animId, clock, time = 0;
let lastFrameTime = 0;
let baseScaleFactor = 1; // skala normalizująca model do MODEL_TARGET_SIZE, wyliczana raz po wczytaniu

// Wartości odczytywane co klatkę w animate() cache'ujemy w zmiennych
// zamiast wołać Config.get() (czyli localStorage.getItem) 30-60x/s —
// to odczuwalnie odciąża główny wątek JS na słabszych telefonach.
let cachedRotationSpeed = 0;
let cachedRotationDirection = 1;
let cachedGridEnabled = true;

export function init(containerId = "canvas-container") {
  mountEl = document.getElementById(containerId);
  if (!mountEl) {
    console.error(`vr-headset-bg: nie znaleziono #${containerId}`);
    return;
  }

  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(
    35,
    mountEl.clientWidth / mountEl.clientHeight,
    0.01,
    100
  );
  camera.position.set(0, 0, 4.2);

  renderer = new THREE.WebGLRenderer({
    antialias: !IS_MOBILE,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  mountEl.appendChild(renderer.domElement);
  // Canvas ma zawsze wypełniać kontener wizualnie (przez CSS), niezależnie
  // od tego, w jak małej rozdzielczości faktycznie rysujemy bufor — dzięki
  // temu zmniejszenie RENDER_SCALE nie zmienia widocznego rozmiaru tła.
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  applyRendererSize();

  buildGrid();

  rig = new THREE.Group();
  scene.add(rig);
  applyTilt();

  modelGroup = new THREE.Group();
  rig.add(modelGroup);

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: LINE_COLOR,
        transparent: true,
        opacity: LINE_OPACITY,
      });

      // Zbieramy krawędzie wszystkich części modelu do JEDNEJ geometrii,
      // żeby całe gogle rysowały się w jednym draw call. Osobny LineSegments
      // per część modelu (jak w wersji bez optymalizacji) mnoży liczbę
      // wywołań renderowania i to właśnie ono najbardziej przycina się
      // na słabszych GPU w telefonach.
      const mergedPositions = [];
      const v = new THREE.Vector3();

      gltf.scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          const edges = new THREE.EdgesGeometry(child.geometry, EDGE_ANGLE_THRESHOLD);
          const posAttr = edges.getAttribute('position');
          child.updateWorldMatrix(true, false);
          for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i).applyMatrix4(child.matrixWorld);
            mergedPositions.push(v.x, v.y, v.z);
          }
          edges.dispose();
        }
      });

      const mergedGeometry = new THREE.BufferGeometry();
      mergedGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(mergedPositions, 3)
      );
      const lineSegments = new THREE.LineSegments(mergedGeometry, lineMaterial);
      modelGroup.add(lineSegments);

      const box = new THREE.Box3().setFromObject(modelGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      baseScaleFactor = MODEL_TARGET_SIZE / maxDim;

      modelGroup.position.sub(center.multiplyScalar(baseScaleFactor));
      applyScale();
    },
    undefined,
    (err) => console.error("vr-headset-bg: błąd wczytywania modelu:", err)
  );

  window.addEventListener("resize", onResize);
  window.addEventListener("configchange", onConfigChange);

  cachedRotationSpeed = Config.get('rotationSpeed');
  cachedRotationDirection = Config.get('rotationDirection');
  cachedGridEnabled = Config.get('gridEnabled');

  clock = new THREE.Clock();
  animate();
}

function buildGrid() {
  const geometry = new THREE.PlaneGeometry(40, 40);
  gridMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: Config.get('gridDensity') },
      uThickness: { value: Config.get('gridThickness') },
      uColor: { value: new THREE.Color(Config.get('gridColor')) },
      uSpeed: { value: new THREE.Vector2(Config.get('gridSpeedX') / 1000, Config.get('gridSpeedY') / 1000) }
    },
    vertexShader: GRID_VERTEX,
    fragmentShader: GRID_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  gridMesh = new THREE.Mesh(geometry, gridMaterial);
  gridMesh.position.z = -8;
  gridMesh.visible = Config.get('gridEnabled');
  scene.add(gridMesh);
}

// Kierunek i kąt wychylenia gogli (ten sam schemat co w poprzednim panelu admina)
function applyTilt() {
  if (!rig) return;
  const tiltDir = Config.get('tiltDirection');
  const tiltAngle = Config.get('tiltAngle');
  const angle = THREE.MathUtils.degToRad(tiltAngle);
  rig.rotation.x = 0;
  rig.rotation.z = 0;
  switch (tiltDir) {
    case 'front-right': rig.rotation.z = -angle; break;
    case 'front-left': rig.rotation.z = angle; break;
    case 'back-right': rig.rotation.x = angle; break;
    case 'back-left': rig.rotation.x = -angle; break;
  }
}

// Skala = normalizacja rozmiaru modelu * mnożnik użytkownika z panelu
function applyScale() {
  if (!modelGroup) return;
  const userScale = Config.get('scale');
  modelGroup.scale.setScalar(baseScaleFactor * userScale);
}

function onConfigChange(e) {
  const { key, value } = e.detail;

  if (key === 'bgColor') document.body.style.background = Config.get('bgColor');
  if (key === 'tiltDirection' || key === 'tiltAngle') applyTilt();
  if (key === 'scale') applyScale();

  if (key === 'gridEnabled' && gridMesh) { gridMesh.visible = value; cachedGridEnabled = value; }
  if (key === 'rotationSpeed') cachedRotationSpeed = value;
  if (key === 'rotationDirection') cachedRotationDirection = value;
  if (gridMaterial) {
    if (key === 'gridDensity') gridMaterial.uniforms.uDensity.value = value;
    if (key === 'gridThickness') gridMaterial.uniforms.uThickness.value = value;
    if (key === 'gridColor') gridMaterial.uniforms.uColor.value = new THREE.Color(value);
    if (key === 'gridSpeedX') gridMaterial.uniforms.uSpeed.value.x = value / 1000;
    if (key === 'gridSpeedY') gridMaterial.uniforms.uSpeed.value.y = value / 1000;
  }
}

function applyRendererSize() {
  if (!mountEl || !camera || !renderer) return;
  const w = mountEl.clientWidth;
  const h = mountEl.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // `false` = nie nadpisuj CSS width/height canvasu (ustawiliśmy je ręcznie
  // na 100%) — wewnętrzny bufor rysowania jest mniejszy niż ekran,
  // przeglądarka go tylko skaluje, co jest dużo tańsze niż rysowanie
  // każdego piksela ekranu.
  renderer.setSize(w * RENDER_SCALE, h * RENDER_SCALE, false);
}

function onResize() {
  applyRendererSize();
}

function animate(now) {
  animId = requestAnimationFrame(animate);

  // Ograniczenie FPS na telefonach: pomijamy klatki zamiast renderować
  // każdą — mniej pracy dla GPU = płynniejszy obrót zamiast przycinania.
  if (now !== undefined) {
    const elapsed = now - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) return;
    lastFrameTime = now - (elapsed % FRAME_INTERVAL);
  }

  const delta = clock.getDelta();
  time += delta;

  if (gridMaterial && cachedGridEnabled) gridMaterial.uniforms.uTime.value = time;

  // Rotacja: kierunek (Prawo/Lewo z panelu) + prędkość (rad/s)
  if (modelGroup) modelGroup.rotation.y -= cachedRotationDirection * cachedRotationSpeed * delta;

  renderer.render(scene, camera);
}

export function destroy() {
  if (animId) cancelAnimationFrame(animId);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('configchange', onConfigChange);
  if (renderer) renderer.dispose();
}
