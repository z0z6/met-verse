import { Config } from './config.js';

const IS_ANDROID = /Android/i.test(navigator.userAgent);
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

export function getPlatform() {
    return IS_ANDROID ? 'android' : 'desktop';
}

export function getConfig(prefix) {
    return {
        vr_v: Config.get(prefix + 'vr_v'),
        vr_h: Config.get(prefix + 'vr_h'),
        panel_v: Config.get(prefix + 'panel_v'),
        panel_h: Config.get(prefix + 'panel_h'),
        panel_opacity: Config.get(prefix + 'panel_opacity'),
        panel_size: Config.get(prefix + 'panel_size'),
        panel_title: Config.get(prefix + 'panel_title'),
        panel_content_desc: Config.get(prefix + 'panel_content_desc'),
        panel_btn_desc: Config.get(prefix + 'panel_btn_desc'),
        vr_blocked_label: Config.get(prefix + 'vr_blocked_label')
    };
}

export function getActiveConfig(forcePlatform = null) {
    const platform = forcePlatform || getPlatform();
    const prefix = platform === 'android' ? 'android_' : 'desktop_';
    return { platform, ...getConfig(prefix) };
}
