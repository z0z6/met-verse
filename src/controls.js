import * as THREE from 'three';

export class GalleryControls {
  constructor(camera, domElement, scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;

    this.mode = 'fpp'; // 'fpp' lub 'tpp'
    this.player = new THREE.Vector3(0, 1.6, 5); // Pozycja startowa gracza
    this.velocity = new THREE.Vector3();
    
    this.yaw = 0;
    this.pitch = 0;

    this.keys = { forward: false, backward: false, left: false, right: false, shift: false };
    
    this.raycaster = new THREE.Raycaster();
    this.collidables = []; // Zostanie uzupełnione obiektami ze sceny

    this.initEvents();
  }

  setMode(mode) {
    this.mode = mode;
  }

  toggleMode() {
    this.mode = this.mode === 'fpp' ? 'tpp' : 'fpp';
  }

  initEvents() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.domElement) {
        this.yaw -= e.movementX * 0.002;
        this.pitch -= e.movementY * 0.002;
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
      }
    });
  }

  onKey(e, pressed) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.keys.forward = pressed; break;
      case 'KeyS': case 'ArrowDown': this.keys.backward = pressed; break;
      case 'KeyA': case 'ArrowLeft': this.keys.left = pressed; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = pressed; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.shift = pressed; break;
    }
  }

  // Wyszukaj ściany i meble w scenie do kolizji
  updateCollidables() {
    this.collidables = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.name !== 'floor' && !child.userData?.isFloor) {
        this.collidables.push(child);
      }
    });
  }

  checkCollision(targetPos) {
    if (this.collidables.length === 0) this.updateCollidables();

    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];

    const playerRadius = 0.5; // Zasięg kolizji wokół gracza

    for (const dir of directions) {
      this.raycaster.set(new THREE.Vector3(targetPos.x, 1.0, targetPos.z), dir);
      const hits = this.raycaster.intersectObjects(this.collidables, true);
      if (hits.length > 0 && hits[0].distance < playerRadius) {
        return true; // Wykryto kolizję
      }
    }
    return false;
  }

  update(dt) {
    const speed = (this.keys.shift ? 6.0 : 3.0) * dt;
    
    // NAPRAWIONE STEROWANIE LEWO / PRAWO ORAZ PRZÓD / TYŁ:
    const moveZ = Number(this.keys.backward) - Number(this.keys.forward);
    // Poprawiona oś X: A idzie w lewo (-1), D idzie w prawo (+1)
    const moveX = Number(this.keys.right) - Number(this.keys.left);

    const inputDir = new THREE.Vector3(moveX, 0, moveZ);
    
    if (inputDir.lengthSq() > 0) {
      inputDir.normalize();
      
      // Obrót wektora ruchu zgodnie z kątem patrzenia (yaw)
      const moveVector = inputDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      moveVector.multiplyScalar(speed);

      // Obliczenie propozycji nowej pozycji
      const targetPos = this.player.clone().add(moveVector);

      // Blokowanie przechodzenia przez ściany
      if (!this.checkCollision(targetPos)) {
        this.player.copy(targetPos);
      }
    }

    // Ustawienie wysokości wzroku gracza
    this.player.y = 1.6;

    // AKTUALIZACJA KAMERY W ZALEŻNOŚCI OD TRYBU (FPP / TPP)
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    if (this.mode === 'fpp') {
      // Pierwsza osoba: kamera dokładnie w pozycji gracza
      this.camera.position.copy(this.player);
    } else {
      // Trzecia osoba: kamera oddalona za graczem
      const offset = new THREE.Vector3(0, 0.8, 2.5).applyEuler(euler);
      this.camera.position.copy(this.player).add(offset);
    }
  }
}
