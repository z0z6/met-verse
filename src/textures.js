import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function load(path, colorSpace) {
  const tex = loader.load(path);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (colorSpace) tex.colorSpace = colorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function loadFloorMaterial(repeatX, repeatY) {
  const map = load('textures/floor_color.jpg', THREE.SRGBColorSpace);
  const normalMap = load('textures/floor_normal.jpg');
  const roughnessMap = load('textures/floor_roughness.jpg');
  [map, normalMap, roughnessMap].forEach(t => t.repeat.set(repeatX, repeatY));
  return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, metalness: 0.15, roughness: 0.9 });
}

export function loadWallMaterial(repeatX, repeatY) {
  const map = load('textures/wall_color.jpg', THREE.SRGBColorSpace);
  const normalMap = load('textures/wall_normal.jpg');
  [map, normalMap].forEach(t => t.repeat.set(repeatX, repeatY));
  return new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.95, metalness: 0.0 });
}

export function loadCeilingMaterial(repeatX, repeatY) {
  const map = load('textures/ceiling_color.jpg', THREE.SRGBColorSpace);
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}

export function loadRugMaterial(repeatX, repeatY) {
  const map = load('textures/rug_color.jpg', THREE.SRGBColorSpace);
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}
