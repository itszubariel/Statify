import * as path from 'path';
import type { DashboardConfig, ProjectStats, Growth } from './types';
import { ThemeDef, THEMES, themeToCss } from './themes/index';
import { calcStreaks, generateHeatmap } from './state';
import { getLangColor, getLangIcon } from './languages';

function escapeJson(data: unknown): string {
    return JSON.stringify(data)
        .replace(/\\/g, '\\\\')
        .replace(/<\//g, '<\\/')
        .replace(/'/g, '\\u0027');
}

export function getWebviewContent(stats: ProjectStats, root: string, growth: Growth, theme: ThemeDef, config: DashboardConfig, staleDays?: number): string {
    const { codeStats, mediaStats, complexity, codeTopFiles, totalEdits, lastModified, dailySaves, mostEditedFiles, staleFiles, gitInfo, commitActivityData, dependencies, health, performance } = stats;

    const langTotal = codeStats.totalLines || 1;
    const langStats = Object.keys(codeStats.languages).map(l => ({
        lang: l, lines: codeStats.langLines[l] || 0,
        percent: ((codeStats.langLines[l] || 0) / langTotal) * 100
    })).sort((a, b) => b.lines - a.lines);

    const langColors: Record<string, string> = { 'ts': '#83a598', 'tsx': '#83a598', 'js': '#fabd2f', 'jsx': '#fabd2f', 'py': '#b8bb26', 'java': '#d79921', 'c': '#a89984', 'cpp': '#fb4934', 'cs': '#8ec07c', 'html': '#fe8019', 'css': '#d3869b', 'scss': '#d3869b', 'json': '#bdae93', 'md': '#83a598', 'go': '#8ec07c', 'rs': '#fe8019', 'rb': '#fb4934', 'php': '#d3869b', 'swift': '#fabd2f', 'kt': '#fe8019', 'other': '#928374' };

    const langIcons: Record<string, string> = {
        'ts': `<svg viewBox="0 0 24 24" fill="#3178c6"><rect width="24" height="24" rx="3" fill="#3178c6"/><path d="M3 3h18v18H3z" fill="none"/><path d="M13.5 13.5v1.25c0 .69.56 1.25 1.25 1.25s1.25-.56 1.25-1.25V13.5M10 10h4M12 10v6" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`,
        'tsx': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#3178c6"/><path d="M13.5 13.5v1.25c0 .69.56 1.25 1.25 1.25s1.25-.56 1.25-1.25V13.5M10 10h4M12 10v6" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`,
        'js': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#f7df1e"/><path d="M14 16.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V11M9 11v3.5c0 1.38-1 2.5-2.5 2.5" stroke="#000" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`,
        'jsx': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#f7df1e"/><path d="M14 16.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V11M9 11v3.5c0 1.38-1 2.5-2.5 2.5" stroke="#000" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`,
        'py': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#3572A5"/><path d="M8 8h4a2 2 0 0 1 2 2v1H8a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2zm0 0V6m8 10H12a2 2 0 0 1-2-2v-1h4a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2zm0 0v2" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
        'rs': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#ce422b"/><text x="5" y="17" font-size="13" font-weight="bold" fill="#fff" font-family="monospace">Rs</text></svg>`,
        'go': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#00add8"/><text x="5" y="17" font-size="13" font-weight="bold" fill="#fff" font-family="monospace">Go</text></svg>`,
        'java': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#b07219"/><text x="4" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">Jv</text></svg>`,
        'kt': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#7F52FF"/><text x="5" y="17" font-size="13" font-weight="bold" fill="#fff" font-family="monospace">Kt</text></svg>`,
        'cs': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#178600"/><text x="4" y="17" font-size="12" font-weight="bold" fill="#fff" font-family="monospace">C#</text></svg>`,
        'cpp': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#f34b7d"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">C++</text></svg>`,
        'c': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#555555"/><text x="7" y="17" font-size="13" font-weight="bold" fill="#fff" font-family="monospace">C</text></svg>`,
        'html': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#e34c26"/><text x="3" y="17" font-size="10" font-weight="bold" fill="#fff" font-family="monospace">HTML</text></svg>`,
        'css': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#563d7c"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">CSS</text></svg>`,
        'scss': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#c6538c"/><text x="2" y="17" font-size="10" font-weight="bold" fill="#fff" font-family="monospace">SCSS</text></svg>`,
        'json': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#292929"/><text x="2" y="17" font-size="10" font-weight="bold" fill="#cbcb41" font-family="monospace">JSON</text></svg>`,
        'md': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#083fa1"/><text x="4" y="17" font-size="12" font-weight="bold" fill="#fff" font-family="monospace">MD</text></svg>`,
        'php': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#4F5D95"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">PHP</text></svg>`,
        'rb': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#701516"/><text x="5" y="17" font-size="13" font-weight="bold" fill="#fff" font-family="monospace">Rb</text></svg>`,
        'swift': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#F05138"/><text x="3" y="17" font-size="10" font-weight="bold" fill="#fff" font-family="monospace">Swift</text></svg>`,
        'vue': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#41b883"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">Vue</text></svg>`,
        'svelte': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#ff3e00"/><text x="2" y="17" font-size="9" font-weight="bold" fill="#fff" font-family="monospace">Svlt</text></svg>`,
        'lua': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#000080"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">Lua</text></svg>`,
        'zig': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#ec915c"/><text x="4" y="17" font-size="12" font-weight="bold" fill="#fff" font-family="monospace">Zig</text></svg>`,
        'nix': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#5277c3"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">Nix</text></svg>`,
        'sh': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#89e051"/><text x="5" y="17" font-size="12" font-weight="bold" fill="#000" font-family="monospace">sh</text></svg>`,
        'yaml': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#cb171e"/><text x="2" y="17" font-size="10" font-weight="bold" fill="#fff" font-family="monospace">YAML</text></svg>`,
        'toml': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#9c4221"/><text x="2" y="17" font-size="10" font-weight="bold" fill="#fff" font-family="monospace">TOML</text></svg>`,
        'xml': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#0060ac"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">XML</text></svg>`,
        'sql': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#e38c00"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">SQL</text></svg>`,
        'dart': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#00b4ab"/><text x="3" y="17" font-size="10" font-weight="bold" fill="#fff" font-family="monospace">Dart</text></svg>`,
        'r': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#198ce7"/><text x="7" y="17" font-size="13" font-weight="bold" fill="#fff" font-family="monospace">R</text></svg>`,
        'ex': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#6e4a7e"/><text x="5" y="17" font-size="12" font-weight="bold" fill="#fff" font-family="monospace">Ex</text></svg>`,
        'exs': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#6e4a7e"/><text x="3" y="17" font-size="11" font-weight="bold" fill="#fff" font-family="monospace">Exs</text></svg>`,
        'gleam': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#ffaff3"/><text x="2" y="17" font-size="9" font-weight="bold" fill="#1a1a2e" font-family="monospace">Glm</text></svg>`,
        'wgsl': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#005a9c"/><text x="2" y="17" font-size="9" font-weight="bold" fill="#fff" font-family="monospace">WGSL</text></svg>`,
        'prisma': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#0c344b"/><text x="2" y="17" font-size="9" font-weight="bold" fill="#fff" font-family="monospace">Prm</text></svg>`,
        'tf': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#5c4ee5"/><text x="5" y="17" font-size="12" font-weight="bold" fill="#fff" font-family="monospace">TF</text></svg>`,
        'proto': `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#4285f4"/><text x="2" y="17" font-size="9" font-weight="bold" fill="#fff" font-family="monospace">PB</text></svg>`,
    };

    function getLangIcon(lang: string): string {
        if (langIcons[lang]) { return langIcons[lang]; }
        const label = lang.slice(0, 2).toUpperCase();
        const color = getLangColor(lang);
        return `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="${color}"/><text x="${label.length === 1 ? 8 : 4}" y="17" font-size="12" font-weight="bold" fill="#fff" font-family="monospace">${label}</text></svg>`;
    }
    function getLangColor(lang: string): string {
        const accents = ['#fabd2f', '#b8bb26', '#83a598', '#fe8019', '#d3869b', '#8ec07c', '#fb4934'];
        let hash = 0; for (let i = 0; i < lang.length; i++) { hash = lang.charCodeAt(i) + ((hash << 5) - hash); }
        return accents[Math.abs(hash) % accents.length];
    }

    const topLangs = langStats.slice(0, 5);
    const otherLangs = langStats.slice(5);
    function langBarHTML(l: { lang: string; lines: number; percent: number }): string {
        const color = langColors[l.lang] || getLangColor(l.lang);
        const icon = getLangIcon(l.lang);
        return `<div class="lang-item"><div class="lang-info"><span class="lang-icon">${icon}</span><span class="lang-name">${l.lang.toUpperCase()}</span><span class="lang-lines">${l.lines.toLocaleString()} lines</span><span class="lang-percent">${l.percent.toFixed(1)}%</span></div><div class="lang-bar-track"><div class="lang-bar" style="width:${l.percent}%;background:${color}"></div></div></div>`;
    }
    const langBarsHTML = topLangs.map(langBarHTML).join('') + (otherLangs.length ? `<div id="more-langs" style="display:none;">${otherLangs.map(langBarHTML).join('')}</div><button onclick="toggleLanguages()" id="lang-toggle" class="toggle-btn">＋ Show ${otherLangs.length} more languages</button>` : '');

    const folderEntries = Object.entries(codeStats.folders)
        .map(([folder, files]) => ({ folder, files: files as number, lines: codeStats.folderLines[folder] || 0 }))
        .filter(f => f.files > 0)
        .sort((a, b) => b.files - a.files).slice(0, 8);
    const maxFolderFiles = folderEntries[0]?.files || 1;
    const folderBarsHTML = folderEntries.length ? folderEntries.map((f, i) => {
        const colors = ['var(--blue)', 'var(--green)', 'var(--yellow)', 'var(--purple)', 'var(--aqua)', 'var(--orange)', 'var(--red)', 'var(--fg4)'];
        const pct = (f.files / maxFolderFiles) * 100;
        const name = f.folder === '.' ? '(root)' : f.folder;
        return `<div class="folder-item"><div class="folder-info"><span class="folder-name">${name}</span><span class="folder-meta">${f.lines.toLocaleString()} lines · ${f.files} files</span></div><div class="lang-bar-track"><div class="lang-bar" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div></div>`;
    }).join('') : '<div class="empty-state">No folder data</div>';

    const saveStreaks = calcStreaks(dailySaves);
    const commitStreaks = calcStreaks(commitActivityData);

    const recentActivityHTML = mostEditedFiles.map(f => {
        const fp = path.join(root, f.path).replace(/\\/g, '\\\\');
        return `<div class="list-item" onclick="openFile('${fp}',0)"><span class="list-icon">◈</span><span class="file-name">${f.path}</span><span class="file-tag">${f.lastModified}</span></div>`;
    }).join('') || '<div class="empty-state">No recent edits found</div>';

    const topFilesHTML = codeTopFiles.map(f => {
        const fp = path.join(root, f.path).replace(/\\/g, '\\\\');
        return `<div class="list-item" onclick="openFile('${fp}',0)"><span class="list-icon">◉</span><span class="file-name">${f.path}</span><span class="file-tag">${(f.size / 1024).toFixed(1)} KB</span></div>`;
    }).join('');

    const mediaFilesHTML = mediaStats.topFiles.map(f =>
        `<div class="list-item"><span class="list-icon">◐</span><span class="file-name">${f.path}</span><span class="file-tag">${(f.size / 1024).toFixed(1)} KB</span></div>`
    ).join('') || '<div class="empty-state">No media files</div>';

    const staleFilesHTML = staleFiles.map(f => {
        const fp = path.join(root, f.path).replace(/\\/g, '\\\\');
        const years = f.daysSince >= 365 ? `${Math.round(f.daysSince / 365)}y` : `${f.daysSince}d`;
        return `<div class="list-item" onclick="openFile('${fp}',0)"><span class="list-icon" style="color:var(--orange)">⊘</span><span class="file-name">${f.path}</span><span class="file-tag" style="color:var(--orange)">${years} ago</span></div>`;
    }).join('') || '<div class="empty-state">No stale files — nice!</div>';

    const complexityFilesHTML = complexity.topFiles.map(f => {
        const fp = path.join(root, f.path).replace(/\\/g, '\\\\');
        const compScore = f.functions + f.classes;
        return `<div class="list-item" onclick="openFile('${fp}',0)"><span class="list-icon" style="color:var(--orange)">⚙</span><span class="file-name">${f.path}</span><span class="file-tag">${f.functions} fn · ${f.classes} cls</span></div>`;
    }).join('') || '<div class="empty-state">No analyzable files</div>';

    const contributorsHTML = gitInfo.contributors.map((c, i) => {
        const maxCommits = gitInfo.contributors[0]?.commits || 1;
        const pct = (c.commits / maxCommits) * 100;
        const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const colors = ['var(--yellow)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--aqua)', 'var(--orange)', 'var(--red)', 'var(--fg2)'];
        const color = colors[i % colors.length];
        return `<div class="contrib-item"><div class="contrib-avatar" style="background:${color}20;color:${color};border:1px solid ${color}40">${initials}</div><div class="contrib-info"><div class="contrib-name">${c.name}</div><div class="contrib-bar-wrap"><div class="lang-bar-track" style="flex:1"><div class="lang-bar" style="width:${pct}%;background:${color}"></div></div><span class="contrib-count">${c.commits}</span></div></div></div>`;
    }).join('') || '<div class="empty-state">No git history</div>';

    const changedFilesHTML = gitInfo.mostChangedFiles.map(f => {
        const fp = path.join(root, f.path).replace(/\\/g, '\\\\');
        return `<div class="list-item" onclick="openFile('${fp}',0)"><span class="list-icon" style="color:var(--red)">△</span><span class="file-name">${f.path}</span><span class="file-tag">${f.changes}×</span></div>`;
    }).join('') || '<div class="empty-state">No git history</div>';

    const healthColor = health.score >= 85 ? 'var(--green)' : health.score >= 70 ? 'var(--yellow)' : health.score >= 55 ? 'var(--orange)' : 'var(--red)';
    const healthFactorsHTML = health.factors.map(f => {
        const pct = (f.score / f.max) * 100;
        const color = f.color === 'green' ? 'var(--green)' : f.color === 'yellow' ? 'var(--yellow)' : 'var(--red)';
        return `<div class="health-factor"><div class="health-factor-header"><span class="health-factor-label">${f.label}</span><span class="health-factor-score" style="color:${color}">${f.score}/${f.max}</span></div><div class="lang-bar-track"><div class="lang-bar" style="width:${pct}%;background:${color}"></div></div><div class="health-factor-note">${f.note}</div></div>`;
    }).join('');

    const weeksToShow = 14;
    const totalCodeFiles = Object.values(codeStats.languages).reduce((a, b) => a + b, 0);
    const todoTotal = codeStats.todos.reduce((a, b) => a + b.count, 0);
    const deltaClass = growth.linesDelta > 0 ? 'pos' : growth.linesDelta < 0 ? 'neg' : 'neu';

    const groups = [...new Set(THEMES.map(t => t.group))];
    const themePickerHTML = groups.map(group => `
        <div class="theme-group-label">${group}</div>
        <div class="theme-group">${THEMES.filter(t => t.group === group).map(t => `
            <div class="theme-item ${t.id === theme.id ? 'active' : ''}" data-theme-id="${t.id}" onclick="previewTheme('${t.id}')">
                <div class="theme-swatch-row">
                    <span class="swatch" style="background:${t.vars.bg0Hard}"></span>
                    <span class="swatch" style="background:${t.vars.bg1}"></span>
                    <span class="swatch" style="background:${t.vars.yellow}"></span>
                    <span class="swatch" style="background:${t.vars.green}"></span>
                    <span class="swatch" style="background:${t.vars.blue}"></span>
                    <span class="swatch" style="background:${t.vars.purple}"></span>
                </div>
                <div class="theme-name">${t.label}</div>
            </div>`).join('')}
        </div>`).join('');

    const themePreviewMap = Object.fromEntries(THEMES.map(t => [t.id, { bg0Hard: t.vars.bg0Hard, bg0: t.vars.bg0, bg1: t.vars.bg1, bg2: t.vars.bg2, fg1: t.vars.fg1, fg4: t.vars.fg4, yellow: t.vars.yellow, green: t.vars.green, blue: t.vars.blue, purple: t.vars.purple, orange: t.vars.orange }]));

    const exportData = {
        exportedAt: new Date().toISOString(),
        project: root,
        theme: theme.label,
        health: { score: health.score, grade: health.grade },
        overview: { totalLines: codeStats.totalLines, totalCodeFiles, totalEdits, todoCount: todoTotal },
        languages: Object.fromEntries(langStats.map(l => [l.lang, { lines: l.lines, files: codeStats.languages[l.lang], percent: parseFloat(l.percent.toFixed(1)) }])),
        folders: Object.fromEntries(folderEntries.map(f => [f.folder, { lines: f.lines, files: f.files }])),
        staleFiles: staleFiles.map(f => ({ path: f.path, daysSince: f.daysSince })),
        git: gitInfo.isRepo ? { branch: gitInfo.branch, commitsThisWeek: gitInfo.commitsThisWeek, contributors: gitInfo.contributors, mostChangedFiles: gitInfo.mostChangedFiles } : null,
        dependencies,
        complexity: { totalFunctions: complexity.totalFunctions, totalClasses: complexity.totalClasses },
        growth: growth.history,
        performance,
    };

    function showCard(key: keyof DashboardConfig): string {
        return config[key] ? '' : ' style="display:none"';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Statify</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Recursive:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${themeToCss(theme.vars)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Recursive','JetBrains Mono',monospace;background:var(--bg0-hard);color:var(--fg1);min-height:100vh;padding:28px 24px 48px;transition:background 0.3s,color 0.3s}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid var(--bg2)}
.header-left{display:flex;align-items:center;gap:14px}
.logo-mark{width:40px;height:40px;background:var(--yellow);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:1.1rem;color:var(--bg0);flex-shrink:0}
.header-title{font-family:'JetBrains Mono',monospace;font-size:1.4rem;font-weight:700;color:var(--fg0);letter-spacing:-0.5px}
.header-sub{font-size:0.75rem;color:var(--fg4);margin-top:2px;font-family:'JetBrains Mono',monospace}
.header-actions{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.header-btn-row{display:flex;gap:6px;align-items:center}
.icon-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:var(--bg1);border:1px solid var(--bg3);color:var(--fg4);border-radius:6px;cursor:pointer;transition:all 0.2s ease}
.icon-btn:hover{background:var(--bg2);border-color:var(--yellow);color:var(--yellow)}
.refresh-btn{display:flex;align-items:center;gap:6px;background:var(--bg1);border:1px solid var(--bg3);color:var(--fg3);border-radius:6px;padding:8px 14px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:0.8rem;transition:all 0.2s ease}
.refresh-btn:hover{background:var(--bg2);border-color:var(--yellow);color:var(--yellow)}
.export-btn{display:flex;align-items:center;gap:6px;background:var(--bg1);border:1px solid var(--bg3);color:var(--fg3);border-radius:6px;padding:8px 14px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:0.8rem;transition:all 0.2s ease}
.export-btn:hover{background:var(--bg2);border-color:var(--aqua);color:var(--aqua)}
.search-bar{display:flex;align-items:center;gap:8px;background:var(--bg1);border:1px solid var(--bg2);border-radius:6px;padding:7px 12px;margin-bottom:14px;transition:border-color 0.2s}
.search-bar:focus-within{border-color:var(--blue)}
.search-bar svg{color:var(--fg4);flex-shrink:0}
.search-input{background:none;border:none;outline:none;color:var(--fg1);font-family:'JetBrains Mono',monospace;font-size:0.8rem;flex:1;min-width:0}
.search-input::placeholder{color:var(--fg4)}
.search-clear{background:none;border:none;color:var(--fg4);cursor:pointer;padding:0;font-size:0.9rem;display:none}
.search-clear.visible{display:block}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.grid-full{margin-bottom:14px}
.card{background:var(--bg0);border:1px solid var(--bg2);border-radius:8px;padding:18px 20px;transition:border-color 0.2s ease,transform 0.15s ease,background 0.3s;position:relative;overflow:hidden;min-width:0}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:transparent}
.card:hover{border-color:var(--bg3);transform:translateY(-1px)}
.card.accent-yellow::before{background:var(--yellow)}.card.accent-green::before{background:var(--green)}.card.accent-blue::before{background:var(--blue)}.card.accent-purple::before{background:var(--purple)}.card.accent-orange::before{background:var(--orange)}.card.accent-aqua::before{background:var(--aqua)}.card.accent-red::before{background:var(--red)}
.card-title{font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:600;color:var(--fg4);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:16px;display:flex;align-items:center;gap:6px}
.card-title-dot{width:6px;height:6px;border-radius:50%;display:inline-block}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.stat-label{font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:var(--fg4);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px}
.stat-value{font-family:'JetBrains Mono',monospace;font-size:1.75rem;font-weight:700;line-height:1;color:var(--yellow)}
.stat-value.green{color:var(--green)}.stat-value.blue{color:var(--blue)}.stat-value.orange{color:var(--orange)}.stat-value.purple{color:var(--purple)}.stat-value.aqua{color:var(--aqua)}.stat-value.red{color:var(--red)}
.streak-row{display:flex;margin-top:4px}
.streak-cell{flex:1;text-align:center;padding:10px 4px;border-right:1px solid var(--bg2)}
.streak-cell:last-child{border-right:none}
.streak-num{font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:700;color:var(--yellow);display:block}
.streak-label{font-size:0.65rem;color:var(--fg4);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-top:3px}
.lang-item,.folder-item{margin-bottom:12px}
.lang-info,.folder-info{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-family:'JetBrains Mono',monospace;font-size:0.75rem}
.lang-icon{width:18px;height:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.lang-icon svg{width:18px;height:18px;border-radius:3px}
.lang-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.lang-name,.folder-name{flex:1;font-weight:600;color:var(--fg2)}
.folder-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
.folder-meta{font-family:'JetBrains Mono',monospace;font-size:0.63rem;color:var(--fg4)}
.treemap{display:flex;flex-wrap:wrap;gap:6px;width:100%}
.treemap-cell{min-width:60px;min-height:56px;border-radius:6px;padding:8px;cursor:default;transition:filter 0.15s;display:flex;flex-direction:column;justify-content:space-between}
.treemap-cell:hover{filter:brightness(1.2)}
.treemap-label{font-family:'JetBrains Mono',monospace;font-size:0.7rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.treemap-meta{font-family:'JetBrains Mono',monospace;font-size:0.6rem;opacity:0.7;margin-top:4px}
.lang-lines{color:var(--fg4);font-size:0.65rem}
.lang-percent{color:var(--fg3);min-width:38px;text-align:right}
.lang-bar-track{height:5px;background:var(--bg1);border-radius:3px;overflow:hidden}
.lang-bar{height:100%;border-radius:3px;transition:width 0.6s cubic-bezier(0.4,0,0.2,1)}
.toggle-btn{width:100%;margin-top:10px;padding:7px;background:var(--bg1);border:1px solid var(--bg3);color:var(--blue);border-radius:5px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:0.75rem;transition:all 0.2s}
.toggle-btn:hover{background:var(--bg2);border-color:var(--blue)}
.heatmap-section{margin-bottom:12px}
.heatmap-label{font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:var(--fg4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px}
.heatmap{display:flex;gap:3px;overflow-x:auto;padding-bottom:4px}
.heatmap-week{display:flex;flex-direction:column;gap:3px}
.heatmap-day{width:12px;height:12px;background:var(--bg1);border-radius:2px;cursor:default;transition:transform 0.15s}
.heatmap-day:hover{transform:scale(1.4);z-index:10}
.heatmap-day.l1{background:#3d4220}.heatmap-day.l2{background:#595e1a}.heatmap-day.l3{background:#8a8f1a}.heatmap-day.l4{background:var(--green)}
.list-container{max-height:280px;overflow-y:auto}
.list-item{display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:4px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid var(--bg1)}
.list-item:last-child{border-bottom:none}
.list-item:hover{background:var(--bg1)}
.list-item.hidden{display:none}
.list-icon{color:var(--bg4);font-size:0.75rem;flex-shrink:0;width:14px;text-align:center}
.file-name{flex:1;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-tag{font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:var(--fg4);background:var(--bg1);padding:2px 7px;border-radius:10px;flex-shrink:0}
.empty-state{text-align:center;color:var(--bg4);padding:28px;font-family:'JetBrains Mono',monospace;font-size:0.78rem}
.no-results{display:none;text-align:center;color:var(--bg4);padding:16px;font-family:'JetBrains Mono',monospace;font-size:0.75rem}
.git-branch{font-family:'JetBrains Mono',monospace;font-size:0.95rem;font-weight:600;color:var(--aqua);margin-bottom:12px}
.git-commit-msg{font-size:0.8rem;color:var(--fg2);margin-bottom:4px;font-style:italic;line-height:1.4}
.git-commit-time{font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:var(--fg4);margin-bottom:14px}
.git-week{display:flex;align-items:baseline;gap:6px}
.git-week-num{font-family:'JetBrains Mono',monospace;font-size:1.6rem;font-weight:700;color:var(--green)}
.git-week-label{font-size:0.75rem;color:var(--fg4)}
.growth-delta{font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:700}
.pos{color:var(--green)}.neg{color:var(--red)}.neu{color:var(--fg4)}
.perf-row,.dep-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bg1);font-family:'JetBrains Mono',monospace;font-size:0.78rem}
.perf-row:last-child,.dep-row:last-child{border-bottom:none}
.perf-key,.dep-name{color:var(--fg4)}.perf-val,.dep-count{color:var(--fg2);font-weight:600}
.dep-count{color:var(--blue)}
.health-score-display{display:flex;align-items:center;gap:16px;margin-bottom:16px}
.health-circle{width:64px;height:64px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px solid;flex-shrink:0}
.health-grade{font-family:'JetBrains Mono',monospace;font-size:1.6rem;font-weight:700;line-height:1}
.health-num{font-family:'JetBrains Mono',monospace;font-size:0.6rem;opacity:0.7;margin-top:1px}
.health-factor{margin-bottom:10px}
.health-factor-header{display:flex;justify-content:space-between;margin-bottom:4px;font-family:'JetBrains Mono',monospace;font-size:0.72rem}
.health-factor-label{color:var(--fg2)}.health-factor-score{font-weight:700}
.health-factor-note{font-family:'JetBrains Mono',monospace;font-size:0.62rem;color:var(--fg4);margin-top:3px}
.contrib-item{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bg1)}
.contrib-item:last-child{border-bottom:none}
.contrib-avatar{width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;flex-shrink:0}
.contrib-info{flex:1;min-width:0}
.contrib-name{font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--fg2);font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.contrib-bar-wrap{display:flex;align-items:center;gap:8px}
.contrib-count{font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:var(--fg4);flex-shrink:0;min-width:28px;text-align:right}
.settings-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;opacity:0;pointer-events:none;transition:opacity 0.25s ease}
.settings-overlay.open{opacity:1;pointer-events:all}
.settings-panel{position:fixed;top:0;right:0;bottom:0;width:440px;background:var(--bg0);border-left:1px solid var(--bg2);z-index:101;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1)}
.settings-panel.open{transform:translateX(0)}
.settings-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 16px;border-bottom:1px solid var(--bg2);flex-shrink:0}
.settings-title{font-family:'JetBrains Mono',monospace;font-size:0.9rem;font-weight:700;color:var(--fg0);display:flex;align-items:center;gap:8px}
.settings-close{background:none;border:none;color:var(--fg4);cursor:pointer;font-size:1.2rem;padding:4px;border-radius:4px;transition:color 0.15s,background 0.15s;line-height:1}
.settings-close:hover{color:var(--fg1);background:var(--bg2)}
.settings-body{flex:1;overflow-y:auto;padding:20px}
.settings-section-title{font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:600;color:var(--fg4);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:14px}
.settings-layout{display:flex;gap:14px;align-items:flex-start}
.theme-list-col{flex:1;min-width:0}
.preview-col{width:160px;flex-shrink:0;position:sticky;top:0}
.theme-group-label{font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--bg4);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px}
.theme-group{display:flex;flex-direction:column;gap:6px}
.theme-item{padding:10px 12px;border-radius:6px;border:1px solid var(--bg2);cursor:pointer;transition:all 0.15s ease;background:var(--bg1)}
.theme-item:hover{border-color:var(--bg4);background:var(--bg2)}
.theme-item.active{border-color:var(--yellow)}.theme-item.previewing{border-color:var(--blue)}
.theme-swatch-row{display:flex;gap:4px;margin-bottom:7px}
.swatch{width:16px;height:16px;border-radius:3px;flex-shrink:0}
.theme-name{font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--fg2);font-weight:600}
.settings-footer{padding:16px 20px;border-top:1px solid var(--bg2);flex-shrink:0;display:flex;gap:8px}
.apply-btn{flex:1;padding:10px;background:var(--yellow);border:none;color:var(--bg0);border-radius:6px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:0.8rem;font-weight:700;transition:opacity 0.2s}
.apply-btn:hover{opacity:0.85}.apply-btn:disabled{opacity:0.4;cursor:not-allowed}
.cancel-btn{padding:10px 16px;background:var(--bg1);border:1px solid var(--bg3);color:var(--fg3);border-radius:6px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:0.8rem;transition:all 0.2s}
.cancel-btn:hover{background:var(--bg2);color:var(--fg1)}
.preview-label{font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--bg4);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
.card-toggles{display:flex;flex-direction:column;gap:4px;margin-bottom:18px;background:var(--bg1);border-radius:8px;border:1px solid var(--bg2);padding:6px}
.toggle-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:5px;cursor:pointer;transition:background 0.15s;font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--fg2);user-select:none}
.toggle-row:hover{background:var(--bg2)}
.toggle-row input[type="checkbox"]{-webkit-appearance:none;appearance:none;width:32px;height:18px;background:var(--bg3);border-radius:9px;flex-shrink:0;cursor:pointer;position:relative;transition:background 0.2s;outline:none}
.toggle-row input[type="checkbox"]::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--fg4);transition:all 0.2s}
.toggle-row input[type="checkbox"]:checked{background:var(--green)}
.toggle-row input[type="checkbox"]:checked::after{left:16px;background:#fff}
.preview-card{border-radius:8px;padding:12px;border:1px solid}
.preview-card-title{font-family:'JetBrains Mono',monospace;font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;opacity:0.6}
.preview-stat-row{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.preview-stat{flex:1;min-width:40px}
.preview-stat-label{font-family:'JetBrains Mono',monospace;font-size:0.55rem;opacity:0.5;margin-bottom:3px;text-transform:uppercase}
.preview-stat-value{font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:700}
.preview-bar-track{height:4px;border-radius:2px;overflow:hidden;margin-bottom:5px}
.preview-bar{height:100%;border-radius:2px}
.preview-bar-label{font-family:'JetBrains Mono',monospace;font-size:0.55rem;opacity:0.5;display:flex;justify-content:space-between}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:var(--bg0)}::-webkit-scrollbar-thumb{background:var(--bg2);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:var(--bg3)}
@media(max-width:900px){.grid,.grid-2{grid-template-columns:1fr 1fr}.grid>.card:last-child:nth-child(odd),.grid-2>.card:last-child:nth-child(odd){grid-column:1 / -1}}
@media(max-width:600px){.grid,.grid-2{grid-template-columns:1fr}.grid>.card:last-child:nth-child(odd),.grid-2>.card:last-child:nth-child(odd){grid-column:unset}.settings-panel{width:100%}}
</style>
</head>
<body>
<div class="settings-overlay" id="settingsOverlay" onclick="closeSettings()"></div>
<div class="settings-panel" id="settingsPanel">
    <div class="settings-header">
        <div class="settings-title">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/></svg>
            Settings
        </div>
        <button class="settings-close" onclick="closeSettings()">✕</button>
    </div>
    <div class="settings-body">
        <div class="settings-section-title">Dashboard Cards</div>
        <div class="card-toggles">${Object.entries(config).map(([key, val]) => `
            <label class="toggle-row">
                <input type="checkbox" ${val ? 'checked' : ''} onchange="toggleCard('${key}', this.checked)">
                <span>${key.replace(/^show/, '').replace(/([A-Z])/g, ' $1').trim()}</span>
            </label>`).join('')}
        </div>
        <div class="settings-section-title" style="margin-top:18px">Theme</div>
        <div class="settings-layout">
            <div class="preview-col">
                <div class="preview-label">Preview</div>
                <div id="themePreview"></div>
            </div>
            <div class="theme-list-col">
                ${themePickerHTML}
            </div>
        </div>
    </div>
    <div class="settings-footer">
        <button class="cancel-btn" onclick="cancelTheme()">Cancel</button>
        <button class="apply-btn" id="applyBtn" onclick="applyTheme()">Apply Theme</button>
    </div>
</div>

<div class="header">
    <div class="header-left">
        <div class="logo-mark">S/</div>
        <div>
            <div class="header-title">Statify</div>
            <div class="header-sub">Codebase Intelligence Dashboard · ${theme.label}</div>
        </div>
    </div>
    <div class="header-actions">
        <div class="header-btn-row">
            <button onclick="openSettings()" class="icon-btn" title="Settings">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/></svg>
            </button>
            <button onclick="exportJSON()" class="export-btn" title="Export as JSON">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
                Export
            </button>
            <button onclick="refreshStats()" class="refresh-btn">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
                Refresh
            </button>
        </div>
    </div>
</div>

<div class="search-bar">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099 zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
    <input class="search-input" id="searchInput" type="text" placeholder="Filter files…" oninput="filterFiles(this.value)">
    <button class="search-clear" id="searchClear" onclick="clearSearch()">✕</button>
</div>

<div class="grid">
    <div class="card accent-yellow"${showCard('showOverview')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--yellow)"></span>Overview</div>
        <div class="stat-grid">
            <div class="stat-item"><div class="stat-label">Code Files</div><div class="stat-value">${totalCodeFiles.toLocaleString()}</div></div>
            <div class="stat-item"><div class="stat-label">Lines of Code</div><div class="stat-value green">${codeStats.totalLines.toLocaleString()}</div></div>
            <div class="stat-item"><div class="stat-label">TODOs</div><div class="stat-value orange">${todoTotal}</div></div>
            <div class="stat-item"><div class="stat-label">File Edits</div><div class="stat-value purple">${totalEdits.toLocaleString()}</div></div>
        </div>
    </div>
    <div class="card accent-blue"${showCard('showSaveStreak')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--blue)"></span>Save Streak</div>
        <div class="streak-row">
            <div class="streak-cell"><span class="streak-num">${saveStreaks.current}</span><span class="streak-label">Current</span></div>
            <div class="streak-cell"><span class="streak-num">${saveStreaks.longest}</span><span class="streak-label">Longest</span></div>
            <div class="streak-cell"><span class="streak-num">${dailySaves.length}</span><span class="streak-label">Active Days</span></div>
        </div>
    </div>
    <div class="card accent-aqua"${showCard('showCommitStreak')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--aqua)"></span>Commit Streak</div>
        <div class="streak-row">
            <div class="streak-cell"><span class="streak-num">${commitStreaks.current}</span><span class="streak-label">Current</span></div>
            <div class="streak-cell"><span class="streak-num">${commitStreaks.longest}</span><span class="streak-label">Longest</span></div>
            <div class="streak-cell"><span class="streak-num">${commitActivityData.length}</span><span class="streak-label">Active Days</span></div>
        </div>
    </div>
</div>

<div class="grid-2">
    <div class="card accent-green"${showCard('showHealth')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--green)"></span>Project Health</div>
        <div class="health-score-display">
            <div class="health-circle" style="border-color:${healthColor};color:${healthColor}">
                <span class="health-grade">${health.grade}</span>
                <span class="health-num">${health.score}/100</span>
            </div>
            <div style="flex:1">
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--fg4);margin-bottom:6px">
                    ${health.score >= 85 ? 'Excellent — keep it up!' : health.score >= 70 ? 'Good shape, minor improvements possible' : health.score >= 55 ? 'Room to improve — check factors below' : 'Needs attention — review factors below'}
                </div>
            </div>
        </div>
        ${healthFactorsHTML}
    </div>
    <div class="card accent-orange"${showCard('showGrowth')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--orange)"></span>Project Growth</div>
        <div style="display:flex;gap:20px;margin-bottom:16px;">
            <div class="stat-item">
                <div class="stat-label">Since Last Scan</div>
                <div class="growth-delta ${deltaClass}">${growth.linesDelta >= 0 ? '+' : ''}${growth.linesDelta} lines</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--fg4);margin-top:3px;">${growth.filesDelta >= 0 ? '+' : ''}${growth.filesDelta} files</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Snapshots</div>
                <div class="stat-value" style="font-size:1.4rem;">${growth.snapshotCount}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--bg4);margin-top:3px;">${growth.minutesAgo}m ago</div>
            </div>
        </div>
        <div style="position:relative;height:90px;width:100%;"><canvas id="growthChart"></canvas></div>
    </div>
