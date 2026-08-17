// Układ: trzy sale w rzędzie wzdłuż osi X, ta sama głębokość — dzięki temu
// cała bryła to jeden prostokąt na zewnątrz, a wewnętrzne ściany działowe
// (z przejściami/drzwiami) obsługujemy osobno jako proste kolizje liniowe.

export const DEPTH = 16;
export const ROOM_WIDTHS = [16, 16, 16]; // zachodnia / główna / wschodnia
export const DOOR_HALF_WIDTH = 1.6; // połowa szerokości przejścia między salami

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

export function resolveCollision(pos, radius = 0.5) {
  const margin = 0.5;
  pos.x = Math.max(BOUNDS.minX + margin, Math.min(BOUNDS.maxX - margin, pos.x));
  pos.z = Math.max(BOUNDS.minZ + margin, Math.min(BOUNDS.maxZ - margin, pos.z));

  for (const px of PARTITIONS) {
    const inDoorway = Math.abs(pos.z) < DOOR_HALF_WIDTH - radius;
    if (inDoorway) continue;
    if (Math.abs(pos.x - px) < radius) {
      pos.x = px + Math.sign(pos.x - px || 1) * radius;
    }
  }
  return pos;
}
