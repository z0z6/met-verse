import * as THREE from 'three';
import { resolveCollision } from './collision.js';

const keys = {};
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
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8c39e, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), bodyMat);
    body.position.y = 0.75;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), headMat);
    head.position.y = 1.45;
    g.add(head);

    g.visible = false; // widoczny tylko w TPP
    this.scene.add(g);
    this.avatar = g;
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

  setMode(mode) {
    this.mode = mode;
    this.avatar.visible = mode === 'tpp';
  }

  toggleMode() {
    this.setMode(this.mode === 'fpp' ? 'tpp' : 'fpp');
  }

  update(dt) {
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
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
    }

    this.avatar.position.set(this.player.x, 0, this.player.z);

    if (this.mode === 'fpp') {
      this.camera.position.set(this.player.x, this.eyeHeight, this.player.z);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      this.camera.quaternion.copy(q);
    } else {
      const dist = 4.2;
      const cx = this.player.x - Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
      const cz = this.player.z - Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
      const cy = 1.2 + Math.sin(this.pitch) * dist + 1.4;
      this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), dt * 6);
      this.camera.lookAt(this.player.x, 1.4, this.player.z);
    }
  }
}
