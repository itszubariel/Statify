import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import type { CodeStats, ComplexityFile, ComplexityInfo, DailySave, FileItem, MediaStats, ScanConfig, StaleFile, TodoItem } from './types';
import { DEFAULT_SCAN_CONFIG } from './types';

export async function isTextFile(filePath: string): Promise<boolean> {
    try {
        const stats = await fsPromises.stat(filePath);
        if (stats.size > 50 * 1024 * 1024) { return false; }

        const fd = await fsPromises.open(filePath, 'r');
        try {
            const buffer = Buffer.alloc(8192);
            const { bytesRead } = await fd.read(buffer, 0, 8192, 0);
            if (bytesRead === 0) { return true; }

            let control = 0;
            for (let i = 0; i < bytesRead; i++) {
                const b = buffer[i];
                if (b === 0) { return false; }
                if (b < 32 && b !== 9 && b !== 10 && b !== 13) {
                    control++;
                }
            }
            return (control / bytesRead) < 0.02;
        } finally {
            await fd.close();
        }
    } catch (err) {
        console.error('[Statify] isTextFile error:', filePath, err);
        return false;
    }
}

const BINARY_EXTENSIONS = new Set([
    'zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz', 'exe', 'dll', 'so', 'dylib',
    'bin', 'dat', 'db', 'sqlite', 'sqlite3', 'pdf', 'docx', 'xlsx', 'pptx',
    'class', 'jar', 'war', 'ear', 'ttf', 'otf', 'woff', 'woff2', 'eot'
]);
const TEXT_EXTENSIONS = new Set([
    'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'rs', 'go', 'c', 'cpp', 'h', 'hpp',
    'cs', 'rb', 'php', 'swift', 'kt', 'html', 'css', 'scss', 'json', 'md',
    'yaml', 'yml', 'xml', 'sh', 'txt', 'toml', 'prisma', 'tf', 'proto', 'sql',
    'dart', 'lua', 'zig', 'nix', 'ex', 'exs', 'gleam', 'wgsl', 'r', 'vue',
    'svelte', 'astro', 'graphql', 'gql', 'dockerfile', 'makefile', 'cmake',
    'gradle', 'mjs', 'cjs', 'mts', 'cts', 'scala', 'groovy', 'hs', 'ml',
    'elm', 'clj', 'cljs', 'edn', 'coffee', 'litcoffee', 'nim', 'crystal',
    'erl', 'hrl', 'ps1', 'bat', 'cmd', 'zsh', 'fish', 'bash', 'awk', 'sed',
    'pl', 'pm', 't', 'pod', 'pas', 'dpr', 'lpr', 'ada', 'adb', 'asm', 's',
    'S', 'f', 'f90', 'f95', 'f03', 'f08', 'for', 'm', 'mm', 'tex', 'sty',
    'cls', 'bib', 'rst', 'org', 'wiki', 'ipynb', 'qmd', 'rmd',
]);

async function countLines(filePath: string): Promise<{ total: number; todos: number[]; content?: string }> {
    const stats = await fsPromises.stat(filePath);
    if (stats.size === 0) {
        return { total: 0, todos: [], content: '' };
    }
    if (stats.size < 2 * 1024 * 1024) {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const total = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
        const todoLines: number[] = [];
        lines.forEach((l, i) => { if (i < total && /TODO|FIXME|HACK|XXX/.test(l)) { todoLines.push(i); } });
        return { total, todos: todoLines, content };
    } else {
        return new Promise((resolve, reject) => {
            let total = 0;
            const stream = fs.createReadStream(filePath);
            stream.on('data', (chunk: string | Buffer) => {
                const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
                if (buf.length > 0 && buf[0] !== 10 && total === 0) { total = 1; }
                for (let i = 0; i < buf.length; i++) {
                    if (buf[i] === 10) { total++; }
                }
            });
            stream.on('end', () => {
                resolve({ total, todos: [] });
            });
            stream.on('error', err => reject(err));
        });
    }
}

function countSymbols(symbols: Array<vscode.DocumentSymbol | vscode.SymbolInformation>): { functions: number; classes: number } {
    let functions = 0;
    let classes = 0;

    function visit(s: vscode.DocumentSymbol | vscode.SymbolInformation) {
        if (s.kind === vscode.SymbolKind.Function || s.kind === vscode.SymbolKind.Method || s.kind === vscode.SymbolKind.Constructor) {
            functions++;
        } else if (s.kind === vscode.SymbolKind.Class || s.kind === vscode.SymbolKind.Interface || s.kind === vscode.SymbolKind.Struct) {
            classes++;
        }

        if ('children' in s && Array.isArray(s.children)) {
            for (const child of s.children) {
                visit(child);
            }
        }
    }

    for (const symbol of symbols) {
        visit(symbol);
    }

    return { functions, classes };
}

