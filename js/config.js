const DEFAULTS = {
    bgColor: '#d6d6d6',
    particleColor: '#000000',
    multiColor: false,
    rotationDirection: 1,
    rotationSpeed: 0.1,
    gridEnabled: false,
    gridColor: '#000000',
    gridDensity: 5,
    gridThickness: 0.5,
    gridSpeedX: -88,
    gridSpeedY: -91,
    tiltDirection: 'front-right',
    tiltAngle: 15,
    scale: 1.1,
    wallpaperEnabled: true,
    wallpaperIndex: 2,
    wallpaperBrightness: 1.05,
    wallpaperBlur: 0,
    // Desktop VR & Panel
    desktop_vr_v: 'bottom',
    desktop_vr_h: 'center',
    desktop_panel_v: 'bottom',
    desktop_panel_h: 'center',
    desktop_panel_opacity: 0.9,
    desktop_panel_size: 1.0,
    desktop_panel_title: 'IMAGINARIUM',
    desktop_panel_content_desc: 'wirtualna przestrzeń wystawowa',
    desktop_panel_btn_desc: 'W A S D — ruch  |  mysz — rozglądanie (kliknij ekran, by zablokować kursor)  |  SHIFT — bieg',
    desktop_vr_blocked_label: 'VR dostępne tylko w urządzeniach mobilnych',
    // Android VR & Panel
    android_vr_v: 'bottom',
    android_vr_h: 'center',
    android_panel_v: 'bottom',
    android_panel_h: 'center',
    android_panel_opacity: 0.9,
    android_panel_size: 1.0,
    android_panel_title: 'IMAGINARIUM',
    android_panel_content_desc: 'wirtualna przestrzeń wystawowa',
    android_panel_btn_desc: 'Dotknij, aby wybrać tryb',
    android_vr_blocked_label: 'VR dostępne tylko w urządzeniach mobilnych'
};

const CONFIG_VERSION = '3';
const VERSION_KEY = 'metaverse_configVersion';

function migrateIfNeeded() {
    try {
        const storedVersion = localStorage.getItem(VERSION_KEY);
        if (storedVersion === CONFIG_VERSION) return;

        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('metaverse_') && k !== VERSION_KEY) {
                toRemove.push(k);
            }
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(VERSION_KEY, CONFIG_VERSION);
    } catch (e) {}
}
migrateIfNeeded();

export const Config = {
    get(key) {
        try {
            const val = localStorage.getItem('metaverse_' + key);
            if (val === null) return DEFAULTS[key];
            if (typeof DEFAULTS[key] === 'boolean') return val === 'true';
            if (typeof DEFAULTS[key] === 'number') return parseFloat(val);
            return val;
        } catch(e) { return DEFAULTS[key]; }
    },
    set(key, value) {
        try { localStorage.setItem('metaverse_' + key, value); } catch(e) {}
        window.dispatchEvent(new CustomEvent('configchange', { detail: { key, value } }));
    },
    getAll() {
        const out = {};
        for (const key in DEFAULTS) out[key] = this.get(key);
        return out;
    },
    exportJSON() {
        return JSON.stringify(this.getAll(), null, 2);
    },
    importJSON(json) {
        try {
            const obj = JSON.parse(json);
            for (const key in DEFAULTS) {
                if (obj[key] !== undefined) this.set(key, obj[key]);
            }
            return true;
        } catch(e) { return false; }
    }
};
