import { Config } from './config.js';

const IS_ANDROID = /Android/i.test(navigator.userAgent);
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

export function getPlatform() {
    return IS_ANDROID ? 'android' : 'desktop';
}

export function applyPanelToElement(element, prefix, containerEl = null) {
    if (!element) return;
    
    const x = Config.get(prefix + 'panel_x');
    const y = Config.get(prefix + 'panel_y');
    const size = Config.get(prefix + 'panel_size');
    const opacity = Config.get(prefix + 'panel_opacity');
    const brightness = Config.get(prefix + 'panel_brightness');
    
    // Kontener odniesienia
    const refW = containerEl ? containerEl.clientWidth : window.innerWidth;
    const refH = containerEl ? containerEl.clientHeight : window.innerHeight;
    
    // Ustawiamy position
    if (containerEl) {
        element.style.position = 'absolute';
    } else {
        element.style.position = 'fixed';
    }
    
    // Pobierz bazowy rozmiar elementu (BEZ transformacji scale)
    // getBoundingClientRect zwraca rozmiar po scale, więc używamy offsetWidth/Height
    const baseW = element.offsetWidth;
    const baseH = element.offsetHeight;
    
    // Rozmiar po skalowaniu
    const scaledW = baseW * size;
    const scaledH = baseH * size;
    
    // Maksymalne przesunięcie (żeby element nie wyszedł poza kontener)
    const maxOffsetX = Math.max(0, refW - scaledW);
    const maxOffsetY = Math.max(0, refH - scaledH);
    
    // Oblicz pozycję lewej krawędzi
    // X=0 → left=0 (lewa krawędź przy lewej krawędzi kontenera)
    // X=50 → left=maxOffsetX/2 (idealne wycentrowanie)
    // X=100 → left=maxOffsetX (prawa krawędź przy prawej krawędzi kontenera)
    const leftPx = (x / 100) * maxOffsetX;
    const topPx = (y / 100) * maxOffsetY;
    
    element.style.left = leftPx + 'px';
    element.style.top = topPx + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.transform = `scale(${size})`;
    element.style.transformOrigin = 'top left';
    element.style.opacity = opacity;
    
    // Jasność panelu (efekt glass)
    // brightness=1.0 to normalna jasność, >1.0 rozjaśnia
    element.style.filter = `brightness(${brightness})`;
    element.style.webkitFilter = `brightness(${brightness})`;
    
    // Aktualizacja treści
    const titleEl = element.querySelector('h1');
    const descEl = element.querySelector('p:not(.hint):not(.preview-desc)');
    const hintEl = element.querySelector('.hint');
    if (titleEl) titleEl.textContent = Config.get(prefix + 'panel_title');
    if (descEl) descEl.textContent = Config.get(prefix + 'panel_content_desc');
    if (hintEl) hintEl.textContent = Config.get(prefix + 'panel_btn_desc');
}

export function getGogglePosition(prefix) {
    const x = Config.get(prefix + 'vr_x');
    const y = Config.get(prefix + 'vr_y');
    return {
        x: ((x / 50) - 1) * 4.5,
        y: (1 - (y / 50)) * 3.0
    };
}
