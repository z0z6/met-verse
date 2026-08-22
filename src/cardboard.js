import * as THREE from 'three';

// Standardowa konwersja DeviceOrientationEvent -> quaternion (ten sam algorytm,
// który przez lata był w three.js/examples/jsm/controls/DeviceOrientationControls.js).
const ZEE = new THREE.Vector3(0, 0, 1);
const EULER = new THREE.Euler();
const Q0 = new THREE.Quaternion();
const Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 wokół X

function orientationToQuaternion(target, alpha, beta, gamma, orient) {
  EULER.set(beta, alpha, -gamma, 'YXZ');
  target.setFromEuler(EULER);
  target.multiply(Q1);
  target.multiply(Q0.setFromAxisAngle(ZEE, -orient));
}

export class CardboardMode {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.stereo = new THREE.StereoCamera();
    this.stereo.eyeSep = 0.064; // typowy rozstaw oczu (m)
    this.enabled = false;

    this._alpha = 0; this._beta = 0; this._gamma = 0;
    this._quat = new THREE.Quaternion();
    this._hasSensor = false;

    this._onOrient = (e) => {
      if (e.alpha === null) return;
      this._hasSensor = true;
      this._alpha = THREE.MathUtils.degToRad(e.alpha);
      this._beta = THREE.MathUtils.degToRad(e.beta);
      this._gamma = THREE.MathUtils.degToRad(e.gamma);
    };
  }

  async enable() {
    // iOS wymaga jawnej zgody użytkownika (musi być wywołane z gestu kliknięcia)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { await DeviceOrientationEvent.requestPermission(); } catch (e) { /* ignorujemy — spróbujemy i tak nasłuchiwać */ }
    }
    window.addEventListener('deviceorientation', this._onOrient);
    try { await document.documentElement.requestFullscreen(); } catch (e) { /* niekrytyczne */ }
    try { await screen.orientation.lock('landscape'); } catch (e) { /* niekrytyczne — nie wszędzie wspierane */ }
    this.enabled = true;
  }

  disable() {
    window.removeEventListener('deviceorientation', this._onOrient);
    this.enabled = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  getOrientationQuaternion() {
    const orient = (screen.orientation && screen.orientation.angle ? THREE.MathUtils.degToRad(screen.orientation.angle) : 0);
    orientationToQuaternion(this._quat, this._alpha, this._beta, this._gamma, orient);
    return this._quat;
  }

  // Renderuje scenę dwukrotnie (lewe/prawe oko) obok siebie — klasyczny układ Cardboard.
  render(scene) {
    if (this._hasSensor) {
      this.camera.quaternion.copy(this.getOrientationQuaternion());
    }

    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const halfW = size.x / 2;

    // BŁĄD 1: kamera musi mieć proporcje POŁOWY ekranu (tyle, ile faktycznie
    // zajmuje jedno oko), inaczej cała scena — łącznie ze ścianami — renderuje
    // się spłaszczona w poziomie i wygląda jakby nie zamykała pomieszczenia.
    const eyeAspect = halfW / size.y;
    if (this.camera.aspect !== eyeAspect) {
      this.camera.aspect = eyeAspect;
      this.camera.updateProjectionMatrix();
    }

    // BŁĄD 2: wymuszamy odświeżenie macierzy świata CAŁEJ sceny (w tym rig,
    // rodzica kamery) PRZED policzeniem kamer stereo — bez tego stereo.update()
    // czytało pozycję rig sprzed jednej klatki (widoczne zwłaszcza na starcie VR).
    scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.stereo.update(this.camera);

    this.renderer.setScissorTest(true);

    this.renderer.setViewport(0, 0, halfW, size.y);
    this.renderer.setScissor(0, 0, halfW, size.y);
    this.renderer.render(scene, this.stereo.cameraL);

    this.renderer.setViewport(halfW, 0, halfW, size.y);
    this.renderer.setScissor(halfW, 0, halfW, size.y);
    this.renderer.render(scene, this.stereo.cameraR);

    this.renderer.setScissorTest(false);
  }

  // Wywołaj przy wejściu do VR i przy każdej zmianie rozmiaru okna w trakcie
  // sesji VR — bez tego pierwsza klatka może użyć jeszcze nieprawidłowych proporcji.
  updateAspect() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.camera.aspect = (size.x / 2) / size.y;
    this.camera.updateProjectionMatrix();
  }
}
