import { Config } from './config.js';
import { init, updatePlatformPreview } from './vr-headset-bg.js';

const $ = id => document.getElementById(id);

function updateUIFromConfig() {
    $('bgColor').value = Config.get('bgColor');
    $('bgColorVal').textContent = Config.get('bgColor');
    $('tiltSelect').value = Config.get('tiltDirection');
    $('tiltAngleRange').value = Config.get('tiltAngle');
    $('tiltAngleVal').textContent = Config.get('tiltAngle') + '°';
    $('scaleRange').value = Math.round(Config.get('scale') * 100);
    $('scaleVal').textContent = Config.get('scale').toFixed(2) + 'x';
    $('directionToggle').checked = Config.get('rotationDirection') > 0;
    $('dirLabel').textContent = Config.get('rotationDirection') > 0 ? 'Prawo' : 'Lewo';
    $('speedRange').value = Math.round(Config.get('rotationSpeed') * 100);
    $('speedVal').textContent = Config.get('rotationSpeed').toFixed(2);

    $('gridEnabledToggle').checked = Config.get('gridEnabled');
    $('gridColor').value = Config.get('gridColor');
    $('gridColorVal').textContent = Config.get('gridColor');
    $('gridDensity').value = Config.get('gridDensity');
    $('gridDensityVal').textContent = Config.get('gridDensity');
    $('gridThickness').value = Math.round(Config.get('gridThickness') * 100);
    $('gridThicknessVal').textContent = Config.get('gridThickness').toFixed(2);
    $('gridSpeedX').value = Config.get('gridSpeedX');
    $('gridSpeedXVal').textContent = (Config.get('gridSpeedX') / 100).toFixed(2);
    $('gridSpeedY').value = Config.get('gridSpeedY');
    $('gridSpeedYVal').textContent = (Config.get('gridSpeedY') / 100).toFixed(2);

    $('wallpaperEnabledToggle').checked = Config.get('wallpaperEnabled');
    $('wallpaperSelect').value = Config.get('wallpaperIndex');
    $('wallpaperBrightnessRange').value = Config.get('wallpaperBrightness');
    $('wallpaperBrightnessVal').textContent = Config.get('wallpaperBrightness').toFixed(2);
    $('wallpaperBlurRange').value = Config.get('wallpaperBlur');
    $('wallpaperBlurVal').textContent = Config.get('wallpaperBlur');
    toggleWallpaperOptions(Config.get('wallpaperEnabled'));

    // Desktop Panel
    $('desktop_vr_v').value = Config.get('desktop_vr_v');
    $('desktop_vr_h').value = Config.get('desktop_vr_h');
    $('desktop_panel_v').value = Config.get('desktop_panel_v');
    $('desktop_panel_h').value = Config.get('desktop_panel_h');
    $('desktop_panel_opacity').value = Config.get('desktop_panel_opacity');
    $('desktop_panel_opacity_val').textContent = parseFloat(Config.get('desktop_panel_opacity')).toFixed(2);
    $('desktop_panel_size').value = Config.get('desktop_panel_size');
    $('desktop_panel_size_val').textContent = parseFloat(Config.get('desktop_panel_size')).toFixed(1);
    $('desktop_panel_title').value = Config.get('desktop_panel_title');
    $('desktop_panel_content_desc').value = Config.get('desktop_panel_content_desc');
    $('desktop_panel_btn_desc').value = Config.get('desktop_panel_btn_desc');

    // Android Panel
    $('android_vr_v').value = Config.get('android_vr_v');
    $('android_vr_h').value = Config.get('android_vr_h');
    $('android_panel_v').value = Config.get('android_panel_v');
    $('android_panel_h').value = Config.get('android_panel_h');
    $('android_panel_opacity').value = Config.get('android_panel_opacity');
    $('android_panel_opacity_val').textContent = parseFloat(Config.get('android_panel_opacity')).toFixed(2);
    $('android_panel_size').value = Config.get('android_panel_size');
    $('android_panel_size_val').textContent = parseFloat(Config.get('android_panel_size')).toFixed(1);
    $('android_panel_title').value = Config.get('android_panel_title');
    $('android_panel_content_desc').value = Config.get('android_panel_content_desc');
    $('android_panel_btn_desc').value = Config.get('android_panel_btn_desc');
}

function toggleWallpaperOptions(enabled) {
    const el = $('wallpaperOptions');
    el.style.opacity = enabled ? '1' : '0.5';
    el.style.pointerEvents = enabled ? 'auto' : 'none';
}