</div>

<div class="card grid-full accent-green"${showCard('showActivity')}>
    <div class="card-title"><span class="card-title-dot" style="background:var(--green)"></span>Activity — Last ${weeksToShow} Weeks</div>
    <div style="display:flex;gap:36px;flex-wrap:wrap;">
        <div class="heatmap-section" style="flex:1;min-width:220px;"><div class="heatmap-label">File Saves</div>${generateHeatmap(dailySaves, weeksToShow)}</div>
        <div class="heatmap-section" style="flex:1;min-width:220px;"><div class="heatmap-label">Git Commits</div>${generateHeatmap(commitActivityData, weeksToShow)}</div>
    </div>
</div>

<div class="grid-2">
    <div class="card accent-purple"${showCard('showLanguages')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--purple)"></span>Languages</div>
        ${langBarsHTML}
    </div>
    <div class="card accent-blue"${showCard('showFolders')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--blue)"></span>Folder Breakdown</div>
        ${folderBarsHTML}
    </div>
</div>

<div class="grid">
    <div class="card accent-yellow"${showCard('showRecentlyEdited')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--yellow)"></span>Recently Edited</div>
        <div class="list-container" id="recentList">
            ${recentActivityHTML}
            <div class="no-results" id="recentEmpty">No matches</div>
        </div>
    </div>
    <div class="card accent-blue"${showCard('showLargestFiles')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--blue)"></span>Largest Files</div>
        <div class="list-container" id="largestList">
            ${topFilesHTML}
            <div class="no-results" id="largestEmpty">No matches</div>
        </div>
    </div>
    <div class="card accent-purple"${showCard('showMediaAssets')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--purple)"></span>Media Assets</div>
        <div style="margin-bottom:12px;"><div class="stat-label">Total Size</div><div class="stat-value" style="font-size:1.3rem;color:var(--purple);">${(mediaStats.totalSize / 1024 / 1024).toFixed(2)} MB</div></div>
        <div class="list-container" id="mediaList">
            ${mediaFilesHTML}
            <div class="no-results" id="mediaEmpty">No matches</div>
        </div>
    </div>
