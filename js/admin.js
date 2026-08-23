import { Config } from './config.js';
import { init } from './vr-headset-bg.js';

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
}

function bindEvents() {
    $('bgColor').addEventListener('input', e => {
        Config.set('bgColor', e.target.value);
        $('bgColorVal').textContent = e.target.value;
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
