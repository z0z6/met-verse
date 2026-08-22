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
    'vr-headset': (u, v) => {
        // u: 0.0 do 1.0 (obwód, 0.5 to środek przodu)
        // v: 0.0 do 1.0 (góra do dołu)

        let isFront = u > 0.35 && u < 0.65;
        let isLeftSide = u >= 0.2 && u <= 0.35;
        let isRightSide = u >= 0.65 && u <= 0.8;
        
        let x, y, z, localU, side;

        if (isFront) {
            localU = (u - 0.35) / 0.3; // 0 do 1 na przodzie
            side = u < 0.5 ? -1 : 1;

            let width = 3.4;
            let height = 2.2;
            let depth = 1.3;

            let angleX = (localU - 0.5) * Math.PI * 0.6;
            x = (u - 0.5) * 3.2;
            let angleY = (v - 0.5) * Math.PI * 0.8;
            y = height * Math.cos(angleY) * 0.85;
            z = depth * Math.cos(angleX) * Math.cos(angleY) * 0.6;

            // Wypukłości na soczewki (dwie oddzielne)
            let eyeSep = 0.9;
            let distToLeftEye = Math.abs(x + eyeSep);
            let distToRightEye = Math.abs(x - eyeSep);
            let bulge = 0;
            if (distToLeftEye < 0.8) bulge = Math.max(0, 0.5 * (1 - distToLeftEye / 0.8));
            if (distToRightEye < 0.8) bulge = Math.max(0, 0.5 * (1 - distToRightEye / 0.8));
            z += bulge * Math.cos(angleY);

        } else if (isLeftSide || isRightSide) {
            side = isLeftSide ? -1 : 1;
            localU = isLeftSide ? (0.35 - u) / 0.15 : (u - 0.65) / 0.15; // 0 przy przodzie, 1 przy tyle

            let startX = side * 1.6;
            let endX = side * 2.6;
            x = startX + (endX - startX) * localU;

            let angleY = (v - 0.5) * Math.PI * 0.8;
            y = 2.0 * Math.cos(angleY) * 0.85 - (localU * 0.4);

            let curveZ = 1.0 * Math.sin(localU * Math.PI * 0.5);
            z = (1.3 * (1 - localU) + curveZ) * Math.cos(angleY) * 0.6;

        } else {
            // Tylny pasek
            localU = u < 0.2 ? u / 0.2 : (1 - u) / 0.2; // 0 przy bokach, 1 na środku tyłu
            side = u < 0.5 ? -1 : 1;

            let startX = side * 2.6;
            x = startX + (0 - startX) * localU;

            let strapHeight = 0.6;
            let centerY = 0.2;
            y = centerY + (v - 0.5) * strapHeight * 1.5;

            // Spłaszczenie do formy paska
            if (Math.abs(y - centerY) > strapHeight / 2) {
                let overflow = Math.abs(y - centerY) - strapHeight / 2;
                y = centerY + Math.sign(y - centerY) * (strapHeight / 2 + overflow * 0.1);
            }

            let angleBack = localU * Math.PI * 0.5;
            z = 2.8 * Math.cos(angleBack) * 0.5;
        }

        // Delikatny szum dla naturalnego wyglądu chmury punktów
        let noise = 0.06;
        return {
            x: x + (Math.random() - 0.5) * noise,
            y: y + (Math.random() - 0.5) * noise,
            z: z + (Math.random() - 0.5) * noise
        };
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

function generatePositions(count, shapeFn) {
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const baseColor = new THREE.Color(Config.get('particleColor'));
    const multi = Config.get('multiColor');

    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const p = shapeFn(u, v);
        
        pos[i*3] = p.x + (Math.random()-0.5)*0.08;
        pos[i*3+1] = p.y + (Math.random()-0.5)*0.08;
        pos[i*3+2] = p.z + (Math.random()-0.5)*0.08;

        if (multi) {
            const hue = (p.y + 3) / 6;
            const c = new THREE.Color().setHSL(hue, 0.8, 0.6);
            colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
        } else {
            colors[i*3] = baseColor.r; colors[i*3+1] = baseColor.g; colors[i*3+2] = baseColor.b;
        }
        sizes[i] = 0.3 + Math.random() * 0.4;
    }
    return { pos, colors, sizes };
}

