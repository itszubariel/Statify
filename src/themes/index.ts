import { ThemeDef, ThemeVars } from './types';

// Gruvbox Dark
import gruvboxDarkHard from './gruvbox-dark-hard';
import gruvboxDarkMedium from './gruvbox-dark-medium';
import gruvboxDarkSoft from './gruvbox-dark-soft';

// Gruvbox Light
import gruvboxLightHard from './gruvbox-light-hard';
import gruvboxLightMedium from './gruvbox-light-medium';
import gruvboxLightSoft from './gruvbox-light-soft';

// Popular
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

// Extras
import rosePine from './rose-pine';
import rosePineMoon from './rose-pine-moon';
import everforestDark from './everforest-dark';
import kanagawa from './kanagawa';
import ayuDark from './ayu-dark';
import nightfox from './nightfox';
import oxocarbon from './oxocarbon';

export type { ThemeDef, ThemeVars };

export const THEMES: ThemeDef[] = [
    gruvboxDarkHard, gruvboxDarkMedium, gruvboxDarkSoft,
    gruvboxLightHard, gruvboxLightMedium, gruvboxLightSoft,
    nord, catppuccinMocha, catppuccinLatte, catppuccinMacchiato,
    tokyoNight, tokyoNightStorm, dracula, oneDarkPro,
    solarizedDark, solarizedLight, monokaiPro, materialOcean,
    rosePine, rosePineMoon, everforestDark, kanagawa,
    ayuDark, nightfox, oxocarbon,
];

export function getTheme(id: string): ThemeDef {
    return THEMES.find(t => t.id === id) || THEMES[0];
}

export function themeToCss(v: ThemeVars): string {
    return `:root{--bg0-hard:${v.bg0Hard};--bg0:${v.bg0};--bg1:${v.bg1};--bg2:${v.bg2};--bg3:${v.bg3};--bg4:${v.bg4};--fg0:${v.fg0};--fg1:${v.fg1};--fg2:${v.fg2};--fg3:${v.fg3};--fg4:${v.fg4};--red:${v.red};--green:${v.green};--yellow:${v.yellow};--blue:${v.blue};--purple:${v.purple};--aqua:${v.aqua};--orange:${v.orange}}`;
}
