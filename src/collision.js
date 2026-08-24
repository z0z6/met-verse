import * as THREE from 'three';

// Room dimensions and layout
const DEPTH = 24;
const WALL_THICKNESS = 0.6;
const DOOR_HALF_WIDTH = 2.5;

// Room boundaries
const BOUNDS = {
  minX: -12,
  maxX: 12,
  minZ: -DEPTH/2,
  maxZ: DEPTH/2
};

// Partition wall positions (X coordinates where internal walls are)
const PARTITIONS = [-4, 4];

// Room definitions
const ROOMS = [
  // West room
  { minX: BOUNDS.minX, maxX: PARTITIONS[0], minZ: BOUNDS.minZ, maxZ: BOUNDS.maxZ },
  // Main room
  { minX: PARTITIONS[0], maxX: PARTITIONS[1], minZ: BOUNDS.minZ, maxZ: BOUNDS.maxZ },
  // East room
  { minX: PARTITIONS[1], maxX: BOUNDS.maxX, minZ: BOUNDS.minZ, maxZ: BOUNDS.maxZ }
];

// Obstacles array - will be populated by main.js
const OBSTACLES = [];

/**
 * Check if a point is inside the valid bounds
 */
export function isInsideBounds(point, margin = 0) {
  return point.x >= BOUNDS.minX + margin &&
         point.x <= BOUNDS.maxX - margin &&
         point.z >= BOUNDS.minZ + margin &&
         point.z <= BOUNDS.maxZ - margin;
}

/**
 * Check if a line segment between two points crosses a solid wall
 */
export function crossesSolidWall(start, end, radius) {
  const dir = new THREE.Vector3().subVectors(end, start).normalize();
  const distance = start.distanceTo(end);

  // Check each wall plane
  const walls = [
    // External walls
    { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3(BOUNDS.maxX, 0, 0) },
    { normal: new THREE.Vector3(-1, 0, 0), point: new THREE.Vector3(BOUNDS.minX, 0, 0) },
    { normal: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(0, 0, BOUNDS.maxZ) },
    { normal: new THREE.Vector3(0, 0, -1), point: new THREE.Vector3(0, 0, BOUNDS.minZ) },
    // Partition walls (excluding doorways)
    { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3(PARTITIONS[0], 0, 0),
      minZ: DOOR_HALF_WIDTH, maxZ: BOUNDS.maxZ, isPartition: true },
    { normal: new THREE.Vector3(-1, 0, 0), point: new THREE.Vector3(PARTITIONS[0], 0, 0),
      minZ: BOUNDS.minZ, maxZ: -DOOR_HALF_WIDTH, isPartition: true },
    { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3(PARTITIONS[1], 0, 0),
      minZ: DOOR_HALF_WIDTH, maxZ: BOUNDS.maxZ, isPartition: true },
    { normal: new THREE.Vector3(-1, 0, 0), point: new THREE.Vector3(PARTITIONS[1], 0, 0),
      minZ: BOUNDS.minZ, maxZ: -DOOR_HALF_WIDTH, isPartition: true }
  ];

  for (const wall of walls) {
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(wall.normal, wall.point);
    const ray = new THREE.Ray(start, dir);
    const intersect = new THREE.Vector3();

    if (ray.intersectPlane(plane, intersect)) {
      if (start.distanceTo(intersect) <= distance) {
        // For partition walls, check if intersection is within the wall segment (not doorway)
        if (wall.isPartition) {
          if (intersect.z >= wall.minZ && intersect.z <= wall.maxZ) {
            return true; // Hits solid part of partition wall
          }
        } else {
          return true; // Hits external wall
        }
      }
    }
  }

  return false;
}

/**
 * Resolve collision for a point with room boundaries and obstacles
 * Pushes the point out of collisions
 */
export function resolveCollision(point, radius, height) {
  let moved = false;

  // First, clamp to room boundaries with margin
  const margin = radius;
  point.x = Math.max(BOUNDS.minX + margin, Math.min(BOUNDS.maxX - margin, point.x));
  point.z = Math.max(BOUNDS.minZ + margin, Math.min(BOUNDS.maxZ - margin, point.z));

  // Check collision with circular obstacles
  for (const obs of OBSTACLES) {
    if (obs.radius !== undefined) {
      const dx = point.x - obs.x;
      const dz = point.z - obs.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radius + obs.radius) {
        moved = true;
        const angle = Math.atan2(dz, dx);
        const pushDist = (radius + obs.radius) - dist;
        point.x += Math.cos(angle) * pushDist * 0.5;
        point.z += Math.sin(angle) * pushDist * 0.5;
      }
    }
  }

  // Check collision with rectangular obstacles
  for (const obs of OBSTACLES) {
    if (obs.minX !== undefined) {
      if (point.x > obs.minX - radius && point.x < obs.maxX + radius &&
          point.z > obs.minZ - radius && point.z < obs.maxZ + radius) {

        moved = true;
        const pushX = Math.max(obs.minX + radius - point.x, point.x - (obs.maxX - radius));
        const pushZ = Math.max(obs.minZ + radius - point.z, point.z - (obs.maxZ - radius));

        if (Math.abs(pushX) < Math.abs(pushZ)) {
          point.x += pushX;
        } else {
          point.z += pushZ;
        }
      }
    }
  }

  // Clamp again after obstacle resolution
  point.x = Math.max(BOUNDS.minX + radius, Math.min(BOUNDS.maxX - radius, point.x));
  point.z = Math.max(BOUNDS.minZ + radius, Math.min(BOUNDS.maxZ - radius, point.z));

  return moved;
}

// Export all constants and functions
export {
  ROOMS,
  OBSTACLES,
  DEPTH,
  PARTITIONS,
  DOOR_HALF_WIDTH,
  WALL_THICKNESS,
  BOUNDS
};
