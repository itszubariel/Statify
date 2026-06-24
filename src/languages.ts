export const LANG_COLORS: Record<string, string> = {
    'ts': '#83a598', 'tsx': '#83a598', 'js': '#fabd2f', 'jsx': '#fabd2f',
    'py': '#b8bb26', 'java': '#d79921', 'c': '#a89984', 'cpp': '#fb4934',
    'cs': '#8ec07c', 'html': '#fe8019', 'css': '#d3869b', 'scss': '#d3869b',
    'json': '#bdae93', 'md': '#83a598', 'go': '#8ec07c', 'rs': '#fe8019',
    'rb': '#fb4934', 'php': '#d3869b', 'swift': '#fabd2f', 'kt': '#fe8019',
    'other': '#928374',
};

export const LANG_BADGES: Record<string, string> = {
    'ts': 'TS', 'tsx': 'TS', 'js': 'JS', 'jsx': 'JS', 'mjs': 'JS', 'cjs': 'JS',
    'py': 'Py', 'pyw': 'Py', 'pyx': 'Py', 'ipynb': 'NB',
    'java': 'Jv', 'class': 'Jv', 'jar': 'Jv',
    'c': 'C', 'h': 'C', 'cpp': 'C++', 'cxx': 'C++', 'cc': 'C++', 'c++': 'C++',
    'hpp': 'C++', 'hxx': 'C++', 'hh': 'C++',
    'cs': 'C#', 'm': 'ObC', 'mm': 'ObC',
    'html': 'HT', 'htm': 'HT',
    'css': 'CS', 'scss': 'SC', 'sass': 'SA', 'less': 'Le', 'styl': 'St',
    'json': '{}', 'jsonc': '{}', 'json5': '{}',
    'yaml': 'YM', 'yml': 'YM',
    'toml': 'TM', 'xml': 'XM', 'svg': 'SV',
    'md': 'MD', 'mdx': 'MD', 'markdown': 'MD',
    'sql': 'SQ',
    'go': 'Go', 'rs': 'Rs', 'rb': 'Rb',
    'php': 'PH', 'swift': 'Sw', 'kt': 'Kt', 'kts': 'Kt',
    'vue': 'Vu', 'svelte': 'Sv', 'astro': 'As',
    'lua': 'Lu', 'zig': 'Zg', 'nix': 'Nx', 'dart': 'Da',
    'sh': 'sh', 'bash': 'sh', 'zsh': 'zh', 'fish': 'Fi',
    'ps1': 'PS', 'bat': 'BT', 'cmd': 'BT',
    'r': 'R', 'rmd': 'RM', 'jl': 'Jl',
    'ex': 'Ex', 'exs': 'Ex', 'gleam': 'Gl',
    'wgsl': 'WG', 'prisma': 'Pr',
    'tf': 'TF', 'tfvars': 'TF', 'hcl': 'HC',
    'proto': 'PB', 'graphql': 'GQ', 'gql': 'GQ',
    'pl': 'Pl', 'pm': 'Pl', 't': 'T',
    'scala': 'Sc', 'sc': 'Sc', 'clj': 'Cj',
    'hs': 'Hs', 'lhs': 'Hs', 'erl': 'Er', 'hrl': 'Er',
    'ml': 'ML', 'mli': 'ML', 'fs': 'FS', 'fsx': 'FS',
    'nim': 'Ni', 'cr': 'Cr', 'v': 'V',
    'hx': 'Hx', 'd': 'D',
    'f': 'F90', 'f90': 'F90', 'f95': 'F95', 'f03': 'F03', 'f08': 'F08',
    'asm': 'As', 's': 'As', 'S': 'As',
    'dockerfile': 'DK', 'docker': 'DK',
    'makefile': 'Mk', 'mk': 'Mk', 'cmake': 'CM',
    'tex': 'TeX', 'sty': 'TeX', 'cls': 'TeX', 'bib': 'TeX',
    'rst': 'RST', 'adoc': 'AD', 'org': 'Org',
    'csv': 'CS', 'tsv': 'TS',
    'diff': 'DF', 'patch': 'DF',
    'vim': 'Vi', 'vimrc': 'Vi', 'el': 'El',
    'sol': 'Sol', 'vy': 'Vy',
    'wasm': 'Wm', 'wat': 'Wt',
    'nu': 'Nu', 'typ': 'Typ',
    'yara': 'YR', 'yar': 'YR',
    'dhall': 'Dh', 'purs': 'Pu',
};

const ACCENTS = ['#fabd2f', '#b8bb26', '#83a598', '#fe8019', '#d3869b', '#8ec07c', '#fb4934'];

export function getLangColor(lang: string): string {
    const color = LANG_COLORS[lang];
    if (color) { return color; }
    let hash = 0;
    for (let i = 0; i < lang.length; i++) {
        hash = lang.charCodeAt(i) + ((hash << 5) - hash);
    }
    return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export function getLangBadge(lang: string): string {
    return LANG_BADGES[lang] || lang.slice(0, 2).toUpperCase();
}

export function getLangIcon(lang: string): string {
    const label = getLangBadge(lang);
    const color = getLangColor(lang);
    return `<span class="lang-badge" style="background:${color}">${label}</span>`;
}
