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

  // Poduchy oparcia — cieńsze i bliżej pleców, żeby dyskretnie wystawały nad oparcie
  const cushion = rbox(innerW - 0.1, 0.28, 0.08, FABRIC, 0.05);
  cushion.position.set(0, backH - 0.05, -depth / 2 + 0.22);
  g.add(cushion);

  const legGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.1, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(sx * (w / 2 - 0.1), 0.05, sz * (depth / 2 - 0.08));
    g.add(leg);
  }

  return g;
}

export function buildCoffeeTable(w = 1.1, d = 0.6) {
  const g = new THREE.Group();
  const top = rbox(w, 0.05, d, WOOD, 0.02);
  top.position.y = 0.42;
  g.add(top);

  const glassTop = rbox(w - 0.1, 0.02, d - 0.1, GLASS, 0.01);
  glassTop.position.y = 0.42 + 0.025 + 0.01; // dokładnie na wierzchu drewnianego blatu, bez zagłębienia
  g.add(glassTop);

  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
  const lx = w / 2 - 0.07, lz = d / 2 - 0.08;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(sx * lx, 0.2, sz * lz);
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

// Kanapa narożna w kształcie L — złożona z trzech niezachodzących na siebie
// segmentów (róg + dwa ramiona), żeby uniknąć tego samego migotania co przy
// prostej sofie. Otwarta w stronę wnętrza pokoju, oparta plecami o dwie ściany.
export function buildCornerSofa(scene, x, z, armA = 2.6, armB = 2.0, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  const D = 0.85; // głębokość siedziska
  const seatH = 0.42, backH = 0.85, armW = 0.18, backT = 0.18;

  function seatBox(w, d, cx, cz) {
    const m = rbox(w, seatH, d, FABRIC, 0.05);
    m.position.set(cx, seatH / 2, cz);
    group.add(m);
  }
  // Róg + dwa ramiona — stykają się krawędziami, nie zachodzą na siebie
  seatBox(D, D, D / 2, D / 2);
  seatBox(armA - D, D, D + (armA - D) / 2, D / 2);
  seatBox(D, armB - D, D / 2, D + (armB - D) / 2);

  // Oparcie wzdłuż obu "zaplecznych" krawędzi (x=0 i z=0) — jeden ciągły
  // panel na całej długości ramienia A, drugi tylko na wystającej części ramienia B
  const backA = rbox(armA, backH - seatH, backT, FABRIC_ACCENT, 0.05);
  backA.position.set(armA / 2, seatH + (backH - seatH) / 2, backT / 2);
  group.add(backA);

  const backB = rbox(backT, backH - seatH, armB - D, FABRIC_ACCENT, 0.05);
  backB.position.set(backT / 2, seatH + (backH - seatH) / 2, D + (armB - D) / 2);
  group.add(backB);

  // Podłokietniki na dwóch otwartych końcach — celowo odrobinę większe niż
  // siedzisko pod spodem, żeby żadna ich powierzchnia nie pokrywała się
  // DOKŁADNIE z krawędzią siedziska (to właśnie powodowało migotanie).
  const EPS = 0.02;
  const armEndA = rbox(armW, 0.6, D + EPS * 2, FABRIC_ACCENT, 0.045);
  armEndA.position.set(armA - armW / 2 + EPS, 0.3, D / 2);
  group.add(armEndA);

  const armEndB = rbox(D + EPS * 2, 0.6, armW, FABRIC_ACCENT, 0.045);
  armEndB.position.set(D / 2, 0.3, armB - armW / 2 + EPS);
  group.add(armEndB);

  // Poduchy oparcia — subtelne, przy obu plecach
  const cushA = rbox(armA - 0.3, 0.28, 0.08, FABRIC, 0.05);
  cushA.position.set(armA / 2, backH - 0.05, backT + 0.05);
  group.add(cushA);
  const cushB = rbox(0.08, 0.28, armB - D - 0.2, FABRIC, 0.05);
  cushB.position.set(backT + 0.05, backH - 0.05, D + (armB - D) / 2);
  group.add(cushB);

  // Nóżki
  const legGeo = new THREE.CylinderGeometry(0.032, 0.027, 0.1, 8);
  const feet = [
    [0.1, 0.1], [armA - 0.1, 0.1], [armA - 0.1, D - 0.1],
    [0.1, armB - 0.1], [D - 0.1, armB - 0.1],
  ];
  for (const [fx, fz] of feet) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(fx, 0.05, fz);
    group.add(leg);
  }

  // Stolik kawowy budowany i pozycjonowany z main.js (potrzebuje obrotu/rozmiaru
  // dopasowanego do konkretnego skrzydła sofy)

  scene.add(group);
  return { group, footprint: { armA, armB, depth: D, armW } };
}

