import * as THREE from 'three';

// Ta sama detekcja co w pozostałych plikach src/.
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

const loader = new THREE.TextureLoader();

function load(path, colorSpace) {
  const tex = loader.load(path);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (colorSpace) tex.colorSpace = colorSpace;
  // Filtrowanie anizotropowe poprawia ostrość tekstur widzianych pod kątem
  // (podłoga, ściany), ale kosztuje próbkowań GPU proporcjonalnie do
  // poziomu — na mobile, zwłaszcza w VR (podwójne renderowanie stereo),
  // ograniczamy je zamiast maksować do 8x jak na desktopie.
  tex.anisotropy = IS_MOBILE ? 2 : 8;
  return tex;
}

export function loadFloorMaterial(repeatX, repeatY) {
  const map = load('textures/floor_color.webp', THREE.SRGBColorSpace);
  // normal/roughness zostają w JPG — patrz generate_webp.py (SKIP_LOSSY_KEYWORDS)
  const normalMap = load('textures/floor_normal.jpg');
  const roughnessMap = load('textures/floor_roughness.jpg');
  [map, normalMap, roughnessMap].forEach(t => t.repeat.set(repeatX, repeatY));
  return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, metalness: 0.15, roughness: 0.9 });
}

export function loadWallMaterial(repeatX, repeatY) {
  const map = load('textures/wall_color.webp', THREE.SRGBColorSpace);
  const normalMap = load('textures/wall_normal.jpg');
  [map, normalMap].forEach(t => t.repeat.set(repeatX, repeatY));
  return new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.95, metalness: 0.0 });
}

export function loadCeilingMaterial(repeatX, repeatY) {
  const map = load('textures/ceiling_color.webp', THREE.SRGBColorSpace);
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}

export function loadRugMaterial(repeatX, repeatY) {
  const map = load('textures/rug_color.webp', THREE.SRGBColorSpace);
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 1.0 });
}
