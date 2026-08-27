import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Config } from "./config.js";

const LINE_COLOR = 0x000000;
const MODEL_TARGET_SIZE = 2.4;
const MODEL_URL = "./models/vr-headset.glb";

const WALLPAPERS = [
    './wallpapers/wallpaper1.jpg',
    './wallpapers/wallpaper2.jpg',
    './wallpapers/wallpaper3.jpg',
    './wallpapers/wallpaper4.jpg',
    './wallpapers/wallpaper5.jpg'
];

const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
const MAX_PIXEL_RATIO = IS_MOBILE ? 1 : 2;
const TARGET_FPS = IS_MOBILE ? 30 : 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const RENDER_SCALE = IS_MOBILE ? 0.5 : 1;
const EDGE_ANGLE_THRESHOLD = IS_MOBILE ? 28 : 15;
const LINE_OPACITY = IS_MOBILE ? 1 : 0.85;

// Na telefonie panel wyboru trybu jest dosunięty do dołu ekranu (patrz
// style.css, @media max-width:640px), więc gogle przesuwamy w górę sceny,
// żeby zostały w górnej części ekranu i nie zachodziły na panel. Wartość
// w jednostkach świata Three.js — dobrana pod kamerę (0,0,4.2) / FOV 35
// z init(). Policzona z realnej geometrii modelu (bounding box po
// przeskalowaniu do MODEL_TARGET_SIZE): bezpieczny margines to ok. 0.61
// (powyżej tego górna krawędź modelu wychodzi poza kadr kamery i się
// przycina) — 0.55 zostawia mały zapas. Tylko mobile — desktop bez zmian.
const MOBILE_MODEL_Y_OFFSET = 0.55;

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
let wallpaperLayer;
let animId, clock, time = 0;
let lastFrameTime = 0;
let baseScaleFactor = 1;

let cachedRotationSpeed = 0;
let cachedRotationDirection = 1;
let cachedGridEnabled = true;

export function init(containerId = "canvas-container", options = {}) {
  const { raiseOnMobile = false } = options;
  mountEl = document.getElementById(containerId);
  if (!mountEl) {
    console.error(`vr-headset-bg: nie znaleziono #${containerId}`);
    return;
  }

  // Ustawiamy kontener jako względny, żeby warstwa tapety mogła być pod canvasem
  mountEl.style.position = 'relative';

  // Tworzymy warstwę tapety (pod canvasem Three.js)
  wallpaperLayer = document.createElement('div');
  wallpaperLayer.id = 'wallpaper-layer';
  wallpaperLayer.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 0;
    transition: opacity 0.4s ease;
  `;
  mountEl.appendChild(wallpaperLayer);

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
  renderer.domElement.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: block;
    z-index: 1;
  `;
  applyRendererSize();

  buildGrid();

  rig = new THREE.Group();
  scene.add(rig);
  applyTilt();
  // Tylko na pełnoekranowym ekranie startowym (index.html) — nie w małym
  // podglądzie Panelu Admina, gdzie te same jednostki świata dałyby
  // przycięty/przesunięty w złym stopniu efekt przy innych proporcjach
  // kontenera.
  if (IS_MOBILE && raiseOnMobile) rig.position.y = MOBILE_MODEL_Y_OFFSET;

  // --- DIAGNOSTYKA TYMCZASOWA (do usunięcia po znalezieniu przyczyny) ---
  // Otwórz na telefonie: podłącz kablem USB do komputera, w komputerowym
  // Chrome wejdź na chrome://inspect, znajdź kartę ze stroną, kliknij
  // "inspect" -> zakładka Console. Powinieneś zobaczyć jedną linijkę
  // zaczynającą się od "[VR-BG diag]" — prześlij mi dokładnie jej treść.
  console.log('[VR-BG diag]', {
    IS_MOBILE, raiseOnMobile,
    'rig.position.y (po ustawieniu)': rig.position.y,
    userAgent: navigator.userAgent,
    innerWidth: window.innerWidth,
    maxTouchPoints: navigator.maxTouchPoints,
    'mountEl.clientWidth/Height': [mountEl.clientWidth, mountEl.clientHeight],
  });

  modelGroup = new THREE.Group();
  rig.add(modelGroup);

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: LINE_COLOR,
        transparent: LINE_OPACITY < 1,
        opacity: LINE_OPACITY,
      });

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

  applyWallpaper();

  startLoop();
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
    side: THREE.FrontSide
  });
  gridMesh = new THREE.Mesh(geometry, gridMaterial);
  gridMesh.position.z = -8;
  gridMesh.visible = Config.get('gridEnabled');
  scene.add(gridMesh);
}

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

function applyScale() {
  if (!modelGroup) return;
  const userScale = Config.get('scale');
  modelGroup.scale.setScalar(baseScaleFactor * userScale);
}

function applyWallpaper() {
  if (!wallpaperLayer) return;
  const enabled = Config.get('wallpaperEnabled');
  const index = Config.get('wallpaperIndex');
  const brightness = Config.get('wallpaperBrightness');
  const blur = Config.get('wallpaperBlur');

  if (enabled) {
    const path = WALLPAPERS[index] || WALLPAPERS[0];
    wallpaperLayer.style.backgroundImage = `url('${path}')`;
    wallpaperLayer.style.opacity = '1';
    wallpaperLayer.style.filter = `brightness(${brightness}) blur(${blur}px)`;
    wallpaperLayer.style.webkitFilter = `brightness(${brightness}) blur(${blur}px)`;
  } else {
    wallpaperLayer.style.opacity = '0';
    wallpaperLayer.style.filter = 'none';
  }
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

  // Tapeta - reagujemy na wszystkie jej parametry
  if (['wallpaperEnabled', 'wallpaperIndex', 'wallpaperBrightness', 'wallpaperBlur'].includes(key)) {
    applyWallpaper();
  }
}

function applyRendererSize() {
  if (!mountEl || !camera || !renderer) return;
  const w = mountEl.clientWidth;
  const h = mountEl.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w * RENDER_SCALE, h * RENDER_SCALE, false);
}

function onResize() {
  applyRendererSize();
}

function renderFrame() {
  const delta = clock.getDelta();
  time += delta;

  if (gridMaterial && cachedGridEnabled) gridMaterial.uniforms.uTime.value = time;

  if (modelGroup) modelGroup.rotation.y -= cachedRotationDirection * cachedRotationSpeed * delta;

  renderer.render(scene, camera);
}

function animate(now) {
  animId = requestAnimationFrame(animate);
  if (now !== undefined) {
    const elapsed = now - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) return;
    lastFrameTime = now - (elapsed % FRAME_INTERVAL);
  }
  renderFrame();
}

function animateMobile() {
  animId = setTimeout(animateMobile, FRAME_INTERVAL);
  renderFrame();
}

function startLoop() {
  clock = new THREE.Clock();
  if (IS_MOBILE) animateMobile();
  else animate();
}

export function destroy() {
  if (animId) { cancelAnimationFrame(animId); clearTimeout(animId); }
  window.removeEventListener('resize', onResize);
  window.removeEventListener('configchange', onConfigChange);
  if (wallpaperLayer) wallpaperLayer.remove();
  if (renderer) renderer.dispose();
}
