import * as THREE from 'three';
import { Config } from './config.js';

// Jedyny model to gogle VR zbudowane z linii (LineSegments) — nie ma już
// chmur punktów (sfera/torus/fale), więc nie potrzeba shaderów do punktów.

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

// Buduje geometrię linii (nie punktów) z konturu gogli VR: każdy odcinek
// każdej polilinii staje się parą wierzchołków w jednym LineSegments,
// dzięki czemu model renderuje się jako siatka krawędzi, a nie chmura punktów.
function buildVRHeadsetLineGeometry(multi, baseColor) {
    const polylines = createVRHeadsetPolylines();
    const positions = [];
    const colors = [];

    const colorAt = (p) => {
        if (!multi) return baseColor;
        const hue = THREE.MathUtils.clamp((p.y + 1.8) / 3.6, 0, 1);
        return new THREE.Color().setHSL(hue, 0.8, 0.6);
    };

    polylines.forEach(pts => {
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i], p2 = pts[i + 1];
            positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            const c1 = colorAt(p1), c2 = colorAt(p2);
            colors.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
        }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
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

    // Gogle VR: jedyny dostępny model, zbudowany z linii (krawędzi).
    const baseColor = new THREE.Color(Config.get('particleColor'));
    const multi = Config.get('multiColor');

    geometry = buildVRHeadsetLineGeometry(multi, baseColor);
    material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9
    });
    particles = new THREE.LineSegments(geometry, material);

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
    if (key === 'tiltDirection' || key === 'tiltAngle') applyTilt();
    if (key === 'scale') applyScale();
    if (key === 'bgColor') document.body.style.background = Config.get('bgColor');
}

function onResize() {
    if (!camera || !renderer) return;
    const container = renderer.domElement.parentElement;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
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
export function destroy() {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('configchange', onConfigChange);
    if (renderer) renderer.dispose();
}