async function getComplexityInfo(uri: vscode.Uri, content: string | undefined): Promise<ComplexityFile | null> {
    let functions = 0;
    let classes = 0;

    try {
        const symbolsPromise = vscode.commands.executeCommand<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>(
            'vscode.executeDocumentSymbolProvider',
            uri
        );
        const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 800));
        const symbols = await Promise.race([symbolsPromise, timeoutPromise]);
        if (symbols && symbols.length > 0) {
            const count = countSymbols(symbols);
            functions = count.functions;
            classes = count.classes;
        }
    } catch (err) {
        console.log('[Statify] Symbol provider failed for:', uri.fsPath, err);
    }

    let longLinePct = 0;
    if (content) {
        const lines = content.split('\n');
        const longLines = lines.filter(l => l.length > 80).length;
        longLinePct = lines.length > 0 ? (longLines / lines.length) * 100 : 0;
    }

    if (functions === 0 && classes === 0) { return null; }
    return { path: vscode.workspace.asRelativePath(uri.fsPath), functions, classes, longLinePct };
}

async function asyncPool<T, R>(limit: number, array: T[], iteratorFn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(array.length);
    let index = 0;

    async function worker() {
        while (index < array.length) {
            const currentIndex = index++;
            results[currentIndex] = await iteratorFn(array[currentIndex]);
        }
    }

    const workers = Array.from({ length: Math.min(limit, array.length) }, worker);
    await Promise.all(workers);
    return results;
}

interface FileScanResult {
    uri: vscode.Uri;
    path: string;
    size: number;
    ext: string;
    folder: string;
    mtime: number;
    isMedia: boolean;
    isText: boolean;
    lines: number;
    todos: TodoItem | null;
    complexity: ComplexityFile | null;
}

