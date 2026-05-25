import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { CodeStats, ComplexityFile, ComplexityInfo, DailySave, FileItem, MediaStats, StaleFile, TodoItem } from './types';

export function isTextFile(filePath: string): boolean {
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > 5 * 1024 * 1024) { return false; }
        const rawBytes = fs.readFileSync(filePath);
        if (rawBytes.length < 10) { return true; }
        const sample = rawBytes.slice(0, Math.min(8192, rawBytes.length));
        let valid = 0, control = 0;
        for (let i = 0; i < sample.length; i++) {
            const b = sample[i];
            if (b === 0) { return false; }
            if (b >= 32 && b <= 126) { valid++; }
            if (b < 32 && b !== 9 && b !== 10 && b !== 13) { control++; }
        }
        return (valid / sample.length) > 0.90 && (control / sample.length) < 0.10;
    } catch { return false; }
}

const complexityPatterns: Record<string, { func: RegExp; cls: RegExp }> = {
    ts: { func: /(?:^|\s)(?:function\s+\w+|(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*[:\{])/gm, cls: /(?:^|\s)(?:class|interface|type|abstract\s+class)\s+\w+/gm },
    tsx: { func: /(?:^|\s)(?:function\s+\w+|(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*[:\{])/gm, cls: /(?:^|\s)(?:class|interface|type)\s+\w+/gm },
    js: { func: /(?:^|\s)(?:function\s+\w+|(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{)/gm, cls: /(?:^|\s)class\s+\w+/gm },
    jsx: { func: /(?:^|\s)(?:function\s+\w+|(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{)/gm, cls: /(?:^|\s)class\s+\w+/gm },
    py: { func: /^[ \t]*(?:async\s+)?def\s+\w+/gm, cls: /^[ \t]*class\s+\w+/gm },
    java: { func: /(?:public|private|protected)\s+\w+\s+\w+\s*\(/g, cls: /(?:class|interface|abstract\s+class)\s+\w+/g },
    rs: { func: /(?:^|\s)(?:pub\s+)?fn\s+\w+/gm, cls: /(?:^|\s)(?:pub\s+)?(?:struct|enum|trait|impl)\s+\w+/gm },
    go: { func: /^func\s+\w+/gm, cls: /^type\s+\w+\s+(?:struct|interface)/gm },
    c: { func: /\w+\s+\w+\s*\([^)]*\)\s*\{/g, cls: /struct\s+\w+/g },
    cpp: { func: /\w+\s+\w+\s*\([^)]*\)\s*(?:const\s*)?\{/g, cls: /class\s+\w+/g },
    cs: { func: /(?:public|private|protected|internal)\s+(?:\w+\s+)*\w+\s*\(/g, cls: /class\s+\w+/g },
    rb: { func: /^[ \t]*(?:def)\s+\w+/gm, cls: /^[ \t]*(?:class|module)\s+\w+/gm },
    php: { func: /function\s+\w+/g, cls: /class\s+\w+/g },
    swift: { func: /func\s+\w+/g, cls: /(?:class|struct|enum|protocol)\s+\w+/g },
    kt: { func: /fun\s+\w+/g, cls: /(?:class|interface|object)\s+\w+/g },
};

function analyzeComplexity(content: string, ext: string, relPath: string): ComplexityFile | null {
    const patterns = complexityPatterns[ext];
    if (!patterns) { return null; }

    const funcs = content.match(patterns.func);
    const classes = content.match(patterns.cls);

    const lines = content.split('\n');
    const longLines = lines.filter(l => l.length > 80).length;
    const longLinePct = lines.length > 0 ? (longLines / lines.length) * 100 : 0;

    const funcCount = funcs ? funcs.length : 0;
    const classCount = classes ? classes.length : 0;

    if (funcCount === 0 && classCount === 0) { return null; }

    return { path: relPath, functions: funcCount, classes: classCount, longLinePct };
}

export async function scanFiles(root: string): Promise<{
    codeStats: CodeStats;
    mediaStats: MediaStats;
    complexity: ComplexityInfo;
    recentFiles: Array<{ path: string; mtime: number }>;
    staleFiles: StaleFile[];
    codeTopFiles: FileItem[];
    mostEditedFiles: Array<{ path: string; lastModified: string }>;
    dailySaves: DailySave[];
    totalEdits: number;
    lastModified: string;
    totalFiles: number;
}> {
    const files = await vscode.workspace.findFiles('**/*', '{**/node_modules/**,**/target/**,**/build/**,**/dist/**,**/.venv/**,**/venv/**,**/__pycache__/**,**/.next/**,**/.nuxt/**,**/vendor/**,**/bin/**,**/obj/**}');

    const mediaExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi', 'webm', 'mp3', 'wav', 'ogg', 'bmp', 'ico', 'webp', 'svg', 'flv', 'mkv', 'flac', 'aac', 'm4a']);

    const codeStats: CodeStats = { totalLines: 0, todos: [], biggest: null, languages: {}, langLines: {}, folders: {}, folderLines: {} };
    const mediaStats: MediaStats = { totalFiles: 0, totalSize: 0, biggest: null, files: [], topFiles: [] };
    const recentFiles: Array<{ path: string; mtime: number }> = [];
    const staleFiles: StaleFile[] = [];
    const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
    const complexityFiles: ComplexityFile[] = [];
    let totalFuncs = 0, totalClasses = 0;

    for (const file of files) {
        const relPath = vscode.workspace.asRelativePath(file.fsPath);
        const ext = path.extname(file.fsPath).replace('.', '').toLowerCase() || 'other';
        const folder = relPath.includes('/') ? relPath.split('/')[0] : '.';

        let s: fs.Stats;
        try { s = fs.statSync(file.fsPath); } catch { continue; }
        if (!s.isFile()) { continue; }

        if (mediaExts.has(ext)) {
            mediaStats.totalFiles++;
            mediaStats.totalSize += s.size;
            mediaStats.files.push({ path: relPath, size: s.size });
            if (!mediaStats.biggest || s.size > mediaStats.biggest.size) { mediaStats.biggest = { path: relPath, size: s.size }; }
        } else {
            codeStats.languages[ext] = (codeStats.languages[ext] || 0) + 1;
            codeStats.folders[folder] = (codeStats.folders[folder] || 0) + 1;

            if (!codeStats.biggest || s.size > codeStats.biggest.size) { codeStats.biggest = { path: relPath, size: s.size }; }

            const ageDays = (Date.now() - s.mtimeMs) / 86400000;
            if (ageDays > 180) { staleFiles.push({ path: relPath, daysSince: Math.round(ageDays), size: s.size }); }
            if (ageDays <= 30) { recentFiles.push({ path: relPath, mtime: s.mtimeMs }); }

            if (isTextFile(file.fsPath)) {
                let content = '';
                try { content = fs.readFileSync(file.fsPath, 'utf-8'); } catch { continue; }

                const lines = content.split('\n');
                codeStats.totalLines += lines.length;
                codeStats.langLines[ext] = (codeStats.langLines[ext] || 0) + lines.length;
                codeStats.folderLines[folder] = (codeStats.folderLines[folder] || 0) + lines.length;

                const todoLines: number[] = [];
                lines.forEach((l, i) => { if (/TODO|FIXME/.test(l)) { todoLines.push(i); } });
                if (todoLines.length) { codeStats.todos.push({ file: relPath, count: todoLines.length, lines: todoLines }); }

                const cf = analyzeComplexity(content, ext, relPath);
                if (cf) {
                    totalFuncs += cf.functions;
                    totalClasses += cf.classes;
                    complexityFiles.push(cf);
                }
            }
        }
    }

    mediaStats.files.sort((a, b) => b.size - a.size);
    mediaStats.topFiles = mediaStats.files.slice(0, 5);
    staleFiles.sort((a, b) => b.daysSince - a.daysSince);

    const complexity: ComplexityInfo = {
        totalFunctions: totalFuncs,
        totalClasses: totalClasses,
        topFiles: complexityFiles.sort((a, b) => (b.functions + b.classes) - (a.functions + a.classes)).slice(0, 10),
    };

    const mostEditedFiles = recentFiles
        .sort((a, b) => b.mtime - a.mtime).slice(0, 10)
        .map(f => ({ path: f.path, lastModified: new Date(f.mtime).toLocaleDateString() }));

    const codeTopFiles: FileItem[] = files
        .filter(f => { try { return fs.statSync(f.fsPath).isFile() && isTextFile(f.fsPath); } catch { return false; } })
        .map(f => ({ path: vscode.workspace.asRelativePath(f.fsPath), size: fs.statSync(f.fsPath).size }))
        .sort((a, b) => b.size - a.size).slice(0, 10);

    let dailySaves: DailySave[] = [];
    let totalEdits = 0;
    let lastModified = '';
    try {
        const dateCounts: Record<string, number> = {};
        let mostRecentMtime = 0, mostRecentFile = '';
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        for (const file of files) {
            let fstats: fs.Stats;
            try { fstats = fs.statSync(file.fsPath); } catch { continue; }
            if (!fstats.isFile() || !isTextFile(file.fsPath)) { continue; }
            const mtime = fstats.mtimeMs;
            if (mtime < oneYearAgo) { continue; }
            totalEdits++;
            const dateStr = new Date(mtime).toISOString().split('T')[0];
            dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
            if (mtime > mostRecentMtime) { mostRecentMtime = mtime; mostRecentFile = vscode.workspace.asRelativePath(file.fsPath); }
        }
        lastModified = mostRecentFile ? `${mostRecentFile} (${new Date(mostRecentMtime).toLocaleDateString()})` : 'N/A';
        dailySaves = Object.entries(dateCounts).map(([date, count]) => ({ date, count: Number(count) })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch { /* ignore */ }

    return {
        codeStats,
        mediaStats,
        complexity,
        totalFiles: files.length,
        codeTopFiles,
        totalEdits,
        lastModified,
        dailySaves,
        mostEditedFiles,
        staleFiles: staleFiles.slice(0, 10),
        recentFiles,
    };
}
