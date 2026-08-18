import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const FABRIC = new THREE.MeshStandardMaterial({ color: 0x50606b, roughness: 0.85 });
const FABRIC_ACCENT = new THREE.MeshStandardMaterial({ color: 0x3d4a52, roughness: 0.85 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x2a1e16, roughness: 0.45, metalness: 0.1 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0xbfd4dc, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35 });

function rbox(w, h, d, mat, radius = 0.03) {
  const r = Math.min(radius, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005);
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.max(r, 0.005)), mat);
}

// Fotel (w ~0.9) lub sofa (w ~2.0) — geometria ułożona TAK, żeby żadne dwie
// bryły nie dzieliły dokładnie tej samej, skierowanej w tę samą stronę
// powierzchni (to właśnie powodowało migotanie jak przy ramach/dywanie).
function buildSeat(w) {
  const g = new THREE.Group();
  const seatH = 0.42, backH = 0.85, depth = 0.85, armH = 0.60, armW = 0.18;
  const innerW = w - armW * 2; // siedzisko mieści się MIĘDZY podłokietnikami, nie pod nimi

  const base = rbox(innerW, seatH, depth, FABRIC, 0.05);
  base.position.set(0, seatH / 2, 0);
  g.add(base);

  const back = rbox(innerW, backH - seatH + 0.06, 0.18, FABRIC_ACCENT, 0.05);
  back.position.set(0, seatH + (backH - seatH) / 2, -depth / 2 + 0.09);
  g.add(back);

  // Podłokietniki — pełna wysokość OD PODŁOGI, na zewnątrz siedziska (bez wspólnej ściany z base)
  const armGeo = new RoundedBoxGeometry(armW, armH, depth, 3, 0.045);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, FABRIC_ACCENT);
    arm.position.set(side * (innerW / 2 + armW / 2), armH / 2, 0);
    g.add(arm);
  }

  // Poduchy oparcia (delikatny akcent, lekko odsunięte od pleców — bez styku powierzchni)
  const cushion = rbox(innerW - 0.1, 0.28, 0.16, FABRIC, 0.06);
  cushion.position.set(0, backH - 0.05, -depth / 2 + 0.24);
  g.add(cushion);

  const legGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.1, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(sx * (w / 2 - 0.1), 0.05, sz * (depth / 2 - 0.08));
    g.add(leg);
  }

  return g;
}

function buildCoffeeTable() {
  const g = new THREE.Group();
  const top = rbox(1.1, 0.05, 0.6, WOOD, 0.02);
  top.position.y = 0.42;
  g.add(top);

  const glassTop = rbox(1.0, 0.02, 0.5, GLASS, 0.01);
  glassTop.position.y = 0.42 + 0.025 + 0.01; // dokładnie na wierzchu drewnianego blatu, bez zagłębienia
  g.add(glassTop);

  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(sx * 0.48, 0.2, sz * 0.25);
    g.add(leg);
  }
  return g;
}

function buildSmallTable() {
  const g = new THREE.Group();
  const top = rbox(0.55, 0.04, 0.55, WOOD, 0.02);
  top.position.y = 0.45;
  g.add(top);
  const legGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.43, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(sx * 0.22, 0.215, sz * 0.22);
    g.add(leg);
  }
  return g;
}

// Zestaw wypoczynkowy (sofa + 2 fotele + stolik)
export function buildLoungeSet(scene, centerX, centerZ = 0) {
  const group = new THREE.Group();
  group.position.set(centerX, 0, centerZ);

  const sofa = buildSeat(2.0);
  sofa.position.set(0, 0, -1.1);
  group.add(sofa);

  const chairL = buildSeat(0.9);
  chairL.rotation.y = Math.PI / 2;
  chairL.position.set(-1.35, 0, 0.35);
  group.add(chairL);

  const chairR = buildSeat(0.9);
  chairR.rotation.y = -Math.PI / 2;
  chairR.position.set(1.35, 0, 0.35);
  group.add(chairR);

  const table = buildCoffeeTable();
  table.position.set(0, 0, 0.3);
  group.add(table);

  scene.add(group);
  return group;
}

// Pojedynczy fotel + mały stolik (do mniejszej sali)
export function buildSingleChairSet(scene, centerX, centerZ = 0, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(centerX, 0, centerZ);
  group.rotation.y = rotY;

  const chair = buildSeat(0.9);
  group.add(chair);

  const table = buildSmallTable();
  table.position.set(0.85, 0, 0);
  group.add(table);

  scene.add(group);
  return group;
}

// --- Donica z egzotyczną rośliną (dracena) ---
const POT_MAT = new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.6 });
const SOIL_MAT = new THREE.MeshStandardMaterial({ color: 0x1c140f, roughness: 1.0 });
const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.8 });
const LEAF_MAT = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.7, side: THREE.DoubleSide });
const LEAF_MAT_LIGHT = new THREE.MeshStandardMaterial({ color: 0x4c8a4f, roughness: 0.7, side: THREE.DoubleSide });

function buildCane(baseY, height, tilt) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, height, 8), TRUNK_MAT);
  trunk.position.y = baseY + height / 2;
  trunk.rotation.z = tilt;
  g.add(trunk);

  const topY = baseY + Math.cos(tilt) * height;
  const topX = Math.sin(tilt) * height;

  const leafCount = 14;
  const leafMats = [LEAF_MAT, LEAF_MAT_LIGHT];
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2;
    const leafLen = 0.55 + (i % 3) * 0.06;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, leafLen, 4), leafMats[i % 2]);
    leaf.position.set(topX, topY + 0.05, 0);
    // liście odchylone na zewnątrz i lekko opadające — typowy pokrój dracenowaty
    leaf.rotation.z = Math.PI / 2 - 0.55;
    leaf.rotation.y = a;
    leaf.translateY(leafLen / 2);
    g.add(leaf);
  }
  return g;
}

export function buildPottedPlant(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const potH = 0.55;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, potH, 20), POT_MAT);
  pot.position.y = potH / 2;
  g.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 24), POT_MAT);
  rim.position.y = potH;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 20), SOIL_MAT);
  soil.position.y = potH + 0.005;
  g.add(soil);

  g.add(buildCane(potH, 1.5, -0.12));
  g.add(buildCane(potH, 1.15, 0.18));
  g.add(buildCane(potH, 0.85, -0.28));

  scene.add(g);
  return g;
}
