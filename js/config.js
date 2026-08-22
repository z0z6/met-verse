const DEFAULTS = {
    bgColor: '#050510',
    particleColor: '#00ffff',
    multiColor: true,
    shape: 'wave4',
    rotationDirection: 1,
    rotationSpeed: 0.3,
    particleCount: 60000,
    particleSize: 0.15,
    glassOpacity: 0.08,
    glassBlur: 20,
    gridEnabled: true,
    gridColor: '#1a4d6e',
    gridDensity: 15,
    gridThickness: 0.1,
    gridSpeedX: 5,
    gridSpeedY: 0,
    tiltDirection: 'front-right',
    tiltAngle: 30,
    scale: 1.5
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