</div>

<div class="grid">
    <div class="card accent-orange"${showCard('showStaleFiles')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--orange)"></span>Stale Files <span style="font-size:0.6rem;color:var(--fg4);font-weight:400;text-transform:none;letter-spacing:0">&nbsp;· untouched 6+ months</span></div>
        <div class="list-container">${staleFilesHTML}</div>
    </div>
    <div class="card accent-aqua"${showCard('showContributors')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--aqua)"></span>Top Contributors</div>
        <div class="list-container">${gitInfo.isRepo ? contributorsHTML : '<div class="empty-state">No git repository found</div>'}</div>
    </div>
    <div class="card accent-red"${showCard('showChangedFiles')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--red)"></span>Most Changed Files</div>
        <div class="list-container" id="changedList">
            ${gitInfo.isRepo ? changedFilesHTML : '<div class="empty-state">No git repository found</div>'}
            <div class="no-results" id="changedEmpty">No matches</div>
        </div>
    </div>
</div>

<div class="grid">
    <div class="card accent-orange"${showCard('showComplexity')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--orange)"></span>Complexity <span style="font-size:0.6rem;color:var(--fg4);font-weight:400;text-transform:none;letter-spacing:0">&nbsp;· ${complexity.totalFunctions} fn · ${complexity.totalClasses} cls</span></div>
        <div class="list-container" id="complexityList">
            ${complexityFilesHTML}
            <div class="no-results" id="complexityEmpty">No matches</div>
        </div>
    </div>
    <div class="card accent-aqua"${showCard('showGit')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--aqua)"></span>Git Repository</div>
        ${gitInfo.isRepo ? `<div class="git-branch">⎇ ${gitInfo.branch}</div>
        <div class="git-commit-msg">"${gitInfo.lastCommit.message}"</div>
        <div class="git-commit-time">${gitInfo.lastCommit.time}</div>
        <div class="git-week"><span class="git-week-num">${gitInfo.commitsThisWeek}</span><span class="git-week-label">commits this week</span></div>` : '<div class="empty-state">No git repository found</div>'}
    </div>
    <div class="card accent-red"${showCard('showDependencies')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--red)"></span>Dependencies</div>
        ${dependencies.total > 0 ? `<div style="margin-bottom:14px;"><div class="stat-label">Total</div><div class="stat-value red" style="font-size:1.6rem;">${dependencies.total}</div>${dependencies.dev > 0 ? `<div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:var(--fg4);margin-top:4px;">${dependencies.dev} dev deps</div>` : ''}</div>
        ${dependencies.sources.map(src => `<div class="dep-row"><span class="dep-name">${src.name}</span><span class="dep-count">${src.count}</span></div>`).join('')}` : '<div class="empty-state">No dependencies found</div>'}
    </div>
</div>

<div class="grid">
    <div class="card accent-orange"${showCard('showPerformance')}>
        <div class="card-title"><span class="card-title-dot" style="background:var(--orange)"></span>Performance</div>
        <div class="perf-row"><span class="perf-key">Scan time</span><span class="perf-val">${performance.scanTime}ms</span></div>
        <div class="perf-row"><span class="perf-key">Files scanned</span><span class="perf-val">${performance.filesScanned.toLocaleString()}</span></div>
        <div class="perf-row"><span class="perf-key">Last refresh</span><span class="perf-val">${performance.lastRefresh}</span></div>
        <div class="perf-row"><span class="perf-key">Last modified</span><span class="perf-val" style="font-size:0.65rem;max-width:140px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${lastModified}</span></div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
const vscodeApi = acquireVsCodeApi();
let growthChartInstance = null;
const CURRENT_THEME_ID = '${theme.id}';
let pendingThemeId = CURRENT_THEME_ID;
const THEME_PREVIEWS = ${escapeJson(themePreviewMap)};
const EXPORT_DATA = ${escapeJson(exportData)};
let CARD_CONFIG = ${escapeJson(config)};

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('growthChart');
    if (canvas) {
        if (growthChartInstance) { growthChartInstance.destroy(); growthChartInstance = null; }
        const growthHistory = ${escapeJson(growth.history)};
        growthChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: growthHistory.map(h => { const d = new Date(h.date); return (d.getMonth()+1)+'/'+d.getDate(); }),
                datasets: [{ data: growthHistory.map(h => h.lines), borderColor:'${theme.vars.yellow}', backgroundColor:'${theme.vars.yellow}18', borderWidth:2, tension:0.4, fill:true, pointRadius:2, pointBackgroundColor:'${theme.vars.yellow}', pointHoverRadius:5, pointHoverBackgroundColor:'${theme.vars.yellow}' }]
            },
            options: {
                responsive:true, maintainAspectRatio:false, animation:{duration:600},
                plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'${theme.vars.bg1}', titleColor:'${theme.vars.fg1}', bodyColor:'${theme.vars.fg4}', borderColor:'${theme.vars.bg2}', borderWidth:1, padding:10, displayColors:false, callbacks:{title:ctx=>ctx[0].label, label:ctx=>ctx.parsed.y.toLocaleString()+' lines'} } },
                scales:{ x:{grid:{color:'${theme.vars.bg1}'},ticks:{color:'${theme.vars.fg4}',font:{size:9,family:"'JetBrains Mono',monospace"},maxRotation:0}}, y:{grid:{color:'${theme.vars.bg1}'},ticks:{color:'${theme.vars.fg4}',font:{size:9,family:"'JetBrains Mono',monospace"},callback:v=>Number(v)>=1000?(Number(v)/1000).toFixed(1)+'K':v}} }
            }
        });
    }
    renderPreview(CURRENT_THEME_ID);
});

function openFile(file, line) { vscodeApi.postMessage({ command: 'openFile', path: file, line: line }); }
function refreshStats() { vscodeApi.postMessage({ command: 'refresh' }); }
function toggleLanguages() {
    const el = document.getElementById('more-langs');
    const btn = document.getElementById('lang-toggle');
    const show = el && el.style.display === 'none';
    if (el) el.style.display = show ? 'block' : 'none';
    if (btn) btn.textContent = show ? '－ Hide extra languages' : '＋ Show more languages';
}

function filterFiles(query) {
    const q = query.toLowerCase().trim();
    const clearBtn = document.getElementById('searchClear');
    if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);

    const listIds = ['recentList', 'largestList', 'mediaList', 'changedList', 'complexityList'];
    const emptyIds = ['recentEmpty', 'largestEmpty', 'mediaEmpty', 'changedEmpty', 'complexityEmpty'];

    listIds.forEach((listId, i) => {
        const container = document.getElementById(listId);
        const emptyEl = document.getElementById(emptyIds[i]);
        if (!container) return;
        const items = container.querySelectorAll('.list-item');
        let visible = 0;
        items.forEach(item => {
            const nameEl = item.querySelector('.file-name');
            const text = nameEl ? nameEl.textContent.toLowerCase() : '';
            const match = !q || text.includes(q);
            item.classList.toggle('hidden', !match);
            if (match) visible++;
        });
        if (emptyEl) emptyEl.style.display = (q && visible === 0) ? 'block' : 'none';
    });
}
function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) { input.value = ''; filterFiles(''); input.focus(); }
}

function exportJSON() {
    const blob = new Blob([JSON.stringify(EXPORT_DATA, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'statify-export-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function toggleCard(key, checked) {
    CARD_CONFIG[key] = checked;
    const allCards = document.querySelectorAll('.card');
    const idx = Object.keys(CARD_CONFIG).indexOf(key);
    if (allCards[idx]) {
        allCards[idx].style.display = checked ? '' : 'none';
    }
    vscodeApi.postMessage({ command: 'updateCardConfig', key, value: checked });
}

function openSettings() {
    document.getElementById('settingsOverlay').classList.add('open');
    document.getElementById('settingsPanel').classList.add('open');
    pendingThemeId = CURRENT_THEME_ID;
    updateActiveItem(CURRENT_THEME_ID);
    renderPreview(CURRENT_THEME_ID);
    updateApplyBtn();
}
function closeSettings() {
    document.getElementById('settingsOverlay').classList.remove('open');
    document.getElementById('settingsPanel').classList.remove('open');
}
function cancelTheme() { pendingThemeId = CURRENT_THEME_ID; updateActiveItem(CURRENT_THEME_ID); renderPreview(CURRENT_THEME_ID); closeSettings(); }
function applyTheme() { if (pendingThemeId !== CURRENT_THEME_ID) vscodeApi.postMessage({ command: 'setTheme', theme: pendingThemeId }); else closeSettings(); }
function previewTheme(id) {
    pendingThemeId = id;
    document.querySelectorAll('.theme-item').forEach(el => { el.classList.remove('previewing'); if (el.dataset.themeId === id) el.classList.add('previewing'); });
    renderPreview(id); updateApplyBtn();
}
function updateActiveItem(id) { document.querySelectorAll('.theme-item').forEach(el => { el.classList.toggle('active', el.dataset.themeId === id); el.classList.remove('previewing'); }); }
function updateApplyBtn() {
    const btn = document.getElementById('applyBtn');
    if (!btn) return;
    btn.disabled = pendingThemeId === CURRENT_THEME_ID;
    btn.textContent = pendingThemeId === CURRENT_THEME_ID ? 'Already Applied' : 'Apply Theme';
}
function renderPreview(id) {
    const t = THEME_PREVIEWS[id]; if (!t) return;
    const el = document.getElementById('themePreview'); if (!el) return;
    el.innerHTML = \`<div class="preview-card" style="background:\${t.bg0};border-color:\${t.bg2};color:\${t.fg1}">
        <div class="preview-card-title" style="color:\${t.fg4}">◆ Overview</div>
        <div class="preview-stat-row">
            <div class="preview-stat"><div class="preview-stat-label" style="color:\${t.fg4}">Lines</div><div class="preview-stat-value" style="color:\${t.yellow}">12.4K</div></div>
            <div class="preview-stat"><div class="preview-stat-label" style="color:\${t.fg4}">Files</div><div class="preview-stat-value" style="color:\${t.green}">84</div></div>
            <div class="preview-stat"><div class="preview-stat-label" style="color:\${t.fg4}">TODOs</div><div class="preview-stat-value" style="color:\${t.orange}">7</div></div>
        </div>
        <div style="margin-bottom:6px"><div class="preview-bar-track" style="background:\${t.bg1}"><div class="preview-bar" style="width:68%;background:\${t.blue}"></div></div><div class="preview-bar-label" style="color:\${t.fg4}"><span>TypeScript</span><span>68%</span></div></div>
        <div style="margin-bottom:6px"><div class="preview-bar-track" style="background:\${t.bg1}"><div class="preview-bar" style="width:22%;background:\${t.yellow}"></div></div><div class="preview-bar-label" style="color:\${t.fg4}"><span>JavaScript</span><span>22%</span></div></div>
        <div><div class="preview-bar-track" style="background:\${t.bg1}"><div class="preview-bar" style="width:10%;background:\${t.purple}"></div></div><div class="preview-bar-label" style="color:\${t.fg4}"><span>CSS</span><span>10%</span></div></div>
    </div>\`;
}
</script>
</body>
</html>`;
}
