const DEFAULTS = {
    bgColor: '#050510',
    particleColor: '#ffffff',
    multiColor: false,
    rotationDirection: 1,
    rotationSpeed: 0.3,
    gridEnabled: true,
    gridColor: '#00ffff',
    gridDensity: 8,
    gridThickness: 0.25,
    gridSpeedX: 5,
    gridSpeedY: 0,
    tiltDirection: 'front-right',
    tiltAngle: 15,
    scale: 1.5,
    // Nowe pola dla tapet
    wallpaperEnabled: false,
    wallpaperIndex: 0,
    wallpaperBrightness: 1.0,
    wallpaperBlur: 0
};

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
