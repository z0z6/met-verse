// js/vr-headset-bg.js
// ---------------------------------------------------------------
// Tło: gogle VR jako czarny wireframe, przechylone o 45°,
// powoli obracające się w prawo. Podpina się pod istniejący
// #canvas-container z index.html (ten sam kontener, którego
// używa dziś js/particles.js).
//
// Korzysta z importmapu już zdefiniowanego w index.html:
//   "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
//   "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
// ---------------------------------------------------------------

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const LINE_COLOR = 0x000000;
const LINE_OPACITY = 0.85;
const ROTATE_SPEED = 0.08;      // rad/s — powoli w prawo
const TILT_DEG = 45;            // przechylenie modelu
const EDGE_ANGLE_THRESHOLD = 15;
const MODEL_TARGET_SIZE = 2.4;
const MODEL_URL = "./models/vr-headset.glb";

export function init(containerId = "canvas-container") {
  const mount = document.getElementById(containerId);
  if (!mount) {
    console.error(`vr-headset-bg: nie znaleziono #${containerId}`);
    return;
  }

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    35,
    mount.clientWidth / mount.clientHeight,
    0.01,
    100
  );
  camera.position.set(0, 0, 4.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  mount.appendChild(renderer.domElement);

  const rig = new THREE.Group();
  scene.add(rig);
  rig.rotation.x = THREE.MathUtils.degToRad(TILT_DEG);

  const modelGroup = new THREE.Group();
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
      const scaleFactor = MODEL_TARGET_SIZE / maxDim;

      modelGroup.position.sub(center.multiplyScalar(scaleFactor));
      modelGroup.scale.setScalar(scaleFactor);
    },
    undefined,
    (err) => console.error("vr-headset-bg: błąd wczytywania modelu:", err)
  );

  function onResize() {
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  }
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    modelGroup.rotation.y -= ROTATE_SPEED * delta;
    renderer.render(scene, camera);
  })();
}
