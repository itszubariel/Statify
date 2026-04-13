export interface ThemeVars {
    bg0Hard: string; bg0: string; bg1: string; bg2: string;
    bg3: string; bg4: string; fg0: string; fg1: string;
    fg2: string; fg3: string; fg4: string;
    red: string; green: string; yellow: string;
    blue: string; purple: string; aqua: string; orange: string;
}

export interface ThemeDef { id: string; label: string; group: string; vars: ThemeVars; }