// --- Donica z egzotyczną rośliną (dracena) ---
const POT_MAT = new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.6 });
const SOIL_MAT = new THREE.MeshStandardMaterial({ color: 0x1c140f, roughness: 1.0 });
const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.8 });
const LEAF_MAT = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.7, side: THREE.DoubleSide });
const LEAF_MAT_LIGHT = new THREE.MeshStandardMaterial({ color: 0x4c8a4f, roughness: 0.7, side: THREE.DoubleSide });

function buildCane(baseY, height, tilt, leafCount = 20) {
  // Geometria łodygi przesunięta tak, żeby jej LOKALNY punkt zerowy był u PODSTAWY
  // (nie na środku) — dzięki temu obrót (tilt) pivotuje od podstawy, a czubek
  // łodygi zawsze ląduje dokładnie tam, gdzie zaczepione są liście (były to
  // wcześniej dwa niezależne, niespójne obliczenia — stąd liście "wisiały w powietrzu").
  const trunkGeo = new THREE.CylinderGeometry(0.028, 0.035, height, 8);
  trunkGeo.translate(0, height / 2, 0);
  const trunk = new THREE.Mesh(trunkGeo, TRUNK_MAT);
  trunk.position.set(0, baseY, 0);
  trunk.rotation.z = tilt;

  // Kępka liści — dziecko łodygi, w JEJ lokalnym układzie umieszczona dokładnie
  // na czubku (y = height). Dziedziczy obrót łodygi automatycznie.
  const tuft = new THREE.Group();
  tuft.position.set(0, height, 0);
  trunk.add(tuft);

  const leafMats = [LEAF_MAT, LEAF_MAT_LIGHT];
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2;
    const leafLen = 0.5 + (i % 4) * 0.08;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, leafLen, 4), leafMats[i % 2]);
    leaf.rotation.z = Math.PI / 2 - 0.55;
    leaf.rotation.y = a;
    leaf.translateY(leafLen / 2); // odsuwa liść tak, żeby jego SZEROKA podstawa startowała z czubka łodygi
    tuft.add(leaf);
  }
  return trunk;
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

  g.add(buildCane(potH, 1.5, -0.12, 22));
  g.add(buildCane(potH, 1.15, 0.18, 20));
  g.add(buildCane(potH, 0.85, -0.28, 18));

  scene.add(g);
  return g;
}

// Wariant "rozłożysty" — dwie, nieco niższe łodygi, mocniej rozchylone na boki,
// z gęstszymi kępkami liści (mniej pionowa, bardziej krzaczasta sylwetka).
export function buildBushyPlant(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const potH = 0.6;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.27, potH, 20), POT_MAT);
  pot.position.y = potH / 2;
  g.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.027, 8, 24), POT_MAT);
  rim.position.y = potH;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 20), SOIL_MAT);
  soil.position.y = potH + 0.005;
  g.add(soil);

  g.add(buildCane(potH, 1.0, -0.42, 26));
  g.add(buildCane(potH, 0.82, 0.38, 24));

  scene.add(g);
  return g;
}

// --- Ławeczka ---
export function buildBench(scene, x, z, length, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const seatH = 0.46, seatD = 0.42;
  const top = rbox(length, 0.06, seatD, WOOD, 0.025);
  top.position.y = seatH;
  g.add(top);

  const legGeo = new THREE.CylinderGeometry(0.035, 0.03, seatH - 0.03, 8);
  const insetX = Math.min(0.5, length / 2 - 0.15);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, WOOD);
      leg.position.set(sx * (length / 2 - insetX * 0.3), (seatH - 0.03) / 2, sz * (seatD / 2 - 0.06));
      g.add(leg);
    }
  }
  scene.add(g);
  return g;
}

// --- Bonsai ---
const BONSAI_TRUNK = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.85 });
const BONSAI_LEAF = new THREE.MeshStandardMaterial({ color: 0x3d7a3f, roughness: 0.8 });
const BONSAI_LEAF_LIGHT = new THREE.MeshStandardMaterial({ color: 0x5a9a52, roughness: 0.8 });