function bindEvents() {
    $('bgColor').addEventListener('input', e => { Config.set('bgColor', e.target.value); $('bgColorVal').textContent = e.target.value; });
    $('tiltSelect').addEventListener('change', e => Config.set('tiltDirection', e.target.value));
    $('tiltAngleRange').addEventListener('input', e => { const val = parseInt(e.target.value); Config.set('tiltAngle', val); $('tiltAngleVal').textContent = val + '°'; });
    $('scaleRange').addEventListener('input', e => { const val = parseInt(e.target.value) / 100; Config.set('scale', val); $('scaleVal').textContent = val.toFixed(2) + 'x'; });
    $('directionToggle').addEventListener('change', e => { Config.set('rotationDirection', e.target.checked ? 1 : -1); $('dirLabel').textContent = e.target.checked ? 'Prawo' : 'Lewo'; });
    $('speedRange').addEventListener('input', e => { const val = parseInt(e.target.value) / 100; Config.set('rotationSpeed', val); $('speedVal').textContent = val.toFixed(2); });
    $('gridEnabledToggle').addEventListener('change', e => Config.set('gridEnabled', e.target.checked));
    $('gridColor').addEventListener('input', e => { Config.set('gridColor', e.target.value); $('gridColorVal').textContent = e.target.value; });
    $('gridDensity').addEventListener('input', e => { Config.set('gridDensity', parseInt(e.target.value)); $('gridDensityVal').textContent = e.target.value; });
    $('gridThickness').addEventListener('input', e => { const val = parseInt(e.target.value) / 100; Config.set('gridThickness', val); $('gridThicknessVal').textContent = val.toFixed(2); });
    $('gridSpeedX').addEventListener('input', e => { Config.set('gridSpeedX', parseInt(e.target.value)); $('gridSpeedXVal').textContent = (parseInt(e.target.value) / 100).toFixed(2); });
    $('gridSpeedY').addEventListener('input', e => { Config.set('gridSpeedY', parseInt(e.target.value)); $('gridSpeedYVal').textContent = (parseInt(e.target.value) / 100).toFixed(2); });

    $('wallpaperEnabledToggle').addEventListener('change', e => { Config.set('wallpaperEnabled', e.target.checked); toggleWallpaperOptions(e.target.checked); });
    $('wallpaperSelect').addEventListener('change', e => Config.set('wallpaperIndex', parseInt(e.target.value)));
    $('wallpaperBrightnessRange').addEventListener('input', e => { const val = parseFloat(e.target.value); $('wallpaperBrightnessVal').textContent = val.toFixed(2); Config.set('wallpaperBrightness', val); });
    $('wallpaperBlurRange').addEventListener('input', e => { const val = parseInt(e.target.value); $('wallpaperBlurVal').textContent = val; Config.set('wallpaperBlur', val); });

    const panelInputs = [
        'desktop_vr_v', 'desktop_vr_h', 'desktop_panel_v', 'desktop_panel_h',
        'desktop_panel_opacity', 'desktop_panel_size', 'desktop_panel_title',
        'desktop_panel_content_desc', 'desktop_panel_btn_desc',
        'android_vr_v', 'android_vr_h', 'android_panel_v', 'android_panel_h',
        'android_panel_opacity', 'android_panel_size', 'android_panel_title',
        'android_panel_content_desc', 'android_panel_btn_desc'
    ];

    panelInputs.forEach(id => {
        const el = $(id);
        if (!el) return;
        const handler = (e) => {
            let val = e.target.value;
            if (id.includes('opacity') || id.includes('size')) {
                val = parseFloat(val);
                const valId = id + '_val';
                if ($(valId)) $(valId).textContent = id.includes('opacity') ? parseFloat(val).toFixed(2) : parseFloat(val).toFixed(1);
            }
            Config.set(id, val);
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    });

    $('previewDesktop').addEventListener('click', () => updatePlatformPreview('desktop'));
    $('previewAndroid').addEventListener('click', () => updatePlatformPreview('android'));

    $('exportBtn').addEventListener('click', () => {
        const blob = new Blob([Config.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'metaverse-config.json';
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
                alert('Konfiguracja zaimportowana!');
            } else {
                alert('Błąd importu JSON');
            }
        };
        reader.readAsText(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.style.background = Config.get('bgColor');
    init('canvas-container', { forcePlatform: 'desktop' });
    updateUIFromConfig();
    bindEvents();
});
