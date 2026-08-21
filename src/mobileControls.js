import { keys } from './controls.js';

const DEADZONE = 0.25;
const MAX_RADIUS = 45;

// Wirtualny joystick (lewy dolny róg) — steruje tymi samymi flagami w/a/s/d,
// których używa zwykłe sterowanie klawiaturą, więc cała reszta logiki ruchu
// w GalleryControls działa bez zmian. Przeciąganie palcem GDZIEKOLWIEK poza
// joystickiem obraca kamerę (odpowiednik rozglądania się myszą).
export function initMobileControls(controls) {
  const stickBase = document.getElementById('joystick-base');
  const stickKnob = document.getElementById('joystick-knob');
  if (!stickBase || !stickKnob) return;

  let stickTouchId = null;
  let stickCenter = { x: 0, y: 0 };
  let lookTouchId = null;
  let lastX = 0, lastY = 0;

  function setKeysFromVector(nx, ny) {
    keys['w'] = ny < -DEADZONE;
    keys['s'] = ny > DEADZONE;
    keys['a'] = nx < -DEADZONE;
    keys['d'] = nx > DEADZONE;
  }
  function resetStickKeys() {
    keys['w'] = keys['s'] = keys['a'] = keys['d'] = false;
  }

  stickBase.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    stickTouchId = t.identifier;
    const rect = stickBase.getBoundingClientRect();
    stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    e.preventDefault();
  }, { passive: false });

  // Rozglądanie się — dowolny dotyk, który NIE zaczął się na joysticku
  document.body.addEventListener('touchstart', (e) => {
    if (e.target.closest('#joystick-base')) return;
    if (e.target.closest('.hud-btn')) return; // nie przechwytuj dotknięć przycisków HUD
    const t = e.changedTouches[0];
    if (lookTouchId !== null) return;
    lookTouchId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        let dx = t.clientX - stickCenter.x;
        let dy = t.clientY - stickCenter.y;
        const dist = Math.min(Math.hypot(dx, dy), MAX_RADIUS);
        const ang = Math.atan2(dy, dx);
        dx = Math.cos(ang) * dist;
        dy = Math.sin(ang) * dist;
        stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        setKeysFromVector(dx / MAX_RADIUS, dy / MAX_RADIUS);
      } else if (t.identifier === lookTouchId) {
        const dx = t.clientX - lastX;
        const dy = t.clientY - lastY;
        lastX = t.clientX;
        lastY = t.clientY;
        controls.applyLookDelta(dx, dy);
      }
    }
  }, { passive: true });

  function endTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        stickTouchId = null;
        stickKnob.style.transform = 'translate(0px, 0px)';
        resetStickKeys();
      }
      if (t.identifier === lookTouchId) {
        lookTouchId = null;
      }
    }
  }
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);
}
