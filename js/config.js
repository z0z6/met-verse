// UWAGA: te wartości to jednocześnie "domyślny wygląd" strony, gdy z jakiegoś
// powodu config.json nie uda się wczytać (offline, błąd sieci, mobile itd.).
// Muszą więc być identyczne z tym, co jest w config.json — inaczej wracamy
// do starego problemu "dwóch różnych stron startowych".
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
    wallpaperBlur: 0
};

// Wersja "schematu" configu. Podbij ten numer za każdym razem, gdy zmieniasz
// wartości domyślne powyżej (np. w Panelu Admina ustawiasz nową tapetę jako
// domyślną). Dzięki temu urządzenia, które mają w localStorage zapisane
// STARE wartości (np. telefon, na którym strona była otwarta zanim dodano
// tapetę), same się "odświeżą" przy najbliższej wizycie zamiast trzymać
// stary wygląd w nieskończoność.
const CONFIG_VERSION = '2';
const VERSION_KEY = 'metaverse_configVersion';

function migrateIfNeeded() {
    try {
        const storedVersion = localStorage.getItem(VERSION_KEY);
        if (storedVersion === CONFIG_VERSION) return;

        // Czyścimy tylko klucze naszej apki, nic więcej w localStorage.
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('metaverse_') && k !== VERSION_KEY) {
                toRemove.push(k);
            }
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(VERSION_KEY, CONFIG_VERSION);
    } catch (e) {
        // localStorage niedostępny (np. tryb prywatny) — nic się nie stanie,
        // po prostu zawsze będą używane DEFAULTS / config.json.
    }
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