export function buildBonsai(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const potH = 0.28;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, potH, 24), POT_MAT);
  pot.position.y = potH / 2;
  g.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 28), POT_MAT);
  rim.position.y = potH;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 24), SOIL_MAT);
  soil.position.y = potH + 0.005;
  g.add(soil);

  // Gruby, powyginany pień — kilka pochylonych segmentów zamiast jednego prostego
  const trunkGroup = new THREE.Group();
  trunkGroup.position.y = potH;
  g.add(trunkGroup);

  function trunkSegment(parent, len, r0, r1, tiltZ, tiltX) {
    const geo = new THREE.CylinderGeometry(r1, r0, len, 8);
    geo.translate(0, len / 2, 0);
    const seg = new THREE.Mesh(geo, BONSAI_TRUNK);
    seg.rotation.z = tiltZ;
    seg.rotation.x = tiltX;
    parent.add(seg);
    const tip = new THREE.Group();
    tip.position.y = len;
    seg.add(tip);
    return tip;
  }

  const t1 = trunkSegment(trunkGroup, 0.32, 0.075, 0.06, 0.25, 0.1);
  const t2 = trunkSegment(t1, 0.26, 0.06, 0.045, -0.35, 0.15);
  const branchL = trunkSegment(t2, 0.22, 0.03, 0.018, 0.7, 0);
  const branchR = trunkSegment(t2, 0.2, 0.028, 0.016, -0.9, 0.3);
  const top = trunkSegment(t2, 0.16, 0.03, 0.014, -0.1, -0.2);

  // Płaskie, rozłożyste "poduchy" listowia — charakterystyczne dla bonsai
  function foliagePad(parentTip, radius, count) {
    const pad = new THREE.Group();
    parentTip.add(pad);
    for (let i = 0; i < count; i++) {
      const mat = i % 3 === 0 ? BONSAI_LEAF_LIGHT : BONSAI_LEAF;
      const s = radius * (0.5 + Math.random() * 0.6);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), mat);
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * radius;
      leaf.position.set(Math.cos(ang) * rad, Math.random() * radius * 0.4, Math.sin(ang) * rad);
      pad.add(leaf);
    }
  }
  foliagePad(branchL, 0.22, 14);
  foliagePad(branchR, 0.24, 16);
  foliagePad(top, 0.26, 18);

  scene.add(g);
  return g;
}

// --- Lamele na futrynach obu przejść (od podłogi do sufitu, obie strony ściany) ---
export function buildLamellaJamb(scene, wallX, doorEdgeZ, zDir, xDir, depth, height, slatThickness, colorDark, colorLight) {
  // wallX: x powierzchni ściany (strona pokoju); doorEdgeZ: krawędź otworu drzwiowego (±DOOR_HALF_WIDTH)
  // zDir: kierunek w głąb pokoju wzdłuż Z (+1/-1); xDir: kierunek "na zewnątrz" ściany (+1/-1)
  const group = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: colorDark, roughness: 0.4 });
  const lightMat = new THREE.MeshStandardMaterial({ color: colorLight, roughness: 0.3, metalness: 0.05 });
  const slatDepth = 0.05;
  const count = Math.max(2, Math.round(depth / slatThickness));
  const actualT = depth / count;

  for (let i = 0; i < count; i++) {
    const mat = i % 2 === 0 ? darkMat : lightMat;
    const slat = new THREE.Mesh(new THREE.BoxGeometry(slatDepth, height, actualT * 0.94), mat);
    const zOff = zDir * (actualT * (i + 0.5));
    slat.position.set(wallX + xDir * slatDepth / 2, height / 2, doorEdgeZ + zOff);
    group.add(slat);
  }
  scene.add(group);
  return group;
}

// Lamele na wewnętrznej powierzchni framugi (krótki "łącznik" w grubości ściany,
// widoczny podczas przechodzenia przez otwór) — listwy ułożone wzdłuż X (grubość
// ściany), sterczące w stronę wnętrza przejścia, żeby wizualnie łączyły się
// z lamelami na ścianach po obu stronach zamiast urywać się na gołej framudze.
export function buildLamellaReveal(scene, doorEdgeZ, xCenter, width, height, slatThickness, colorDark, colorLight, protrudeDir) {
  const group = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: colorDark, roughness: 0.4 });
  const lightMat = new THREE.MeshStandardMaterial({ color: colorLight, roughness: 0.3, metalness: 0.05 });
  const slatDepth = 0.05;
  const count = Math.max(2, Math.round(width / slatThickness));
  const actualT = width / count;

  for (let i = 0; i < count; i++) {
    // Odwrócona parzystość względem buildLamellaJamb: obie krawędzie tego
    // panelu (styk z lamelami na ścianie po obu stronach) muszą wypaść jasne,
    // żeby w rogu spotykała się jedna ciemna listwa (ze ściany) z jasną
    // (z framugi) — a nie dwie ciemne listwy obok siebie.
    const mat = i % 2 === 0 ? lightMat : darkMat;
    const slat = new THREE.Mesh(new THREE.BoxGeometry(actualT * 0.94, height, slatDepth), mat);
    const xOff = -width / 2 + actualT * (i + 0.5);
    slat.position.set(xCenter + xOff, height / 2, doorEdgeZ + protrudeDir * slatDepth / 2);
    group.add(slat);
  }
  scene.add(group);
  return group;
}
