// Układ: trzy sale w rzędzie wzdłuż osi X, ta sama głębokość — dzięki temu
// cała bryła to jeden prostokąt na zewnątrz, a wewnętrzne ściany działowe
// (z przejściami/drzwiami) obsługujemy osobno jako proste kolizje liniowe.

export const DEPTH = 16;
export const ROOM_WIDTHS = [16, 16, 16]; // zachodnia / główna / wschodnia
export const DOOR_HALF_WIDTH = 1.6; // połowa szerokości przejścia między salami
export const WALL_THICKNESS = 0.55; // grubość ścian działowych — proporcjonalna do 16 m sali

const totalWidth = ROOM_WIDTHS.reduce((a, b) => a + b, 0);

// Granice sal w osi X (kolejno)
export const ROOMS = (() => {
  let x = -totalWidth / 2;
  return ROOM_WIDTHS.map((w) => {
    const room = { minX: x, maxX: x + w };
    x += w;
    return room;
  });
})();

export const BOUNDS = {
  minX: -totalWidth / 2,
  maxX: totalWidth / 2,
  minZ: -DEPTH / 2,
  maxZ: DEPTH / 2,
};

// Ściany działowe (na granicach sal) z przejściem na środku
export const PARTITIONS = ROOMS.slice(0, -1).map((room) => room.maxX);

export const OBSTACLES = []; // { x, z, radius } — wypełniane przy budowie mebli

export function resolveCollision(pos, radius = 0.5, margin = 0.5) {
  pos.x = Math.max(BOUNDS.minX + margin, Math.min(BOUNDS.maxX - margin, pos.x));
  pos.z = Math.max(BOUNDS.minZ + margin, Math.min(BOUNDS.maxZ - margin, pos.z));

  for (const px of PARTITIONS) {
    const inDoorway = Math.abs(pos.z) < DOOR_HALF_WIDTH - radius;
    if (inDoorway) continue;
    const halfWall = WALL_THICKNESS / 2;
    if (Math.abs(pos.x - px) < halfWall + radius) {
      pos.x = px + Math.sign(pos.x - px || 1) * (halfWall + radius);
    }
  }

  for (const obs of OBSTACLES) {
    if (obs.radius !== undefined) {
      const dx = pos.x - obs.x, dz = pos.z - obs.z;
      const dist = Math.hypot(dx, dz);
      const minDist = obs.radius + radius;
      if (dist < minDist && dist > 0.0001) {
        const push = minDist / dist;
        pos.x = obs.x + dx * push;
        pos.z = obs.z + dz * push;
      }
    } else {
      // prostokątna przeszkoda (np. ławka) — dokładniejsza niż okrąg dla wydłużonych mebli
      const rx0 = obs.minX - radius, rx1 = obs.maxX + radius;
      const rz0 = obs.minZ - radius, rz1 = obs.maxZ + radius;
      if (pos.x > rx0 && pos.x < rx1 && pos.z > rz0 && pos.z < rz1) {
        const dL = pos.x - rx0, dR = rx1 - pos.x, dT = pos.z - rz0, dB = rz1 - pos.z;
        const m = Math.min(dL, dR, dT, dB);
        if (m === dL) pos.x = rx0; else if (m === dR) pos.x = rx1;
        else if (m === dT) pos.z = rz0; else pos.z = rz1;
      }
    }
  }
  return pos;
}
