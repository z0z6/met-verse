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
let baseScaleFactor = 1; // skala normalizująca model do MODEL_TARGET_SIZE, wyliczana raz po wczytaniu

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

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
  mountEl.appendChild(renderer.domElement);

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

      gltf.scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          const edges = new THREE.EdgesGeometry(child.geometry, EDGE_ANGLE_THRESHOLD);
          const lineSegments = new THREE.LineSegments(edges, lineMaterial);
          lineSegments.applyMatrix4(child.matrixWorld);
          modelGroup.add(lineSegments);
        }
      });

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

  if (key === 'gridEnabled' && gridMesh) gridMesh.visible = value;
  if (gridMaterial) {
    if (key === 'gridDensity') gridMaterial.uniforms.uDensity.value = value;
    if (key === 'gridThickness') gridMaterial.uniforms.uThickness.value = value;
    if (key === 'gridColor') gridMaterial.uniforms.uColor.value = new THREE.Color(value);
    if (key === 'gridSpeedX') gridMaterial.uniforms.uSpeed.value.x = value / 1000;
    if (key === 'gridSpeedY') gridMaterial.uniforms.uSpeed.value.y = value / 1000;
  }
}

function onResize() {
  if (!mountEl || !camera || !renderer) return;
  camera.aspect = mountEl.clientWidth / mountEl.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
}

function animate() {
  animId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  time += delta;

  if (gridMaterial && Config.get('gridEnabled')) gridMaterial.uniforms.uTime.value = time;

  // Rotacja: kierunek (Prawo/Lewo z panelu) + prędkość (rad/s)
  const speed = Config.get('rotationSpeed');
  const dir = Config.get('rotationDirection');
  if (modelGroup) modelGroup.rotation.y -= dir * speed * delta;

  renderer.render(scene, camera);
}

export function destroy() {
  if (animId) cancelAnimationFrame(animId);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('configchange', onConfigChange);
  if (renderer) renderer.dispose();
}
