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
    
    // Kontener odniesienia: jeśli podany (np. ramka telefonu), użyj jego wymiarów; inaczej viewport
    const refW = containerEl ? containerEl.clientWidth : window.innerWidth;
    const refH = containerEl ? containerEl.clientHeight : window.innerHeight;
    
    // Ustawiamy position relative do kontenera (lub fixed do viewport)
    if (containerEl) {
        element.style.position = 'absolute';
    } else {
        element.style.position = 'fixed';
    }
    
    // Oblicz pozycję w pikselach:
    // X=0 → lewa krawędź elementu dotyka lewej krawędzi kontenera
    // X=100 → prawa krawędź elementu dotyka prawej krawędzi kontenera
    // Uwzględniamy skalowanie - element jest renderowany w rozmiarze bazowym, potem skalowany
    const baseW = element.offsetWidth / size;
    const baseH = element.offsetHeight / size;
    
    const availableW = refW - baseW * size;
    const availableH = refH - baseH * size;
    
    const leftPx = Math.max(0, (x / 100) * availableW);
    const topPx = Math.max(0, (y / 100) * availableH);
    
    element.style.left = leftPx + 'px';
    element.style.top = topPx + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.transform = `scale(${size})`;
    element.style.transformOrigin = 'top left';
    element.style.opacity = opacity;
    
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
