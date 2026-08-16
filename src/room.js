import * as THREE from 'three';

export const ROOMS = {
  main: { width: 26, depth: 16, height: 5.5, x: 0, z: 0 },
  east: { width: 16, depth: 14, height: 4.5, x: 21.5, z: 0 },
  west: { width: 14, depth: 12, height: 4.5, x: -20.5, z: 0 }
};

const DOOR_W = 3.5;

/* ========== TEKSTURY PROCEDURALNE ========== */

function createFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0ece4';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024, r = Math.random() * 2 + 0.5;
    ctx.fillStyle = Math.random() > 0.5 ? '#d4cfc7' : '#e8e4dc';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createPlasterTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f3ef';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 80000; i++) {
    ctx.fillStyle = `rgba(200,198,192,${Math.random() * 0.1})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createCeilingTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fafaf8';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#eae8e4'; ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 492, 492);
  ctx.strokeRect(30, 30, 452, 452);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ========== MEBLE ========== */

function createBubbleSofa() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.05 });
  const r = 0.32;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 2; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
      s.position.set(i * r * 1.6 - 1.28, r, j * r * 1.4 - 0.35);
      g.add(s);
    }
  }
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
    s.position.set(i * r * 1.6 - 1.28, r * 2.2, -0.9);
    g.add(s);
  }
  return g;
}

function createBubbleChair() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.05 });
  const r = 0.3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
      s.position.set(i * r * 1.5 - 0.45, r, j * r * 1.3 - 0.3);
      g.add(s);
    }
  }
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
    s.position.set(i * r * 1.5 - 0.45, r * 2.2, -0.8);
    g.add(s);
  }
  return g;
}

function createGreenBench() {
  const g = new THREE.Group();
  const cush = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.4 });
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.55), cush);
  c.position.y = 0.48; g.add(c);
  for (let x of [-0.8, 0.8]) {
    for (let z of [-0.2, 0.2]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48), frame);
      l.position.set(x, 0.24, z); g.add(l);
    }
  }
  return g;
}

function createRug(w, d, col = 0xc8b89a) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, side: THREE.DoubleSide })
  );
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
  return m;
}

function createPendantLight() {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.5), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  cord.position.y = 0.75; g.add(cord);
  const shade = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, side: THREE.DoubleSide })
  );
  shade.rotation.x = Math.PI; g.add(shade);
  const bulb = new THREE.PointLight(0xfff5e6, 5, 8, 2);
  bulb.position.y = -0.1; g.add(bulb);
  return g;
}

function createRoundWindow() {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.9 });
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 32), frame));
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glow.position.z = -0.01; g.add(glow);
  return g;
}

function addWall(scene, w, h, x, y, z, ry, mat) {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  wall.position.set(x, y, z);
  wall.rotation.y = ry;
  scene.add(wall);
}

/* ========== BUDOWA GALERII ========== */

export function buildGallery(scene) {
  const floorTex = createFloorTexture();
  const wallTex = createPlasterTexture();
  const ceilTex = createCeilingTexture();

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0.0, color: 0xffffff });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.8, metalness: 0.0, color: 0xffffff });

  const floors = [];

  // --- Sala główna ---
  const M = ROOMS.main;
  const mainFloor = new THREE.Mesh(new THREE.PlaneGeometry(M.width, M.depth), floorMat);
  mainFloor.rotation.x = -Math.PI / 2; mainFloor.position.set(M.x, 0, M.z);
  mainFloor.receiveShadow = true; mainFloor.name = 'floor';
  scene.add(mainFloor); floors.push(mainFloor);

  const mainCeil = new THREE.Mesh(new THREE.PlaneGeometry(M.width, M.depth), ceilMat);
  mainCeil.rotation.x = Math.PI / 2; mainCeil.position.set(M.x, M.height, M.z);
  scene.add(mainCeil);

  addWall(scene, M.width, M.height, M.x, M.height/2, M.z - M.depth/2, 0, wallMat);
  addWall(scene, M.width, M.height, M.x, M.height/2, M.z + M.depth/2, Math.PI, wallMat);

  const leftM = (M.depth - DOOR_W) / 2;
  addWall(scene, leftM, M.height, M.x - M.width/2, M.height/2, M.z - M.depth/2 + leftM/2, Math.PI/2, wallMat);
  addWall(scene, leftM, M.height, M.x - M.width/2, M.height/2, M.z + M.depth/2 - leftM/2, Math.PI/2, wallMat);
  addWall(scene, leftM, M.height, M.x + M.width/2, M.height/2, M.z - M.depth/2 + leftM/2, -Math.PI/2, wallMat);
  addWall(scene, leftM, M.height, M.x + M.width/2, M.height/2, M.z + M.depth/2 - leftM/2, -Math.PI/2, wallMat);

  // --- Sala wschodnia ---
  const E = ROOMS.east;
  const eastFloor = new THREE.Mesh(new THREE.PlaneGeometry(E.width, E.depth), floorMat);
  eastFloor.rotation.x = -Math.PI / 2; eastFloor.position.set(E.x, 0, E.z);
  eastFloor.receiveShadow = true; scene.add(eastFloor); floors.push(eastFloor);

  const eastCeil = new THREE.Mesh(new THREE.PlaneGeometry(E.width, E.depth), ceilMat);
  eastCeil.rotation.x = Math.PI / 2; eastCeil.position.set(E.x, E.height, E.z);
  scene.add(eastCeil);

  addWall(scene, E.width, E.height, E.x, E.height/2, E.z - E.depth/2, 0, wallMat);
  addWall(scene, E.width, E.height, E.x, E.height/2, E.z + E.depth/2, Math.PI, wallMat);
  addWall(scene, E.depth, E.height, E.x + E.width/2, E.height/2, E.z, -Math.PI/2, wallMat);

  const leftE = (E.depth - DOOR_W) / 2;
  addWall(scene, leftE, E.height, E.x - E.width/2, E.height/2, E.z - E.depth/2 + leftE/2, Math.PI/2, wallMat);
  addWall(scene, leftE, E.height, E.x - E.width/2, E.height/2, E.z + E.depth/2 - leftE/2, Math.PI/2, wallMat);

  // --- Sala zachodnia ---
  const W = ROOMS.west;
  const westFloor = new THREE.Mesh(new THREE.PlaneGeometry(W.width, W.depth), floorMat);
  westFloor.rotation.x = -Math.PI / 2; westFloor.position.set(W.x, 0, W.z);
  westFloor.receiveShadow = true; scene.add(westFloor); floors.push(westFloor);

  const westCeil = new THREE.Mesh(new THREE.PlaneGeometry(W.width, W.depth), ceilMat);
  westCeil.rotation.x = Math.PI / 2; westCeil.position.set(W.x, W.height, W.z);
  scene.add(westCeil);

  addWall(scene, W.width, W.height, W.x, W.height/2, W.z - W.depth/2, 0, wallMat);
  addWall(scene, W.width, W.height, W.x, W.height/2, W.z + W.depth/2, Math.PI, wallMat);
  addWall(scene, W.depth, W.height, W.x - W.width/2, W.height/2, W.z, Math.PI/2, wallMat);

  const leftW = (W.depth - DOOR_W) / 2;
  addWall(scene, leftW, W.height, W.x + W.width/2, W.height/2, W.z - W.depth/2 + leftW/2, -Math.PI/2, wallMat);
  addWall(scene, leftW, W.height, W.x + W.width/2, W.height/2, W.z + W.depth/2 - leftW/2, -Math.PI/2, wallMat);

  /* --- MEBLE --- */

  // Główna
  const sofa = createBubbleSofa();
  sofa.position.set(0, 0, 2); sofa.rotation.y = Math.PI;
  scene.add(sofa);
  scene.add(createRug(6, 4, 0xc8b89a)).position.set(0, 0, 2);

  const bench1 = createGreenBench();
  bench1.position.set(4, 0, 2); bench1.rotation.y = -Math.PI / 2;
  scene.add(bench1);

  const chair1 = createBubbleChair();
  chair1.position.set(-3, 0, 3); chair1.rotation.y = Math.PI / 4;
  scene.add(chair1);

  const lamp1 = createPendantLight();
  lamp1.position.set(0, M.height - 0.5, 0);
  scene.add(lamp1);

  // Wschodnia
  scene.add(createRug(5, 3.5, 0xd4c4a8)).position.set(E.x, 0, E.z);

  const chair2 = createBubbleChair(); chair2.position.set(E.x + 2, 0, E.z); chair2.rotation.y = -Math.PI/2; scene.add(chair2);
  const chair3 = createBubbleChair(); chair3.position.set(E.x - 2, 0, E.z); chair3.rotation.y = Math.PI/2; scene.add(chair3);

  const lamp2 = createPendantLight(); lamp2.position.set(E.x, E.height - 0.5, E.z); scene.add(lamp2);

  const win1 = createRoundWindow(); win1.position.set(E.x + E.width/2 - 0.1, 2.5, E.z); win1.rotation.y = Math.PI/2; scene.add(win1);

  // Zachodnia
  scene.add(createRug(4, 4, 0xbfb5a4)).position.set(W.x, 0, W.z);

  const bench2 = createGreenBench(); bench2.position.set(W.x, 0, W.z + 2); bench2.rotation.y = Math.PI; scene.add(bench2);

  const lamp3 = createPendantLight(); lamp3.position.set(W.x, W.height - 0.5, W.z); scene.add(lamp3);

  const win2 = createRoundWindow(); win2.position.set(W.x - W.width/2 + 0.1, 2.5, W.z); win2.rotation.y = -Math.PI/2; scene.add(win2);

  /* --- OŚWIETLENIE --- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a30, 0.35));

  const spots = [-8, -2.6, 2.6, 8];
  for (const x of spots) {
    const s = new THREE.SpotLight(0xfff2df, 40, 12, Math.PI/5, 0.4, 1.5);
    s.position.set(x, M.height - 0.1, 0);
    s.target.position.set(x, 0, 0);
    scene.add(s); scene.add(s.target);
  }

  return { floors, rooms: ROOMS };
}

/* ========== SLOTY NA OBRAZY ========== */

export function generateWallSlots() {
  const slots = [];
  const eyeY = 1.6, margin = 0.06;

  const addSlots = (room, count, spacing, axis, dir) => {
    for (let i = 0; i < count; i++) {
      const offset = -spacing * count / 2 + spacing * (i + 0.5);
      if (axis === 'x') {
        slots.push({
          pos: [room.x + offset, eyeY, room.z + dir * (room.depth/2 - margin)],
          rotY: dir > 0 ? Math.PI : 0,
          maxWidth: spacing * 0.75,
          room: room.name
        });
      } else {
        slots.push({
          pos: [room.x + dir * (room.width/2 - margin), eyeY, room.z + offset],
          rotY: dir > 0 ? -Math.PI/2 : Math.PI/2,
          maxWidth: spacing * 0.75,
          room: room.name
        });
      }
    }
  };

  // Główna: północ / południe (po 5)
  addSlots(ROOMS.main, 5, ROOMS.main.width/5, 'x', -1);
  addSlots(ROOMS.main, 5, ROOMS.main.width/5, 'x', 1);

  // Wschodnia: północ / południe (po 3), wschód (po 2)
  addSlots(ROOMS.east, 3, ROOMS.east.width/3, 'x', -1);
  addSlots(ROOMS.east, 3, ROOMS.east.width/3, 'x', 1);
  addSlots(ROOMS.east, 2, ROOMS.east.depth/2, 'z', 1);

  // Zachodnia: północ / południe (po 2), zachód (po 2)
  addSlots(ROOMS.west, 2, ROOMS.west.width/2, 'x', -1);
  addSlots(ROOMS.west, 2, ROOMS.west.width/2, 'x', 1);
  addSlots(ROOMS.west, 2, ROOMS.west.depth/2, 'z', -1);

  return slots;
}

/* ========== PUNKTY SPAWN / TRIGGERY ========== */

export const SPAWN_POINTS = {
  main: new THREE.Vector3(0, 0, 4),
  east: new THREE.Vector3(ROOMS.east.x, 0, ROOMS.east.z),
  west: new THREE.Vector3(ROOMS.west.x, 0, ROOMS.west.z)
};

export const DOOR_TRIGGERS = [
  { from: 'main', to: 'east', pos: new THREE.Vector3(ROOMS.main.width/2 + 1.5, 0, 0), size: new THREE.Vector3(3, 3, 3) },
  { from: 'east', to: 'main', pos: new THREE.Vector3(ROOMS.east.x - ROOMS.east.width/2 - 1.5, 0, 0), size: new THREE.Vector3(3, 3, 3) },
  { from: 'main', to: 'west', pos: new THREE.Vector3(-ROOMS.main.width/2 - 1.5, 0, 0), size: new THREE.Vector3(3, 3, 3) },
  { from: 'west', to: 'main', pos: new THREE.Vector3(ROOMS.west.x + ROOMS.west.width/2 + 1.5, 0, 0), size: new THREE.Vector3(3, 3, 3) }
];