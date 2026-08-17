import * as THREE from 'three';

const FABRIC = new THREE.MeshStandardMaterial({ color: 0x50606b, roughness: 0.85 });
const FABRIC_ACCENT = new THREE.MeshStandardMaterial({ color: 0x3d4a52, roughness: 0.85 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x2a1e16, roughness: 0.45, metalness: 0.1 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0xbfd4dc, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 });

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// Pojedynczy fotel/sofa — szerokość `w` decyduje, czy to fotel (~0.9) czy sofa (~2.0)
function buildSeat(w) {
  const g = new THREE.Group();
  const seatH = 0.42, armH = 0.62, backH = 0.85, depth = 0.85;

  const base = box(w, seatH, depth, FABRIC);
  base.position.y = seatH / 2;
  g.add(base);

  const back = box(w, backH - seatH, 0.18, FABRIC_ACCENT);
  back.position.set(0, seatH + (backH - seatH) / 2, -depth / 2 + 0.09);
  g.add(back);

  const armL = box(0.16, armH, depth, FABRIC_ACCENT);
  armL.position.set(-w / 2 + 0.08, armH / 2, 0);
  g.add(armL);

  const armR = armL.clone();
  armR.position.x = w / 2 - 0.08;
  g.add(armR);

  // nóżki
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(sx * (w / 2 - 0.12), 0.06, sz * (depth / 2 - 0.1));
    g.add(leg);
  }

  return g;
}

function buildCoffeeTable() {
  const g = new THREE.Group();
  const top = box(1.1, 0.05, 0.6, WOOD);
  top.position.y = 0.42;
  g.add(top);

  const glassTop = box(1.0, 0.02, 0.5, GLASS);
  glassTop.position.y = 0.45;
  g.add(glassTop);

  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, WOOD);
    leg.position.set(sx * 0.48, 0.2, sz * 0.25);
    g.add(leg);
  }
  return g;
}

// Umieszcza zestaw wypoczynkowy (sofa + 2 fotele + stolik) na środku podanej sali,
// zwrócony w stronę stolika — jak w prawdziwej strefie lounge.
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
