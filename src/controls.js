import * as THREE from 'three';
import { resolveCollision } from './collision.js';
import { ROOM_HEIGHT } from './room.js';

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

    // Dłonie, szyja i głowa zostają w dotychczasowym kolorze "skóry";
    // reszta ciała (tors, ramiona, nogi, stopy) jest czarna.
    const SKIN  = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
    const BODY  = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.55, metalness: 0.05 });

    // Pomocnicza: segment kończyny jako kapsuła, której LOKALNE zero leży
    // u GÓRY (staw) — obrót pivotu (animacja chodu) dzieje się więc dokładnie
    // w barku/biodrze, a nie w środku bryły.
    function segment(length, radius, mat, capSeg = 6, radialSeg = 14) {
      const geo = new THREE.CapsuleGeometry(radius, length, capSeg, radialSeg);
      geo.translate(0, -(length / 2 + radius), 0);
      return new THREE.Mesh(geo, mat);
    }
    // Odcinek pełnej długości segmentu (razem z półkulistymi końcówkami) —
    // używany do wyliczania, gdzie zaczyna się kolejna część ciała, tak
    // żeby zawsze zachodziły na siebie i nigdzie nie zostawała przerwa.
    const spanOf = (length, radius) => length + 2 * radius;

    // ---------- Nogi: wydłużone dla naturalnych proporcji ----------
    const footH = 0.06;
    const shinLen = 0.26, shinRad = 0.055;   // łydka wydłużona (było 0.20)
    const thighLen = 0.28, thighRad = 0.07;  // udo wydłużone (było 0.21)
    const ankleY = footH - 0.01; // lekka zakładka ze stopą
    const kneeY  = ankleY + spanOf(shinLen, shinRad);
    const hipY   = kneeY + spanOf(thighLen, thighRad);

    // ---------- Tors: skompaktowany dla lepszych proporcji ----------
    const waistLen = 0.06, waistRad = 0.115; // talia/brzuch skrócony (było 0.08)
    const chestLen = 0.18, chestRad = 0.145; // klatka piersiowa (było 0.17)
    const waistY   = hipY + spanOf(waistLen, waistRad) / 2 - 0.028;
    const waistTop = waistY + spanOf(waistLen, waistRad) / 2;
    const chestY   = waistTop + spanOf(chestLen, chestRad) / 2 - 0.03;
    const chestTop = chestY + spanOf(chestLen, chestRad) / 2;
    const shoulderY = chestTop - 0.018;

    // ---------- Szyja i głowa ----------
    const neckLen = 0.045, neckRTop = 0.048, neckRBot = 0.058;
    const neckY   = shoulderY + neckLen / 2 + 0.004;
    const neckTop = neckY + neckLen / 2;
    const headR   = 0.108;
    const headY   = neckTop + headR * 0.55;

    // --- Miednica: łączy nogi (rozstawione na boki) ze środkiem tułowia ---
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), BODY);
    pelvis.position.y = hipY - 0.02;
    pelvis.scale.set(1.25, 0.85, 1.0);
    g.add(pelvis);

    // --- Talia (węższa) i klatka piersiowa (szersza), bez przerwy między nimi ---
    const waist = new THREE.Mesh(new THREE.CapsuleGeometry(waistRad, waistLen, 6, 16), BODY);
    waist.position.y = waistY;
    g.add(waist);

    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(chestRad, chestLen, 6, 16), BODY);
    chest.position.y = chestY;
    g.add(chest);

    // --- Szyja: zachodzi jednocześnie na klatkę piersiową i na głowę ---
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(neckRTop, neckRBot, neckLen, 14), SKIN);
    neck.position.y = neckY;
    g.add(neck);

    // --- Głowa: lekko wydłużona sfera (bardziej ludzki kształt niż idealna kula) ---
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 22, 20), SKIN);
    head.position.y = headY;
    head.scale.set(0.93, 1.08, 0.96);
    g.add(head);

    this.legPivots = [];
    this.armPivots = [];

    for (const side of [-1, 1]) {
      // ================= RAMIĘ =================
      const armPivot = new THREE.Group();
      armPivot.position.set(side * (chestRad + 0.035), shoulderY - 0.09, 0);
      g.add(armPivot);

      // Staw barkowy — spaja klatkę piersiową z ramieniem
      const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), BODY);
      armPivot.add(shoulderJoint);

      const upperArmLen = 0.18, upperArmRad = 0.048; // lekko wydłużone (było 0.16)
      const upperArm = segment(upperArmLen, upperArmRad, BODY);
      upperArm.rotation.z = side * 0.09;
      armPivot.add(upperArm);

      const elbowY = -spanOf(upperArmLen, upperArmRad);
      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), BODY);
      elbowJoint.position.y = elbowY;
      armPivot.add(elbowJoint);

      const forearmLen = 0.17, forearmRad = 0.04; // lekko wydłużone (było 0.15)
      const forearm = segment(forearmLen, forearmRad, BODY);
      forearm.position.y = elbowY;
      forearm.rotation.z = side * 0.05;
      armPivot.add(forearm);

      // Dłoń — spłaszczona kula w kolorze skóry
      const wristY = elbowY - spanOf(forearmLen, forearmRad);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12), SKIN);
      hand.position.y = wristY;
      hand.scale.set(0.8, 1.15, 0.6);
      armPivot.add(hand);

      this.armPivots.push(armPivot);

      // ================= NOGA =================
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.1, hipY, 0);
      g.add(legPivot);

      // Staw biodrowy — spaja miednicę z udem
      const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), BODY);
      legPivot.add(hipJoint);

      const thigh = segment(thighLen, thighRad, BODY);
      legPivot.add(thigh);

      const kneeLocalY = -spanOf(thighLen, thighRad);
      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), BODY);
      kneeJoint.position.y = kneeLocalY;
      legPivot.add(kneeJoint);

      const shin = segment(shinLen, shinRad, BODY);
      shin.position.y = kneeLocalY;
      legPivot.add(shin);

      const ankleLocalY = kneeLocalY - spanOf(shinLen, shinRad);
      const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), BODY);
      ankleJoint.position.y = ankleLocalY;
      legPivot.add(ankleJoint);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, footH, 0.19), BODY);
      foot.position.set(0, ankleLocalY - footH * 0.35, 0.045);
      legPivot.add(foot);

      this.legPivots.push(legPivot);
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
      let cy = 1.2 + Math.sin(this.pitch) * dist + 1.4;

      const camXZ = new THREE.Vector3(cx, 0, cz);
      resolveCollision(camXZ, 0.3, 0.3);
      cy = Math.max(0.35, Math.min(ROOM_HEIGHT - 0.35, cy));

      this.camera.position.lerp(new THREE.Vector3(camXZ.x, cy, camXZ.z), dt * 6);
      this.camera.lookAt(this.player.x, 1.4, this.player.z);
    }
  }
}
