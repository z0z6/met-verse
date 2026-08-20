import * as THREE from 'three';

const DEADZONE = 0.15;

// Zwraca pierwszy podłączony i aktywny gamepad/pilot (np. sparowany przez
// Bluetooth z telefonem), albo null, jeśli żaden nie jest podłączony.
export function getActiveGamepad() {
  if (!navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const gp of pads) {
    if (gp && gp.connected) return gp;
  }
  return null;
}

// Odczytuje wychylenie lewego drążka (standardowy mapping) z martwą strefą,
// z fallbackiem na D-pad (przyciski 12–15) dla prostszych pilotów bez drążków.
export function readGamepadMove(gp) {
  let x = 0, y = 0;
  if (gp.axes && gp.axes.length >= 2) {
    if (Math.abs(gp.axes[0]) > DEADZONE) x = gp.axes[0];
    if (Math.abs(gp.axes[1]) > DEADZONE) y = gp.axes[1];
  }
  if (x === 0 && y === 0 && gp.buttons && gp.buttons.length >= 16) {
    if (gp.buttons[14] && gp.buttons[14].pressed) x = -1; // lewo
    if (gp.buttons[15] && gp.buttons[15].pressed) x = 1;  // prawo
    if (gp.buttons[12] && gp.buttons[12].pressed) y = -1; // góra (przód)
    if (gp.buttons[13] && gp.buttons[13].pressed) y = 1;  // dół (tył)
  }
  return { x, y };
}

// Przesuwa `rig` w kierunku patrzenia kamery (płasko, w osi XZ) na podstawie
// wychylenia pilota — dokładnie ten sam wzorzec kierunku ruchu, którego
// używamy w zwykłym sterowaniu FPP/TPP.
export function applyGamepadMovement(gp, camera, rig, dt, speed, collisionFn) {
  const { x, y } = readGamepadMove(gp);
  if (x === 0 && y === 0) return false;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

  const move = new THREE.Vector3()
    .addScaledVector(dir, -y)
    .addScaledVector(right, x)
    .multiplyScalar(speed * dt);

  const p = rig.position.clone().add(move);
  collisionFn(p, 0.45);
  rig.position.copy(p);
  return true;
}
