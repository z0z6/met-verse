// js/wallpaper-bg.js
import * as THREE from "three";
import { Config } from "./config.js";

const WALLPAPERS = [
    './wallpapers/wallpaper1.jpg',
    './wallpapers/wallpaper2.jpg',
    './wallpapers/wallpaper3.jpg',
    './wallpapers/wallpaper4.jpg',
    './wallpapers/wallpaper5.jpg'
];

let mountEl, scene, camera, renderer;
let wallpaperMesh, wallpaperMaterial;
let clock, time = 0;

const VERTEX_SHADER = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAGMENT_SHADER = `
    uniform sampler2D uTexture;
    uniform float uBrightness;
    uniform float uBlur;
    varying vec2 vUv;
    
    void main() {
        vec4 color = texture2D(uTexture, vUv);
        
        // Rozmycie (proste uśrednianie sąsiednich pikseli)
        if (uBlur > 0.0) {
            float blurSize = uBlur / 512.0;
            vec4 sum = vec4(0.0);
            sum += texture2D(uTexture, vUv + vec2(-blurSize, -blurSize)) * 0.05;
            sum += texture2D(uTexture, vUv + vec2(-blurSize, 0.0)) * 0.1;
            sum += texture2D(uTexture, vUv + vec2(-blurSize, blurSize)) * 0.05;
            sum += texture2D(uTexture, vUv + vec2(0.0, -blurSize)) * 0.1;
            sum += texture2D(uTexture, vUv) * 0.4;
            sum += texture2D(uTexture, vUv + vec2(0.0, blurSize)) * 0.1;
            sum += texture2D(uTexture, vUv + vec2(blurSize, -blurSize)) * 0.05;
            sum += texture2D(uTexture, vUv + vec2(blurSize, 0.0)) * 0.1;
            sum += texture2D(uTexture, vUv + vec2(blurSize, blurSize)) * 0.05;
            color = sum;
        }
        
        // Jasność
        color.rgb *= uBrightness;
        
        gl_FragColor = color;
    }
`;

export function init(containerId = "canvas-container") {
    mountEl = document.getElementById(containerId);
    if (!mountEl) {
        console.error(`wallpaper-bg: nie znaleziono #${containerId}`);
        return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(Config.get('bgColor'));

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    mountEl.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    createWallpaper();

    window.addEventListener("resize", onResize);
    window.addEventListener("configchange", onConfigChange);

    animate();
}

function createWallpaper() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const index = Config.get('wallpaperIndex');
    const texturePath = WALLPAPERS[index] || WALLPAPERS[0];
    
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(texturePath);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    wallpaperMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: texture },
            uBrightness: { value: Config.get('wallpaperBrightness') },
            uBlur: { value: Config.get('wallpaperBlur') }
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true
    });
    
    wallpaperMesh = new THREE.Mesh(geometry, wallpaperMaterial);
    scene.add(wallpaperMesh);
}

function onConfigChange(e) {
    const { key, value } = e.detail;

    if (key === 'bgColor' && scene) {
        scene.background = new THREE.Color(value);
    }
    
    if (key === 'wallpaperIndex' && wallpaperMesh) {
        // Przeładowanie tapety
        const texturePath = WALLPAPERS[value] || WALLPAPERS[0];
        const textureLoader = new THREE.TextureLoader();
        const newTexture = textureLoader.load(texturePath);
        newTexture.minFilter = THREE.LinearFilter;
        newTexture.magFilter = THREE.LinearFilter;
        wallpaperMaterial.uniforms.uTexture.value = newTexture;
    }
    
    if (wallpaperMaterial) {
        if (key === 'wallpaperBrightness') {
            wallpaperMaterial.uniforms.uBrightness.value = value;
        }
        if (key === 'wallpaperBlur') {
            wallpaperMaterial.uniforms.uBlur.value = value;
        }
    }
}

function onResize() {
    if (!mountEl || !camera || !renderer) return;
    const w = mountEl.clientWidth;
    const h = mountEl.clientHeight;
    camera.left = -1;
    camera.right = 1;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

export function destroy() {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('configchange', onConfigChange);
    if (renderer) renderer.dispose();
    if (wallpaperMaterial) wallpaperMaterial.dispose();
}
