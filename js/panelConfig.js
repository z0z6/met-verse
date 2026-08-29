import { Config } from './config.js';

const IS_ANDROID = /Android/i.test(navigator.userAgent);
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

export function getPlatform() {
    return IS_ANDROID ? 'android' : 'desktop';
}

// Przelicza 0-100% na pozycję CSS dla panelu HTML
export function getPanelStyle(prefix) {
    const x = Config.get(prefix + 'panel_x');
    const y = Config.get(prefix + 'panel_y');
    const size = Config.get(prefix + 'panel_size');
    const opacity = Config.get(prefix + 'panel_opacity');
    
    return {
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-${x}%, -${y}%) scale(${size})`,
        opacity: opacity
    };
}

// Przelicza 0-100% na współrzędne świata 3D dla gogli
// X: 0 (lewo) -> -4.5, 50 (środek) -> 0, 100 (prawo) -> 4.5
// Y: 0 (góra) -> 3.0, 50 (środek) -> 0, 100 (dół) -> -3.0
export function getGogglePosition(prefix) {
    const x = Config.get(prefix + 'vr_x');
    const y = Config.get(prefix + 'vr_y');
    return {
        x: ((x / 50) - 1) * 4.5,
        y: (1 - (y / 50)) * 3.0
    };
}

export function applyPanelToElement(element, prefix) {
    if (!element) return;
    const style = getPanelStyle(prefix);
    element.style.left = style.left;
    element.style.top = style.top;
    element.style.transform = style.transform;
    element.style.opacity = style.opacity;
    
    const titleEl = element.querySelector('h1');
    const descEl = element.querySelector('p:not(.hint)');
    const hintEl = element.querySelector('.hint');
    if (titleEl) titleEl.textContent = Config.get(prefix + 'panel_title');
    if (descEl) descEl.textContent = Config.get(prefix + 'panel_content_desc');
    if (hintEl) hintEl.textContent = Config.get(prefix + 'panel_btn_desc');
}
