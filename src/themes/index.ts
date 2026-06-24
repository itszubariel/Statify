import * as vscode from 'vscode';
import { ThemeDef, ThemeVars } from './types';

import gruvboxDarkHard from './gruvbox-dark-hard';
import gruvboxDarkMedium from './gruvbox-dark-medium';
import gruvboxDarkSoft from './gruvbox-dark-soft';

import gruvboxLightHard from './gruvbox-light-hard';
import gruvboxLightMedium from './gruvbox-light-medium';
import gruvboxLightSoft from './gruvbox-light-soft';

import nord from './nord';
import catppuccinMocha from './catppuccin-mocha';
import catppuccinLatte from './catppuccin-latte';
import catppuccinMacchiato from './catppuccin-macchiato';
import tokyoNight from './tokyo-night';
import tokyoNightStorm from './tokyo-night-storm';
import dracula from './dracula';
import oneDarkPro from './one-dark-pro';
import solarizedDark from './solarized-dark';
import solarizedLight from './solarized-light';
import monokaiPro from './monokai-pro';
import materialOcean from './material-ocean';

import rosePine from './rose-pine';
import rosePineMoon from './rose-pine-moon';
import everforestDark from './everforest-dark';
import kanagawa from './kanagawa';
import ayuDark from './ayu-dark';
import nightfox from './nightfox';
import oxocarbon from './oxocarbon';

export type { ThemeDef, ThemeVars };

const BUILTIN_THEMES: ThemeDef[] = [
    gruvboxDarkHard, gruvboxDarkMedium, gruvboxDarkSoft,
    gruvboxLightHard, gruvboxLightMedium, gruvboxLightSoft,
    nord, catppuccinMocha, catppuccinLatte, catppuccinMacchiato,
    tokyoNight, tokyoNightStorm, dracula, oneDarkPro,
    solarizedDark, solarizedLight, monokaiPro, materialOcean,
    rosePine, rosePineMoon, everforestDark, kanagawa,
    ayuDark, nightfox, oxocarbon,
];

function getCustomThemes(): ThemeDef[] {
    try {
        const cfg = vscode.workspace.getConfiguration('statify');
        const custom = cfg.get<Array<{ id: string; label: string; vars: ThemeVars }>>('customThemes');
        if (custom && Array.isArray(custom)) {
            return custom.map(t => ({
                id: t.id,
                label: t.label || t.id,
                group: 'Custom',
                vars: t.vars,
            }));
        }
    } catch (err) {
        console.warn('[Statify] Failed to load custom themes:', err);
    }
    return [];
}

export function THEMES(): ThemeDef[] {
    return [...BUILTIN_THEMES, ...getCustomThemes()];
}

export function getTheme(id: string): ThemeDef {
    return [...BUILTIN_THEMES, ...getCustomThemes()].find(t => t.id === id) || BUILTIN_THEMES[0];
}

export function themeToCss(v: ThemeVars): string {
    const cssVars = Object.entries(v)
        .map(([key, val]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `--${cssKey}:${val}`;
        })
        .join(';');
    return `:root{${cssVars}}`;
}
