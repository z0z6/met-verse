import * as THREE from 'three';

// Wymiary głównej sali
export const ROOM = { width: 26, depth: 16, height: 5.5 };

const WALL_COLOR = 0xe9e6de;
const FLOOR_COLOR = 0x3a3630;
const ACCENT_COLOR = 0x1c1a17;

export function buildRoom(scene) {
  const { width: W, depth: D, height: H } = ROOM;
  const t = 0.25; // grubość ścian

  const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.55, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9, metalness: 0.0 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 1.0 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: ACCENT_COLOR, roughness: 0.6 });

  // Podłoga
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  scene.add(floor);

  // Sufit
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  // Ściany (4)
  const wallDefs = [
    { w: W, pos: [0, H / 2, -D / 2], rot: [0, 0, 0] },       // północna
    { w: W, pos: [0, H / 2, D / 2], rot: [0, Math.PI, 0] },  // południowa
    { w: D, pos: [-W / 2, H / 2, 0], rot: [0, Math.PI / 2, 0] },  // zachodnia
    { w: D, pos: [W / 2, H / 2, 0], rot: [0, -Math.PI / 2, 0] },  // wschodnia
  ];
  for (const def of wallDefs) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(def.w, H), wallMat);
    wall.position.set(...def.pos);
    wall.rotation.set(...def.rot);
    wall.receiveShadow = true;
    scene.add(wall);
  }

  // Cokół przy podłodze dookoła sali (estetyka + wizualny punkt odniesienia)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.15, D - 0.1), plinthMat);
  plinth.position.set(0, 0.075, 0);
  plinth.visible = false; // tylko kolizja wizualna nieużywana — placeholder na przyszłość
  scene.add(plinth);

  // Oświetlenie
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a30, 0.4);
  scene.add(hemi);

  // Rząd spotów sufitowych — ciepłe, punktowe doświetlenie sali
  const spotPositions = [-8, -2.6, 2.6, 8];
  for (const x of spotPositions) {
    const spot = new THREE.SpotLight(0xfff2df, 40, 12, Math.PI / 5, 0.4, 1.5);
    spot.position.set(x, H - 0.1, 0);
    spot.target.position.set(x, 0, 0);
    spot.castShadow = false;
    scene.add(spot);
    scene.add(spot.target);
  }

  return { floorMesh: floor };
}

// Generuje sloty (pozycja + obrót + dostępna szerokość) rozmieszczone równomiernie
// wzdłuż czterech ścian sali. Kolejne prace z manifestu wypełniają sloty po kolei.
export function generateWallSlots() {
  const { width: W, depth: D, height: H } = ROOM;
  const margin = 0.06; // odsunięcie od powierzchni ściany
  const eyeY = 1.6; // wysokość środka obrazu

  const slots = [];

  // Ściana północna i południowa (dłuższe — więcej slotów)
  const longCount = 6;
  const longSpacing = W / longCount;
  for (let i = 0; i < longCount; i++) {
    const x = -W / 2 + longSpacing * (i + 0.5);
    slots.push({ pos: [x, eyeY, -D / 2 + margin], rotY: 0, maxWidth: longSpacing * 0.8 });
    slots.push({ pos: [x, eyeY, D / 2 - margin], rotY: Math.PI, maxWidth: longSpacing * 0.8 });
  }

  // Ściana wschodnia i zachodnia (krótsze)
  const shortCount = 3;
  const shortSpacing = D / shortCount;
  for (let i = 0; i < shortCount; i++) {
    const z = -D / 2 + shortSpacing * (i + 0.5);
    slots.push({ pos: [-W / 2 + margin, eyeY, z], rotY: Math.PI / 2, maxWidth: shortSpacing * 0.8 });
    slots.push({ pos: [W / 2 - margin, eyeY, z], rotY: -Math.PI / 2, maxWidth: shortSpacing * 0.8 });
  }

  return slots;
}
