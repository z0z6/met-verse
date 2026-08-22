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

// ---------- Pomocnicze generatory konturów (gogle VR) ----------

// Zwraca zamkniętą polilinię zaokrąglonego prostokąta w płaszczyźnie XY (z=0)
function roundedRectPoints(w, h, r, segsPerCorner = 8) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(x + w, y + h - r);
    shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    shape.lineTo(x + r, y + h);
    shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(x, y + r);
    shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    const pts2D = shape.getPoints(segsPerCorner);
    pts2D.push(pts2D[0].clone());
    return pts2D.map(p => new THREE.Vector3(p.x, p.y, 0));
}

// Punkty okręgu w wybranej płaszczyźnie
function circlePoints(radius, segs, plane = 'xy') {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const c = Math.cos(a) * radius, s = Math.sin(a) * radius;
        if (plane === 'xy') pts.push(new THREE.Vector3(c, s, 0));
        else if (plane === 'yz') pts.push(new THREE.Vector3(0, c, s));
        else pts.push(new THREE.Vector3(c, 0, s));
    }
    return pts;
}

// Zwraca zestaw polilinii tworzących "klatkę" zaokrąglonego prostopadłościanu:
// przednia i tylna ścianka + linie łączące je na obwodzie (efekt bryły 3D)
function roundedBoxWireframe(center, size, axis, radius, segsPerCorner = 6, cageLines = 8) {
    let w, h, mapTo3D;
    if (axis === 'x') {
        w = size.y; h = size.z;
        mapTo3D = (p, off) => new THREE.Vector3(center.x + off, center.y + p.x, center.z + p.y);
    } else if (axis === 'y') {
        w = size.x; h = size.z;
        mapTo3D = (p, off) => new THREE.Vector3(center.x + p.x, center.y + off, center.z + p.y);
    } else {
        w = size.x; h = size.y;
        mapTo3D = (p, off) => new THREE.Vector3(center.x + p.x, center.y + p.y, center.z + off);
    }
    const flat = roundedRectPoints(w, h, radius, segsPerCorner);
    const axisSize = axis === 'x' ? size.x : axis === 'y' ? size.y : size.z;
    const half = axisSize / 2;
    const frontLoop = flat.map(p => mapTo3D(p, -half));
    const backLoop = flat.map(p => mapTo3D(p, half));
    const polylines = [frontLoop, backLoop];
    const n = flat.length - 1;
    const step = Math.max(1, Math.floor(n / cageLines));
    for (let i = 0; i < n; i += step) {
        polylines.push([frontLoop[i], backLoop[i]]);
    }
    return polylines;
}

// Próbkuje `count` punktów wzdłuż zestawu polilinii proporcjonalnie do ich
// długości - dzięki temu gęstość punktów wiernie odwzorowuje kontur
// (długie krawędzie dostają proporcjonalnie więcej punktów, krótkie mniej,
// zamiast losowego rozrzutu "po równo na krawędź" jak wcześniej).
function sampleWeightedPoints(polylines, count) {
    const segStarts = [];
    const segPoints = [];
    let total = 0;
    polylines.forEach(pts => {
        for (let i = 0; i < pts.length - 1; i++) {
            const len = pts[i].distanceTo(pts[i + 1]);
            if (len <= 1e-6) continue;
            total += len;
            segStarts.push(total);
            segPoints.push([pts[i], pts[i + 1]]);
        }
    });
    if (!segPoints.length) return [];
    const result = [];
    for (let i = 0; i < count; i++) {
        const r = Math.random() * total;
        let lo = 0, hi = segStarts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (segStarts[mid] < r) lo = mid + 1; else hi = mid;
        }
        const segStart = lo === 0 ? 0 : segStarts[lo - 1];
        const segLen = segStarts[lo] - segStart;
        const t = segLen > 0 ? (r - segStart) / segLen : 0.5;
        const [p1, p2] = segPoints[lo];
        result.push(p1.clone().lerp(p2, t));
    }
    return result;
}

