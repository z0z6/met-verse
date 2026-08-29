import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Config } from "./config.js";
import { getActiveConfig } from "./panelConfig.js";

const LINE_COLOR = 0x000000;
const MODEL_TARGET_SIZE = 2.4;
const MOBILE_MODEL_TARGET_SIZE = 1.15;
const ANDROID_MODEL_TARGET_SIZE = 0.95;
const MODEL_URL = "./models/vr-headset.glb";

const WALLPAPERS = [
    './wallpapers/wallpaper1.jpg', './wallpapers/wallpaper2.jpg', './wallpapers/wallpaper3.jpg',
    './wallpapers/wallpaper4.jpg', './wallpapers/wallpaper5.jpg'
];

const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const MAX_PIXEL_RATIO = 2;
const TARGET_FPS = IS_MOBILE ? 30 : 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const RENDER_SCALE = 1;
const EDGE_ANGLE_THRESHOLD = 15;
const LINE_OPACITY = IS_MOBILE ? 1 : 0.85;

const MOBILE_MODEL_Y_OFFSET = 0.78;
const ANDROID_MODEL_Y_OFFSET = 0.5;

const GRID_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GRID_FRAGMENT = `
    varying vec2 vUv;
    uniform float uTime, uDensity, uThickness;
    uniform vec3 uColor;
    uniform vec2 uSpeed;
    void main() {
        vec2 uv = vUv * uDensity + (uTime * uSpeed);
        vec2 grid = abs(fract(uv - 0.5) - 0.5) / fwidth(uv);
        float line = min(grid.x, grid.y);
        float alpha = 1.0 - min(line * (1.0 / max(uThickness, 0.01)), 1.0);
        float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
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
let modelMaxDim = 1;
let currentPlatform = 'desktop';

let cachedRotationSpeed = 0, cachedRotationDirection = 1, cachedGridEnabled = true;

export function init(containerId = "canvas-container", options = {}) {
    const { raiseOnMobile = false, forcePlatform = null } = options;
    currentPlatform = forcePlatform || (IS_ANDROID ? 'android' : 'desktop');
    
    mountEl = document.getElementById(containerId);
    if (!mountEl) { console.error(`vr-headset-bg: nie znaleziono #${containerId}`); return; }

    mountEl.style.position = 'relative';

    wallpaperLayer = document.createElement('div');
    wallpaperLayer.id = 'wallpaper-layer';
    wallpaperLayer.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; background-repeat: no-repeat; z-index: 0; transition: opacity 0.4s ease;`;
    mountEl.appendChild(wallpaperLayer);

    scene = new THREE.Scene();
    scene.background = null;
    camera = new THREE.PerspectiveCamera(35, mountEl.clientWidth / mountEl.clientHeight, 0.01, 100);
    camera.position.set(0, 0, 4.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    
    const existingCanvas = mountEl.querySelector('canvas');
    if (existingCanvas) mountEl.removeChild(existingCanvas);
    
    mountEl.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; z-index: 1;`;
    applyRendererSize();
    buildGrid();

    rig = new THREE.Group();
    scene.add(rig);
    applyTilt();
    if (IS_MOBILE && raiseOnMobile) {
        rig.position.y = currentPlatform === 'android' ? ANDROID_MODEL_Y_OFFSET : MOBILE_MODEL_Y_OFFSET;
    }

    modelGroup = new THREE.Group();
    rig.add(modelGroup);

    new GLTFLoader().load(MODEL_URL, (gltf) => {
        const lineMaterial = new THREE.LineBasicMaterial({ color: LINE_COLOR, transparent: LINE_OPACITY < 1, opacity: LINE_OPACITY });
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
        mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
        const lineSegments = new THREE.LineSegments(mergedGeometry, lineMaterial);

        const box = new THREE.Box3().setFromObject(lineSegments);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        modelMaxDim = Math.max(size.x, size.y, size.z);
        
        const targetSize = (IS_MOBILE && raiseOnMobile) ? (currentPlatform === 'android' ? ANDROID_MODEL_TARGET_SIZE : MOBILE_MODEL_TARGET_SIZE) : MODEL_TARGET_SIZE;
        baseScaleFactor = targetSize / modelMaxDim;

        lineSegments.position.sub(center);
        modelGroup.add(lineSegments);
        applyScale();
    }, undefined, (err) => console.error("vr-headset-bg: błąd wczytywania modelu:", err));

    window.addEventListener("resize", onResize);
    window.addEventListener("configchange", onConfigChange);

    cachedRotationSpeed = Config.get('rotationSpeed');
    cachedRotationDirection = Config.get('rotationDirection');
    cachedGridEnabled = Config.get('gridEnabled');

    applyWallpaper();
    applyPanelStyles();
    startLoop();
}

