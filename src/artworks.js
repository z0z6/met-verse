import * as THREE from 'three';
import { generateWallSlots } from './room.js';

const loader = new THREE.TextureLoader();
const MAX_H = 2.0;
const FRAME_PAD = 0.08;

function makeCaptionTexture(title, author) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f0f0f0';
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(title || 'Bez tytułu', 16, 12);
  if (author) {
    ctx.fillStyle = '#9a9a9a';
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.fillText(author, 16, 54);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function placeholderTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d8d4c8';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#a8a498';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, 472, 472);
  ctx.beginPath();
  ctx.moveTo(20, 20); ctx.lineTo(492, 492);
  ctx.moveTo(492, 20); ctx.lineTo(20, 492);
  ctx.stroke();
  ctx.fillStyle = '#8a8578';
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('wolne miejsce', 256, 460);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFrame(group, texture, maxWidth, aspect) {
  let w = maxWidth;
  let h = w / aspect;
  if (h > MAX_H) { h = MAX_H; w = h * aspect; }

  const frameGeo = new THREE.BoxGeometry(w + FRAME_PAD * 2, h + FRAME_PAD * 2, 0.05);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x181613, roughness: 0.4, metalness: 0.2 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.z = -0.02;
  group.add(frame);

  const imgMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
  const img = new THREE.Mesh(new THREE.PlaneGeometry(w, h), imgMat);
  img.position.z = 0.04;
  group.add(img);

  const light = new THREE.PointLight(0xfff5e6, 8, 3, 2);
  light.position.set(0, h / 2 + 0.5, 0.6);
  group.add(light);

  return h;
}

export async function loadArtworks(scene) {
  const slots = generateWallSlots();
  let manifest = [];
  try {
    const res = await fetch('artworks.json');
    if (res.ok) manifest = await res.json();
  } catch (e) {
    console.warn('[Artworks] Nie znaleziono artworks.json — sala będzie pusta (placeholdery).', e);
  }

  const interactive = [];

  slots.forEach((slot, i) => {
    const group = new THREE.Group();
    group.position.set(...slot.pos);
    group.rotation.y = slot.rotY;

    const entry = manifest[i];

    if (entry) {
      loader.load(
        entry.file,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const aspect = tex.image.width / tex.image.height;
          const h = buildFrame(group, tex, slot.maxWidth, aspect);
          addCaption(group, entry, h);
        },
        undefined,
        (err) => {
          console.error(`[Artworks] Błąd wczytywania ${entry.file}`, err);
          buildFrame(group, placeholderTexture(), slot.maxWidth, 1);
        }
      );
    } else {
      buildFrame(group, placeholderTexture(), slot.maxWidth, 1);
    }

    group.userData.caption = entry ? `${entry.title || ''}${entry.author ? ' — ' + entry.author : ''}` : 'Wolne miejsce — dodaj obraz w artworks.json';
    interactive.push(group);
    scene.add(group);
  });

  return interactive;
}

function addCaption(group, entry, imgHeight) {
  const tex = makeCaptionTexture(entry.title, entry.author);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9 * (96 / 512)), mat);
  plate.position.set(0, -imgHeight / 2 - 0.18, 0.01);
  group.add(plate);
}
