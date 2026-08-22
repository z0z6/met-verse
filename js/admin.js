import { Config } from './config.js';
import { init, destroy } from './particles.js';

const $ = id => document.getElementById(id);

function updateUIFromConfig() {
    $('bgColor').value = Config.get('bgColor');
    $('bgColorVal').textContent = Config.get('bgColor');
    $('multiColorToggle').checked = Config.get('multiColor');
    $('monoColorRow').style.opacity = Config.get('multiColor') ? '0.4' : '1';
    $('particleColor').value = Config.get('particleColor');
    $('particleColorVal').textContent = Config.get('particleColor');
    $('shapeSelect').value = Config.get('shape');
    $('tiltSelect').value = Config.get('tiltDirection');
    $('tiltAngleRange').value = Config.get('tiltAngle');
    $('tiltAngleVal').textContent = Config.get('tiltAngle') + '°';
    $('scaleRange').value = Math.round(Config.get('scale') * 100);
    $('scaleVal').textContent = Config.get('scale').toFixed(2) + 'x';
    $('directionToggle').checked = Config.get('rotationDirection') > 0;
    $('dirLabel').textContent = Config.get('rotationDirection') > 0 ? 'Prawo' : 'Lewo';
    $('speedRange').value = Math.round(Config.get('rotationSpeed') * 100);
    $('speedVal').textContent = Config.get('rotationSpeed').toFixed(2);
    $('countRange').value = Config.get('particleCount');
    $('countVal').textContent = Config.get('particleCount');
    $('sizeRange').value = Math.round(Config.get('particleSize') * 100);
    $('sizeVal').textContent = Config.get('particleSize').toFixed(2);
    $('glassOpacity').value = Math.round(Config.get('glassOpacity') * 100);
    $('glassOpVal').textContent = Config.get('glassOpacity').toFixed(2);
    $('glassBlur').value = Config.get('glassBlur');
    $('glassBlurVal').textContent = Config.get('glassBlur') + 'px';

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

    updateGlassStyle();
}

function updateGlassStyle() {
    const panel = $('glassPanel');
    if (!panel) return;
    const op = Config.get('glassOpacity');
    const blur = Config.get('glassBlur');
    panel.style.background = `rgba(255,255,255,${op})`;
    panel.style.backdropFilter = `blur(${blur}px) saturate(180%)`;
    panel.style.webkitBackdropFilter = `blur(${blur}px) saturate(180%)`;
}

function bindEvents() {
    $('bgColor').addEventListener('input', e => {
        Config.set('bgColor', e.target.value);
        $('bgColorVal').textContent = e.target.value;
    });

    $('multiColorToggle').addEventListener('change', e => {
        Config.set('multiColor', e.target.checked);
        $('monoColorRow').style.opacity = e.target.checked ? '0.4' : '1';
    });

    $('particleColor').addEventListener('input', e => {
        Config.set('particleColor', e.target.value);
        $('particleColorVal').textContent = e.target.value;
    });

    $('shapeSelect').addEventListener('change', e => {
        Config.set('shape', e.target.value);
    });

    $('tiltSelect').addEventListener('change', e => {
        Config.set('tiltDirection', e.target.value);
    });

    $('tiltAngleRange').addEventListener('input', e => {
        const val = parseInt(e.target.value);
        Config.set('tiltAngle', val);
        $('tiltAngleVal').textContent = val + '°';
    });

    $('scaleRange').addEventListener('input', e => {
        const val = parseInt(e.target.value) / 100;
        Config.set('scale', val);
        $('scaleVal').textContent = val.toFixed(2) + 'x';
    });

    $('directionToggle').addEventListener('change', e => {
        Config.set('rotationDirection', e.target.checked ? 1 : -1);
        $('dirLabel').textContent = e.target.checked ? 'Prawo' : 'Lewo';
    });

    $('speedRange').addEventListener('input', e => {
        const val = parseInt(e.target.value) / 100;
        Config.set('rotationSpeed', val);
        $('speedVal').textContent = val.toFixed(2);
    });

    $('countRange').addEventListener('change', e => {
        Config.set('particleCount', parseInt(e.target.value));
        $('countVal').textContent = e.target.value;
    });

    $('sizeRange').addEventListener('input', e => {
        const val = parseInt(e.target.value) / 100;
        Config.set('particleSize', val);
        $('sizeVal').textContent = val.toFixed(2);
    });

    $('glassOpacity').addEventListener('input', e => {
        const val = parseInt(e.target.value) / 100;
        Config.set('glassOpacity', val);
        $('glassOpVal').textContent = val.toFixed(2);
        updateGlassStyle();
    });

    $('glassBlur').addEventListener('input', e => {
        const val = parseInt(e.target.value);
        Config.set('glassBlur', val);
        $('glassBlurVal').textContent = val + 'px';
        updateGlassStyle();
    });

    $('gridEnabledToggle').addEventListener('change', e => {
        Config.set('gridEnabled', e.target.checked);
    });

    $('gridColor').addEventListener('input', e => {
        Config.set('gridColor', e.target.value);
        $('gridColorVal').textContent = e.target.value;
    });

    $('gridDensity').addEventListener('input', e => {
        Config.set('gridDensity', parseInt(e.target.value));
        $('gridDensityVal').textContent = e.target.value;
    });

    $('gridThickness').addEventListener('input', e => {
        const val = parseInt(e.target.value) / 100;
        Config.set('gridThickness', val);
        $('gridThicknessVal').textContent = val.toFixed(2);
    });

    $('gridSpeedX').addEventListener('input', e => {
        Config.set('gridSpeedX', parseInt(e.target.value));
        $('gridSpeedXVal').textContent = (parseInt(e.target.value) / 100).toFixed(2);
    });

    $('gridSpeedY').addEventListener('input', e => {
        Config.set('gridSpeedY', parseInt(e.target.value));
        $('gridSpeedYVal').textContent = (parseInt(e.target.value) / 100).toFixed(2);
    });

    $('exportBtn').addEventListener('click', () => {
        const blob = new Blob([Config.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'particle-config.json';
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
    init('canvas-container');
    updateUIFromConfig();
    bindEvents();
});