export function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 9;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    buildGrid();
    buildParticles();

    window.addEventListener('resize', onResize);
    window.addEventListener('configchange', onConfigChange);
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

function buildParticles() {
    if (particles) { 
        scene.remove(particles); 
        if (geometry) geometry.dispose(); 
        if (material) material.dispose(); 
        particles = null; geometry = null; material = null;
    }

    const count = parseInt(Config.get('particleCount'));
    const shape = Config.get('shape');
    const shapeFn = SHAPES[shape] || SHAPES['sphere'];
    const data = generatePositions(count, shapeFn);

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(data.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1));

    material = new THREE.ShaderMaterial({
        uniforms: {
            uPixelRatio: { value: renderer.getPixelRatio() },
            uSizeMult: { value: Config.get('particleSize') },
            uFadeStart: { value: 4 },
            uFadeEnd: { value: 12 }
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(geometry, material);
    applyTilt();
    applyScale();
    scene.add(particles);
}

function applyTilt() {
    if (!particles) return;
    const tiltDir = Config.get('tiltDirection');
    const tiltAngle = Config.get('tiltAngle');
    const angle = (tiltAngle * Math.PI) / 180;
    particles.rotation.x = 0;
    particles.rotation.z = 0;
    switch(tiltDir) {
        case 'front-right': particles.rotation.z = -angle; break;
        case 'front-left': particles.rotation.z = angle; break;
        case 'back-right': particles.rotation.x = angle; break;
        case 'back-left': particles.rotation.x = -angle; break;
    }
}

function applyScale() {
    if (!particles) return;
    const scale = Config.get('scale');
    particles.scale.set(scale, scale, scale);
}

function onConfigChange(e) {
    const { key, value } = e.detail;
    if (key === 'gridEnabled' && gridMesh) gridMesh.visible = value;
    if (gridMaterial) {
        if (key === 'gridDensity') gridMaterial.uniforms.uDensity.value = value;
        if (key === 'gridThickness') gridMaterial.uniforms.uThickness.value = value;
        if (key === 'gridColor') gridMaterial.uniforms.uColor.value = new THREE.Color(value);
        if (key === 'gridSpeedX') gridMaterial.uniforms.uSpeed.value.x = value / 1000;
        if (key === 'gridSpeedY') gridMaterial.uniforms.uSpeed.value.y = value / 1000;
    }
    if (['particleCount','shape','particleColor','multiColor'].includes(key)) buildParticles();
    if (key === 'tiltDirection' || key === 'tiltAngle') applyTilt();
    if (key === 'scale') applyScale();
    if (key === 'bgColor') document.body.style.background = Config.get('bgColor');
    if (key === 'particleSize' && material) material.uniforms.uSizeMult.value = Config.get('particleSize');
}

function onResize() {
    if (!camera || !renderer) return;
    const container = renderer.domElement.parentElement;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    if (material) material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}

function animate() {
    animId = requestAnimationFrame(animate);
    time += 0.01;
    if (gridMaterial && Config.get('gridEnabled')) gridMaterial.uniforms.uTime.value = time;
    const speed = Config.get('rotationSpeed') * 0.02;
    const dir = Config.get('rotationDirection');
    if (particles) particles.rotation.y += speed * dir;
    renderer.render(scene, camera);
}

export function toggleRotation() {
    const current = Config.get('rotationSpeed');
    Config.set('rotationSpeed', current > 0.01 ? 0 : 0.5);
}
export function changeDirection() {
    Config.set('rotationDirection', Config.get('rotationDirection') * -1);
}
export function nextShape() {
    const keys = Object.keys(SHAPES);
    const curr = Config.get('shape');
    const idx = keys.indexOf(curr);
    const next = keys[(idx + 1) % keys.length];
    Config.set('shape', next);
}
export function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('configchange', onConfigChange);
    if (renderer) renderer.dispose();
}