function buildGrid() {
    const geometry = new THREE.PlaneGeometry(40, 40);
    gridMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }, uDensity: { value: Config.get('gridDensity') },
            uThickness: { value: Config.get('gridThickness') }, uColor: { value: new THREE.Color(Config.get('gridColor')) },
            uSpeed: { value: new THREE.Vector2(Config.get('gridSpeedX') / 1000, Config.get('gridSpeedY') / 1000) }
        },
        vertexShader: GRID_VERTEX, fragmentShader: GRID_FRAGMENT, transparent: true, depthWrite: false, side: THREE.FrontSide
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
    rig.rotation.x = 0; rig.rotation.z = 0;
    if (tiltDir === 'front-right') rig.rotation.z = -angle;
    else if (tiltDir === 'front-left') rig.rotation.z = angle;
    else if (tiltDir === 'back-right') rig.rotation.x = angle;
    else if (tiltDir === 'back-left') rig.rotation.x = -angle;
}

function applyScale() {
    if (!modelGroup) return;
    modelGroup.scale.setScalar(baseScaleFactor * Config.get('scale'));
}

function applyWallpaper() {
    if (!wallpaperLayer) return;
    const enabled = Config.get('wallpaperEnabled');
    const index = Config.get('wallpaperIndex');
    if (enabled) {
        wallpaperLayer.style.backgroundImage = `url('${WALLPAPERS[index] || WALLPAPERS[0]}')`;
        wallpaperLayer.style.opacity = '1';
        wallpaperLayer.style.filter = `brightness(${Config.get('wallpaperBrightness')}) blur(${Config.get('wallpaperBlur')}px)`;
    } else {
        wallpaperLayer.style.opacity = '0';
        wallpaperLayer.style.filter = 'none';
    }
}

function applyPanelStyles() {
    const cfg = getActiveConfig(currentPlatform);
    const introPanel = document.querySelector('.intro-panel');
    if (!introPanel) return;

    introPanel.style.top = cfg.panel_v === 'top' ? '10%' : 'auto';
    introPanel.style.bottom = cfg.panel_v === 'bottom' ? '10%' : 'auto';
    introPanel.style.left = cfg.panel_h === 'left' ? '10%' : (cfg.panel_h === 'center' ? '50%' : 'auto');
    introPanel.style.right = cfg.panel_h === 'right' ? '10%' : 'auto';
    introPanel.style.transform = cfg.panel_h === 'center' ? `translateX(-50%) scale(${cfg.panel_size})` : `scale(${cfg.panel_size})`;
    introPanel.style.opacity = cfg.panel_opacity;

    const titleEl = document.querySelector('#intro h1');
    const descEl = document.querySelector('#intro p:not(.hint)');
    const hintEl = document.querySelector('#intro .hint');
    if (titleEl) titleEl.textContent = cfg.panel_title;
    if (descEl) descEl.textContent = cfg.panel_content_desc;
    if (hintEl) hintEl.textContent = cfg.panel_btn_desc;
}

export function updatePlatformPreview(platform) {
    currentPlatform = platform;
    applyPanelStyles();
    if (modelGroup && modelMaxDim > 0) {
        const isMobilePreview = true;
        const targetSize = platform === 'android' ? ANDROID_MODEL_TARGET_SIZE : MOBILE_MODEL_TARGET_SIZE;
        const newBaseScale = targetSize / modelMaxDim;
        modelGroup.scale.setScalar(newBaseScale * Config.get('scale'));
        rig.position.y = platform === 'android' ? ANDROID_MODEL_Y_OFFSET : MOBILE_MODEL_Y_OFFSET;
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
    if (['wallpaperEnabled', 'wallpaperIndex', 'wallpaperBrightness', 'wallpaperBlur'].includes(key)) applyWallpaper();
    if (key.startsWith('desktop_panel_') || key.startsWith('android_panel_') || key.startsWith('desktop_vr_') || key.startsWith('android_vr_')) {
        applyPanelStyles();
    }
}

function applyRendererSize() {
    if (!mountEl || !camera || !renderer) return;
    const w = mountEl.clientWidth, h = mountEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w * RENDER_SCALE, h * RENDER_SCALE, false);
}

function onResize() { applyRendererSize(); }

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
    if (IS_MOBILE) animateMobile(); else animate();
}

export function destroy() {
    if (animId) { cancelAnimationFrame(animId); clearTimeout(animId); }
    window.removeEventListener('resize', onResize);
    window.removeEventListener('configchange', onConfigChange);
    if (wallpaperLayer && wallpaperLayer.parentNode) wallpaperLayer.parentNode.removeChild(wallpaperLayer);
    if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    if (mountEl) {
        while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild);
    }
}
