import * as THREE from 'three';
import { ROOMS, DEPTH, PARTITIONS, DOOR_HALF_WIDTH, WALL_THICKNESS, BOUNDS } from './collision.js';
import { loadFloorMaterial, loadWallMaterial, loadCeilingMaterial, loadRugMaterial } from './textures.js';

export const ROOM_NAMES = ['Sala zachodnia', 'Sala główna', 'Sala wschodnia'];
const ROOM_TINTS = [0xfff0e0, 0xffffff, 0xe6f0ff]; // ciepły / neutralny / chłodny akcent światła

export const ROOM_HEIGHT = 5.5;

export function buildRoom(scene) {
  const H = ROOM_HEIGHT;
  const totalWidth = BOUNDS.maxX - BOUNDS.minX;

  const floorMat = loadFloorMaterial(totalWidth / 4, DEPTH / 4);
  const wallMat = loadWallMaterial(totalWidth / 6, H / 3);
  const wallMatSide = loadWallMaterial(DEPTH / 6, H / 3);
  const ceilMat = loadCeilingMaterial(totalWidth / 4, DEPTH / 4);

  // Podłoga i sufit — jedna wspólna płaszczyzna na całą bryłę
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, DEPTH), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, DEPTH), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  // Ściany zewnętrzne: północna i południowa (pełna długość, bez przerw)
  const northWall = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, H), wallMat);
  northWall.position.set(0, H / 2, -DEPTH / 2);
  northWall.name = 'wall';
  scene.add(northWall);

  const southWall = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, H), wallMat.clone());
  southWall.position.set(0, H / 2, DEPTH / 2);
  southWall.rotation.y = Math.PI;
  southWall.name = 'wall';
  scene.add(southWall);

  // Ściany szczytowe (zachodnia i wschodnia)
  const westWall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, H), wallMatSide);
  westWall.position.set(BOUNDS.minX, H / 2, 0);
  westWall.rotation.y = Math.PI / 2;
  westWall.name = 'wall';
  scene.add(westWall);

  const eastWall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, H), wallMatSide.clone());
  eastWall.position.set(BOUNDS.maxX, H / 2, 0);
  eastWall.rotation.y = -Math.PI / 2;
  eastWall.name = 'wall';
  scene.add(eastWall);

  // Ściany działowe — bryły z realną grubością (nie płaszczyzny), z przejściem
  // (drzwiami) na środku. Grubość proporcjonalna do wymiarów sal.
  for (const px of PARTITIONS) {
    const segLen = (DEPTH - DOOR_HALF_WIDTH * 2) / 2;
    for (const side of [-1, 1]) {
      const zCenter = side * (DOOR_HALF_WIDTH + segLen / 2);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, H, segLen), wallMatSide.clone());
      seg.position.set(px, H / 2, zCenter);
      seg.name = 'wall';
      scene.add(seg);
    }
    // odrzwia (wykończenie framugi) — teraz w pełni pokryte lamelami budowanymi
    // z main.js (buildLamellaReveal), więc bazowej płaskiej listwy tu nie potrzeba
  }

  // Oświetlenie
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a42, 0.55));

  ROOMS.forEach((room, i) => {
    const cx = (room.minX + room.maxX) / 2;
    const spot = new THREE.SpotLight(ROOM_TINTS[i], 85, 16, Math.PI / 4, 0.45, 1.4);
    spot.position.set(cx, H - 0.1, 0);
    spot.target.position.set(cx, 0, 0);
    scene.add(spot, spot.target);

    // dodatkowe boczne punkty światła — łagodzą ostre cienie, doświetlają ściany
    for (const zOff of [-DEPTH / 3.2, DEPTH / 3.2]) {
      const fill = new THREE.PointLight(0xfff6ea, 12, 9, 2);
      fill.position.set(cx, H - 1.2, zOff);
      scene.add(fill);
    }
  });

  // Dywan na środku każdej z sal — proporcjonalny do jej powierzchni,
  // odsunięty nieznacznie ponad podłogę (unika migotania z podłogą).
  const rugMat = loadRugMaterial(4, 3);
  ROOMS.forEach((room) => {
    const w = room.maxX - room.minX;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, DEPTH * 0.45), rugMat.clone());
    rug.rotation.x = -Math.PI / 2;
    rug.position.set((room.minX + room.maxX) / 2, 0.02, 0);
    scene.add(rug);
  });

  return { floorMesh: floor };
}

// Generuje sloty na obrazy: dla każdej z trzech sal — jej odcinek ściany
// północnej i południowej, a skrajne sale dodatkowo swoją ścianę szczytową.
export function generateWallSlots() {
  const margin = 0.1;
  const eyeY = 1.6;
  const slotsPerWall = 3;
  const slots = [];

  ROOMS.forEach((room, i) => {
    const w = room.maxX - room.minX;
    const spacing = w / slotsPerWall;
    for (let k = 0; k < slotsPerWall; k++) {
      const x = room.minX + spacing * (k + 0.5);
      slots.push({ pos: [x, eyeY, -DEPTH / 2 + margin], rotY: 0, maxWidth: spacing * 0.8 });
      slots.push({ pos: [x, eyeY, DEPTH / 2 - margin], rotY: Math.PI, maxWidth: spacing * 0.8 });
    }
    if (i === 0) {
      const zSpacing = DEPTH / 3;
      for (let k = 0; k < 3; k++) {
        const z = -DEPTH / 2 + zSpacing * (k + 0.5);
        slots.push({ pos: [room.minX + margin, eyeY, z], rotY: Math.PI / 2, maxWidth: zSpacing * 0.8 });
      }
    }
    if (i === ROOMS.length - 1) {
      const zSpacing = DEPTH / 3;
      for (let k = 0; k < 3; k++) {
        const z = -DEPTH / 2 + zSpacing * (k + 0.5);
        slots.push({ pos: [room.maxX - margin, eyeY, z], rotY: -Math.PI / 2, maxWidth: zSpacing * 0.8 });
      }
    }
  });

  return slots;
}