export async function scanFiles(root: string, config?: Partial<ScanConfig>): Promise<{
    codeStats: CodeStats;
    mediaStats: MediaStats;
    complexity: ComplexityInfo;
    staleFiles: StaleFile[];
    codeTopFiles: FileItem[];
    mostEditedFiles: Array<{ path: string; lastModified: string }>;
    dailySaves: DailySave[];
    totalEdits: number;
    lastModified: string;
    totalFiles: number;
}> {
    const cfg: ScanConfig = { ...DEFAULT_SCAN_CONFIG, ...config };
    const excludePattern = cfg.excludePatterns.length > 0 ? `{${cfg.excludePatterns.join(',')}}` : undefined;

    console.log('[Statify] scanFiles: finding files in workspace...');
    const files = await vscode.workspace.findFiles('**/*', excludePattern);
    console.log(`[Statify] scanFiles: found ${files.length} files. Starting processing...`);

    const mediaExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi', 'webm', 'mp3', 'wav', 'ogg', 'bmp', 'ico', 'webp', 'svg', 'flv', 'mkv', 'flac', 'aac', 'm4a']);

    const codeStats: CodeStats = { totalLines: 0, todos: [], biggest: null, languages: {}, langLines: {}, folders: {}, folderLines: {} };
    const mediaStats: MediaStats = { totalFiles: 0, totalSize: 0, biggest: null, files: [], topFiles: [] };
    const staleFiles: StaleFile[] = [];
    const complexityFiles: ComplexityFile[] = [];
    let totalFuncs = 0;
    let totalClasses = 0;

    async function processFile(file: vscode.Uri): Promise<FileScanResult | null> {
        try {
            const relPath = vscode.workspace.asRelativePath(file.fsPath);
            const ext = path.extname(file.fsPath).replace('.', '').toLowerCase() || 'other';
            const folder = relPath.includes('/') ? relPath.split('/')[0] : '.';

            const s = await fsPromises.stat(file.fsPath);
            if (!s.isFile()) { return null; }

            const isMedia = mediaExts.has(ext);
            if (isMedia) {
                return {
                    uri: file,
                    path: relPath,
                    size: s.size,
                    ext,
                    folder,
                    mtime: s.mtimeMs,
                    isMedia: true,
                    isText: false,
                    lines: 0,
                    todos: null,
                    complexity: null
                };
            }

            let isText = false;
            if (BINARY_EXTENSIONS.has(ext)) {
                isText = false;
            } else if (TEXT_EXTENSIONS.has(ext)) {
                isText = true;
            } else {
                isText = await isTextFile(file.fsPath);
            }

            let lines = 0;
            let todos: TodoItem | null = null;

            if (isText) {
                const lineRes = await countLines(file.fsPath);
                lines = lineRes.total;
                if (lineRes.todos.length > 0) {
                    todos = { file: relPath, count: lineRes.todos.length, lines: lineRes.todos };
                }
            }

            return {
                uri: file,
                path: relPath,
                size: s.size,
                ext,
                folder,
                mtime: s.mtimeMs,
                isMedia: false,
                isText,
                lines,
                todos,
                complexity: null
            };
        } catch (err) {
            console.error('[Statify] Error processing file:', file.fsPath, err);
            return null;
        }
    }

    const results = (await asyncPool(cfg.concurrency, files, processFile)).filter((r): r is FileScanResult => r !== null);
    console.log(`[Statify] scanFiles: processed ${results.length} files successfully. Running complexity analysis...`);

    const candidateResults = results
        .filter(r => !r.isMedia && r.isText)
        .sort((a, b) => b.size - a.size)
        .slice(0, cfg.complexityFileLimit);

    await asyncPool(cfg.complexityConcurrency, candidateResults, async (r) => {
        try {
            let content: string | undefined;
            if (r.size < 2 * 1024 * 1024) {
                content = await fsPromises.readFile(r.uri.fsPath, 'utf-8');
            }
            r.complexity = await getComplexityInfo(r.uri, content);
        } catch (err) {
            console.error('[Statify] Complexity analysis error:', r.path, err);
        }
    });
    console.log('[Statify] scanFiles: complexity analysis completed');

    for (const r of results) {
        if (r.isMedia) {
            mediaStats.totalFiles++;
            mediaStats.totalSize += r.size;
            mediaStats.files.push({ path: r.path, size: r.size });
            if (!mediaStats.biggest || r.size > mediaStats.biggest.size) { mediaStats.biggest = { path: r.path, size: r.size }; }
        } else {
            codeStats.languages[r.ext] = (codeStats.languages[r.ext] || 0) + 1;
            codeStats.folders[r.folder] = (codeStats.folders[r.folder] || 0) + 1;

            if (!codeStats.biggest || r.size > codeStats.biggest.size) { codeStats.biggest = { path: r.path, size: r.size }; }

            const ageDays = (Date.now() - r.mtime) / 86400000;
            if (ageDays > cfg.staleDays) { staleFiles.push({ path: r.path, daysSince: Math.round(ageDays), size: r.size }); }
            if (r.isText) {
                codeStats.totalLines += r.lines;
                codeStats.langLines[r.ext] = (codeStats.langLines[r.ext] || 0) + r.lines;
                codeStats.folderLines[r.folder] = (codeStats.folderLines[r.folder] || 0) + r.lines;

                if (r.todos) { codeStats.todos.push(r.todos); }

                if (r.complexity) {
                    totalFuncs += r.complexity.functions;
                    totalClasses += r.complexity.classes;
                    complexityFiles.push(r.complexity);
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

    const mostEditedFiles = results
        .filter(r => !r.isMedia && r.isText)
        .sort((a, b) => b.mtime - a.mtime).slice(0, 10)
        .map(f => ({ path: f.path, lastModified: new Date(f.mtime).toLocaleDateString() }));

    const codeTopFiles: FileItem[] = results
        .filter(r => !r.isMedia && r.isText)
        .map(r => ({ path: r.path, size: r.size }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

    let dailySaves: DailySave[] = [];
    let totalEdits = 0;
    let lastModified = '';
    try {
        const dateCounts: Record<string, number> = {};
        let mostRecentMtime = 0, mostRecentFile = '';
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

        for (const r of results) {
            if (r.isMedia || !r.isText) { continue; }
            const mtime = r.mtime;
            if (mtime < oneYearAgo) { continue; }
            totalEdits++;
            const dateStr = new Date(mtime).toISOString().split('T')[0];
            dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
            if (mtime > mostRecentMtime) { mostRecentMtime = mtime; mostRecentFile = r.path; }
        }
        lastModified = mostRecentFile ? `${mostRecentFile} (${new Date(mostRecentMtime).toLocaleDateString()})` : 'N/A';
        dailySaves = Object.entries(dateCounts).map(([date, count]) => ({ date, count: Number(count) })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
        console.error('[Statify] Error processing daily saves:', err);
    }

    console.log('[Statify] scanFiles completed successfully');
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
    };
}
