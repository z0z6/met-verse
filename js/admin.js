import { Config } from './config.js';
import { init, setPreviewPlatform, updateGogglePosition } from './vr-headset-bg.js';
import { getPanelStyle, applyPanelToElement } from './panelConfig.js';

const $ = id => document.getElementById(id);

// Lista wszystkich kluczy konfiguracyjnych, które mają suwaki/pola w adminie
const ADMIN_KEYS = [
    'desktop_vr_x', 'desktop_vr_y', 'desktop_panel_x', 'desktop_panel_y',
    'desktop_panel_size', 'desktop_panel_opacity', 'desktop_panel_title',
    'desktop_panel_content_desc', 'desktop_panel_btn_desc', 'desktop_wallpaper_index',
    'desktop_wallpaper_brightness', 'desktop_wallpaper_blur', 'desktop_rotation_direction',
    'desktop_rotation_speed',
    'android_vr_x', 'android_vr_y', 'android_panel_x', 'android_panel_y',
    'android_panel_size', 'android_panel_opacity', 'android_panel_title',
    'android_panel_content_desc', 'android_panel_btn_desc', 'android_wallpaper_index',
    'android_wallpaper_brightness', 'android_wallpaper_blur', 'android_rotation_direction',
    'android_rotation_speed', 'wallpaperEnabled', 'bgColor'
];

function updateUIFromConfig() {
    ADMIN_KEYS.forEach(key => {
        const el = $(key);
        if (!el) return;
        const val = Config.get(key);
        if (el.type === 'checkbox') {
            el.checked = val;
        } else {
            el.value = val;
        }
        updateBadge(key, val);
    });
    updateMockPanel('desktop'); // Domyślny podgląd
}

function updateBadge(key, val) {
    const badge = $(key + '_val');
    if (badge) {
        if (key.includes('opacity') || key.includes('size') || key.includes('brightness') || key.includes('speed')) {
            badge.textContent = parseFloat(val).toFixed(2);
        } else {
            badge.textContent = val;
        }
    }
}

function updateMockPanel(platform) {
    const prefix = platform + '_';
    applyPanelToElement($('mock-panel'), prefix);
    setPreviewPlatform(platform);
    updateGogglePosition();
}

function bindEvents() {
    ADMIN_KEYS.forEach(key => {
        const el = $(key);
        if (!el) return;
        
        const handler = (e) => {
            let val = el.type === 'checkbox' ? el.checked : el.value;
            if (el.type !== 'checkbox') {
                val = el.type === 'range' ? parseFloat(val) : val;
            }
            Config.set(key, val);
            updateBadge(key, val);
            
            // Natychmiastowa aktualizacja podglądu
            if (key.startsWith('desktop_')) {
                updateMockPanel('desktop');
            } else if (key.startsWith('android_')) {
                updateMockPanel('android');
            } else if (key === 'bgColor') {
                document.body.style.background = val;
            }
        };

        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    });

    $('exportBtn').addEventListener('click', () => {
        const blob = new Blob([Config.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'config.json';
        a.click();
    });

    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            if (Config.importJSON(ev.target.result)) {
                updateUIFromConfig();
                alert('Konfiguracja zaimportowana pomyślnie!');
            } else {
                alert('Błąd: Nieprawidłowy format pliku JSON');
            }
        };
        reader.readAsText(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.style.background = Config.get('bgColor');
    // Inicjalizacja podglądu 3D w trybie desktop
    init('canvas-container', { forcePlatform: 'desktop' });
    updateUIFromConfig();
    bindEvents();
});