// Buduje pełen kontur gogli VR (na podstawie zdjęć referencyjnych):
// korpus/wizjer, szew na przedniej ściance, czujniki, przycisk boczny,
// ramię łączące, moduł z pokrętłem po lewej stronie oraz pałąk na górze.
function createVRHeadsetPolylines() {
    const polylines = [];

    // --- Główny korpus / wizjer ---
    const visorSize = { x: 3.4, y: 2.15, z: 1.7 };
    const visorCenter = { x: 0, y: 0, z: 0 };
    polylines.push(...roundedBoxWireframe(visorCenter, visorSize, 'z', 0.5, 8, 10));

    // --- Szew między obudową a maską na przedniej ściance ---
    const seam = roundedRectPoints(visorSize.x - 0.32, visorSize.y - 0.32, 0.38, 8)
        .map(p => new THREE.Vector3(p.x, p.y, visorSize.z / 2 + 0.01));
    polylines.push(seam);

    // --- Czujniki / kamery na przedniej ściance ---
    const sensors = [
        { x: -1.35, y: 0.62 }, { x: 1.48, y: 0.52 },
        { x: 1.55, y: -0.08 }, { x: 1.32, y: -0.75 }
    ];
    sensors.forEach(s => {
        polylines.push(circlePoints(0.08, 10, 'xy')
            .map(p => new THREE.Vector3(p.x + s.x, p.y + s.y, visorSize.z / 2 + 0.02)));
    });

    // --- Przycisk / gniazdo z prawej strony ---
    polylines.push(roundedRectPoints(0.16, 0.55, 0.06, 4)
        .map(p => new THREE.Vector3(visorSize.x / 2 + 0.01, p.y + 0.15, p.x + 0.2)));
    polylines.push(circlePoints(0.09, 10, 'yz')
        .map(p => new THREE.Vector3(visorSize.x / 2 + 0.01, p.y - 0.55, p.z + 0.35)));

    // --- Ramię łączące korpus z modułem po lewej ---
    const armLength = 1.35;
    const armCenter = { x: -visorSize.x / 2 - armLength / 2, y: -0.05, z: 0 };
    polylines.push(...roundedBoxWireframe(armCenter, { x: armLength, y: 0.55, z: 0.36 }, 'x', 0.16, 4, 6));

    // --- Moduł (obudowa pokrętła) po lewej stronie ---
    const moduleCenter = { x: armCenter.x - armLength / 2 - 0.24, y: 0, z: 0 };
    const moduleSize = { x: 0.46, y: 0.95, z: 0.85 };
    polylines.push(...roundedBoxWireframe(moduleCenter, moduleSize, 'x', 0.2, 6, 8));

    // --- Pokrętło (dwa współśrodkowe okręgi) na zewnętrznej ściance modułu ---
    const dialX = moduleCenter.x - moduleSize.x / 2 - 0.01;
    polylines.push(circlePoints(0.36, 20, 'yz')
        .map(p => new THREE.Vector3(dialX, p.y + moduleCenter.y, p.z + moduleCenter.z)));
    polylines.push(circlePoints(0.15, 14, 'yz')
        .map(p => new THREE.Vector3(dialX, p.y + moduleCenter.y, p.z + moduleCenter.z)));

    // --- Pałąk na górze (wewnętrzna i zewnętrzna krawędź opaski + "szycie") ---
    const strapLeft = new THREE.Vector3(moduleCenter.x, moduleCenter.y + 0.56, moduleCenter.z - 0.05);
    const strapRight = new THREE.Vector3(1.1, 1.05, -0.55);
    const innerCurve = new THREE.CatmullRomCurve3([
        strapLeft,
        new THREE.Vector3(moduleCenter.x * 0.55, 1.62, -0.35),
        new THREE.Vector3(0.05, 1.95, -0.6),
        new THREE.Vector3(0.75, 1.68, -0.58),
        strapRight
    ]);
    const outerCurve = new THREE.CatmullRomCurve3([
        strapLeft.clone().add(new THREE.Vector3(0, 0.32, -0.02)),
        new THREE.Vector3(moduleCenter.x * 0.55, 1.92, -0.4),
        new THREE.Vector3(0.05, 2.25, -0.65),
        new THREE.Vector3(0.75, 1.98, -0.62),
        strapRight.clone().add(new THREE.Vector3(0, 0.3, -0.02))
    ]);
    const strapSegs = 28;
    const innerPts = innerCurve.getPoints(strapSegs);
    const outerPts = outerCurve.getPoints(strapSegs);
    polylines.push(innerPts, outerPts);
    for (let i = 0; i <= strapSegs; i += 4) {
        polylines.push([innerPts[i], outerPts[i]]);
    }

    return polylines;
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

    // Specjalna obsługa dla vr-headset-edges - punkty wzdłuż konturu gogli,
    // próbkowane proporcjonalnie do długości odcinków (gęstość = wierność kształtu)
    if (shapeName === 'vr-headset-edges') {
        const polylines = createVRHeadsetPolylines();
        const sampled = sampleWeightedPoints(polylines, count);
        const noise = 0.015;

        for (let i = 0; i < count; i++) {
            const point = sampled[i] || new THREE.Vector3();

            pos[i*3]   = point.x + (Math.random() - 0.5) * noise;
            pos[i*3+1] = point.y + (Math.random() - 0.5) * noise;
            pos[i*3+2] = point.z + (Math.random() - 0.5) * noise;

            if (multi) {
                const hue = THREE.MathUtils.clamp((point.y + 1.8) / 3.6, 0, 1);
                const c = new THREE.Color().setHSL(hue, 0.8, 0.6);
                colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
            } else {
                colors[i*3] = baseColor.r; colors[i*3+1] = baseColor.g; colors[i*3+2] = baseColor.b;
            }
            sizes[i] = 0.3 + Math.random() * 0.4;
        }

        return { pos, colors, sizes };
    }

    // Standardowa obsługa dla innych kształtów
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
    const data = generatePositions(count, shapeFn, shape);

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
