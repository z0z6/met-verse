import * as THREE from 'three';
import { Config } from './config.js';

const VERTEX = `
attribute float size;
attribute vec3 customColor;
varying vec3 vColor;
varying float vDepth;
uniform float uPixelRatio;
uniform float uSizeMult;

void main() {
    vColor = customColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    gl_PointSize = size * uSizeMult * uPixelRatio * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT = `
varying vec3 vColor;
varying float vDepth;
uniform float uFadeStart;
uniform float uFadeEnd;

void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = 1.0 - smoothstep(0.35, 0.5, dist);
    float depthFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vDepth);
    alpha *= depthFade;
    
    gl_FragColor = vec4(vColor, alpha);
}
`;

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

let scene, camera, renderer, particles, material, geometry;
let gridMesh, gridMaterial;
let animId;
let time = 0;

// Funkcja tworząca geometrię gogli VR z krawędziami
function createVRHeadsetEdgeGeometry() {
    const geometries = [];

    // Główny korpus - zaokrąglony prostokąt
    const bodyShape = new THREE.Shape();
    const w = 3.6, h = 2.2, r = 0.4;
    bodyShape.moveTo(-w/2 + r, -h/2);
    bodyShape.lineTo(w/2 - r, -h/2);
    bodyShape.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
    bodyShape.lineTo(w/2, h/2 - r);
    bodyShape.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
    bodyShape.lineTo(-w/2 + r, h/2);
    bodyShape.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
    bodyShape.lineTo(-w/2, -h/2 + r);
    bodyShape.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);

    const extrudeSettings = { depth: 1.6, bevelEnabled: true, bevelSegments: 3, steps: 2, bevelSize: 0.08, bevelThickness: 0.08 };
    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    const body = new THREE.Mesh(bodyGeometry);
    body.rotation.y = Math.PI / 2;
    body.position.set(0, 0, -0.8);
    body.updateMatrix();
    geometries.push(bodyGeometry.applyMatrix4(body.matrix));

    // Przedni panel
    const frontShape = new THREE.Shape();
    const fw = 3.3, fh = 1.9, fr = 0.3;
    frontShape.moveTo(-fw/2 + fr, -fh/2);
    frontShape.lineTo(fw/2 - fr, -fh/2);
    frontShape.quadraticCurveTo(fw/2, -fh/2, fw/2, -fh/2 + fr);
    frontShape.lineTo(fw/2, fh/2 - fr);
    frontShape.quadraticCurveTo(fw/2, fh/2, fw/2 - fr, fh/2);
    frontShape.lineTo(-fw/2 + fr, fh/2);
    frontShape.quadraticCurveTo(-fw/2, fh/2, -fw/2, fh/2 - fr);
    frontShape.lineTo(-fw/2, -fh/2 + fr);
    frontShape.quadraticCurveTo(-fw/2, -fh/2, -fw/2 + fr, -fh/2);

    const frontGeometry = new THREE.ExtrudeGeometry(frontShape, { depth: 0.1, bevelEnabled: false });
    const front = new THREE.Mesh(frontGeometry);
    front.position.set(0, 0, 0.8);
    front.updateMatrix();
    geometries.push(frontGeometry.applyMatrix4(front.matrix));

    // Dwie soczewki
    const lensGeometry = new THREE.BoxGeometry(1.1, 1.3, 0.5);
    const leftLens = new THREE.Mesh(lensGeometry);
    leftLens.position.set(-0.9, 0, 1.1);
    leftLens.updateMatrix();
    geometries.push(lensGeometry.applyMatrix4(leftLens.matrix));

    const rightLens = new THREE.Mesh(lensGeometry);
    rightLens.position.set(0.9, 0, 1.1);
    rightLens.updateMatrix();
    geometries.push(lensGeometry.applyMatrix4(rightLens.matrix));

    // Górny uchwyt
    const handleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.5, 1.1, -0.3),
        new THREE.Vector3(-0.8, 1.8, -0.5),
        new THREE.Vector3(0, 2.0, -0.6),
        new THREE.Vector3(0.8, 1.8, -0.5),
        new THREE.Vector3(1.5, 1.1, -0.3)
    ]);
    const handleGeometry = new THREE.TubeGeometry(handleCurve, 32, 0.2, 12, false);
    geometries.push(handleGeometry);

    // Boczne ramiona
    const leftArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.8, 0.3, 0),
        new THREE.Vector3(-2.3, 0.2, -0.5),
        new THREE.Vector3(-2.4, 0.1, -1.2)
    ]);
    const leftArmGeometry = new THREE.TubeGeometry(leftArmCurve, 20, 0.15, 8, false);
    geometries.push(leftArmGeometry);

    const rightArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.8, 0.3, 0),
        new THREE.Vector3(2.3, 0.2, -0.5),
        new THREE.Vector3(2.4, 0.1, -1.2)
    ]);
    const rightArmGeometry = new THREE.TubeGeometry(rightArmCurve, 20, 0.15, 8, false);
    geometries.push(rightArmGeometry);

    // Tylny pasek
    const backStrapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.4, 0.1, -1.2),
        new THREE.Vector3(-2.3, -0.3, -1.5),
        new THREE.Vector3(0, -0.5, -1.7),
        new THREE.Vector3(2.3, -0.3, -1.5),
        new THREE.Vector3(2.4, 0.1, -1.2)
    ]);
    const backStrapGeometry = new THREE.TubeGeometry(backStrapCurve, 32, 0.12, 8, false);
    geometries.push(backStrapGeometry);

    return geometries;
}

const SHAPES = {
    'sphere': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI;
        const r = 3;
        return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.cos(phi), z: r * Math.sin(phi) * Math.sin(theta) };
    },
    'ellipsoid': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI;
        return { x: 4 * Math.sin(phi) * Math.cos(theta), y: 2.5 * Math.cos(phi), z: 3 * Math.sin(phi) * Math.sin(theta) };
    },
    'torus': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI * 2;
        const R = 2.5, r = 1;
        return { x: (R + r * Math.cos(phi)) * Math.cos(theta), y: r * Math.sin(phi), z: (R + r * Math.cos(phi)) * Math.sin(theta) };
    },
    'vr-headset-edges': (u, v, geometry) => {
        return null; // Placeholder - specjalna obsługa
    },
    'wave1': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI;
        const r = 3 + 0.5 * Math.sin(8 * theta) * Math.sin(6 * phi);
        return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.cos(phi), z: r * Math.sin(phi) * Math.sin(theta) };
    },
    'wave2': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI;
        const baseR = 3;
        const wave1 = 0.3 * Math.sin(12 * theta + 2 * phi);
        const wave2 = 0.2 * Math.cos(8 * theta - 3 * phi);
        const r = baseR + wave1 + wave2;
        return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.cos(phi), z: r * Math.sin(phi) * Math.sin(theta) };
    },
    'wave3': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI;
        const baseR = 3;
        const wave = 0.4 * Math.sin(6 * theta) * Math.cos(4 * phi) + 0.3 * Math.cos(10 * theta) * Math.sin(8 * phi);
        const r = baseR + wave;
        return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.cos(phi), z: r * Math.sin(phi) * Math.sin(theta) };
    },
    'wave4': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI;
        const baseR = 3;
        const f1 = 0.4 * Math.sin(4 * theta) * Math.sin(3 * phi);
        const f2 = 0.2 * Math.sin(8 * theta) * Math.sin(6 * phi);
        const f3 = 0.1 * Math.sin(16 * theta) * Math.sin(12 * phi);
        const f4 = 0.05 * Math.sin(32 * theta) * Math.sin(24 * phi);
        const r = baseR + f1 + f2 + f3 + f4;
        return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.cos(phi), z: r * Math.sin(phi) * Math.sin(theta) };
    },
    'wave5': (u, v) => {
        const theta = u * Math.PI * 2;
        const phi = v * Math.PI;
        const baseR = 3;
        const f1 = 0.35 * Math.sin(5 * theta + 1.2) * Math.cos(4 * phi + 0.8);
        const f2 = 0.18 * Math.cos(11 * theta - 2.1) * Math.sin(9 * phi + 1.5);
        const f3 = 0.09 * Math.sin(23 * theta + 0.7) * Math.cos(18 * phi - 1.1);
        const f4 = 0.045 * Math.cos(47 * theta - 0.4) * Math.sin(36 * phi + 2.3);
        const r = baseR + f1 + f2 + f3 + f4;
        return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.cos(phi), z: r * Math.sin(phi) * Math.sin(theta) };
    }
};

function generatePositions(count, shapeFn, shapeName) {
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const baseColor = new THREE.Color(Config.get('particleColor'));
    const multi = Config.get('multiColor');

    // Specjalna obsługa dla vr-headset-edges - punkty wzdłuż krawęd
