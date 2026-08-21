import * as THREE from 'three';
import { resolveCollision } from './collision.js';

export const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

export class GalleryControls {
  constructor(camera, domElement, scene) {
    this.camera = camera;
    this.dom = domElement;
    this.scene = scene;

    this.mode = 'fpp'; // 'fpp' | 'tpp'
    this.yaw = 0;
    this.pitch = 0;
    this.player = new THREE.Vector3(0, 0, 5);
    this.eyeHeight = 1.65;
    this.locked = false;

    this._buildAvatar();
    this._bindPointerLock();
  }

  _buildAvatar() {
    const g = new THREE.Group();
    const SKIN = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
    const SHIRT = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.65 });
    const PANTS = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.8 });
    const SHOE = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5 });

    const hipY = 0.85;

    // Tors
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.32, 4, 8), SHIRT);
    torso.position.y = hipY + 0.16 + 0.31;
    g.add(torso);

    // Szyja
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 8), SKIN);
    neck.position.y = torso.position.y + 0.16 + 0.31;
    g.add(neck);

    // Głowa
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 16), SKIN);
    head.position.y = neck.position.y + 0.075 + 0.1;
    g.add(head);

    // Pomocnicza funkcja: kończyna jako kapsuła, której LOKALNE zero leży
    // u GÓRY (bark/biodro) — dzięki temu obrót (animacja chodu) pivotuje
    // z właściwego miejsca, tak jak poprawiliśmy wcześniej przy dracenie.
    function limb(length, radius, mat) {
      const geo = new THREE.CapsuleGeometry(radius, length, 4, 8);
      geo.translate(0, -(length / 2 + radius), 0);
      return new THREE.Mesh(geo, mat);
    }

    const shoulderY = torso.position.y + 0.16 + 0.31 - 0.05;
    this.legPivots = [];
    this.armPivots = [];

    for (const side of [-1, 1]) {
      // Ramię
      const arm = limb(0.42, 0.05, SKIN.clone());
      arm.position.set(side * 0.2, shoulderY, 0);
      arm.rotation.z = side * 0.12;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), SKIN);
      hand.position.y = -(0.42 + 0.1);
      arm.add(hand);
      this.armPivots.push(arm);

      // Noga
      const leg = limb(0.6, 0.08, PANTS.clone());
      leg.position.set(side * 0.1, hipY, 0);
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.18), SHOE);
      foot.position.set(0, -(0.6 + 0.16), 0.03);
      leg.add(foot);
      this.legPivots.push(leg);
    }

    g.visible = false; // widoczny tylko w TPP
    this.scene.add(g);
    this.avatar = g;
    this._walkPhase = 0;
  }

  _bindPointerLock() {
    this.dom.addEventListener('click', () => {
      if (!this.locked) this.dom.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch));
    });
  }

  // Rozglądanie się przez dotyk (mobile) — ta sama formuła co w mousemove,
  // ale wywoływana bezpośrednio, niezależnie od blokady kursora (Pointer Lock
  // i tak nie ma sensu/nie działa tak samo na dotykowych przeglądarkach).
  applyLookDelta(dx, dy) {
    this.yaw -= dx * 0.0035;
    this.pitch -= dy * 0.0035;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch));
  }

  setMode(mode) {
    this.mode = mode;
    this.avatar.visible = mode === 'tpp';
  }

  toggleMode() {
    this.setMode(this.mode === 'fpp' ? 'tpp' : 'fpp');
  }

  update(dt) {
    // Kierunek "przód" = tam, gdzie faktycznie patrzy kamera (domyślnie -Z w three.js).
    // Poprzednio wektor miał odwrócony znak, przez co W/S i kamera TPP działały na odwrót.
    const dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let fwd = 0, strafe = 0;
    if (keys['w'] || keys['arrowup']) fwd += 1;
    if (keys['s'] || keys['arrowdown']) fwd -= 1;
    if (keys['a'] || keys['arrowleft']) strafe -= 1;
    if (keys['d'] || keys['arrowright']) strafe += 1;

    const speed = (keys['shift'] ? 4.2 : 2.4);
    if (fwd !== 0 || strafe !== 0) {
      const move = new THREE.Vector3()
        .addScaledVector(dir, fwd)
        .addScaledVector(right, strafe)
        .normalize()
        .multiplyScalar(speed * dt);
      this.player.add(move);
      resolveCollision(this.player, 0.45);

      if (this.mode === 'tpp') {
        const targetYaw = Math.atan2(move.x, move.z);
        let diff = targetYaw - this.avatar.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.avatar.rotation.y += diff * Math.min(dt * 10, 1);
      }

      // Animacja chodu — wymach nóg i rąk na przeciwne strony
      this._walkPhase += dt * speed * 3.2;
      const swing = Math.sin(this._walkPhase) * 0.55;
      this.legPivots[0].rotation.x = swing;
      this.legPivots[1].rotation.x = -swing;
      this.armPivots[0].rotation.x = -swing * 0.8;
      this.armPivots[1].rotation.x = swing * 0.8;
    } else {
      // Powrót do pozycji spoczynkowej, gdy postać stoi
      for (const l of this.legPivots) l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0, dt * 6);
      for (const a of this.armPivots) a.rotation.x = THREE.MathUtils.lerp(a.rotation.x, 0, dt * 6);
    }

    this.avatar.position.set(this.player.x, 0, this.player.z);

    if (this.mode === 'fpp') {
      this.camera.position.set(this.player.x, this.eyeHeight, this.player.z);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      this.camera.quaternion.copy(q);
    } else {
      const dist = 4.2;
      const cx = this.player.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
      const cz = this.player.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
      const cy = 1.2 + Math.sin(this.pitch) * dist + 1.4;
      this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), dt * 6);
      this.camera.lookAt(this.player.x, 1.4, this.player.z);
    }
  }
}
