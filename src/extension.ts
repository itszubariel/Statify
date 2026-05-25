import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { THEMES, getTheme } from './themes/index';
import { scanFiles } from './scanner';
import { getGitInfo } from './git';
import { calcHealthScore } from './health';
import { calcGrowth } from './state';
import { getWebviewContent } from './webview';
import { StatifyTreeDataProvider } from './treeView';
import type { DashboardConfig, Dependencies, DepSource, ProjectStats } from './types';

const panels = new Map<string, vscode.WebviewPanel>();

const defaultConfig: DashboardConfig = {
    showOverview: true, showSaveStreak: true, showCommitStreak: true,
    showHealth: true, showGrowth: true, showActivity: true,
    showLanguages: true, showFolders: true, showRecentlyEdited: true,
    showLargestFiles: true, showMediaAssets: true, showStaleFiles: true,
    showContributors: true, showChangedFiles: true, showGit: true,
    showDependencies: true, showPerformance: true, showComplexity: true,
};

function getDashboardConfig(): DashboardConfig {
    const cfg = vscode.workspace.getConfiguration('statify.dashboardCards');
    const result: DashboardConfig = { ...defaultConfig };
    for (const key of Object.keys(defaultConfig) as (keyof DashboardConfig)[]) {
        const val = cfg.get<boolean>(key);
        if (val !== undefined) { result[key] = val; }
    }
    return result;
}

function scanDependencies(root: string): Dependencies {
    const dependencies: Dependencies = { total: 0, dev: 0, sources: [] };
    const packageJsonPath = path.join(root, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
            const deps = Object.keys(pkg.dependencies || {}).length;
            const devDeps = Object.keys(pkg.devDependencies || {}).length;
            dependencies.total += deps + devDeps; dependencies.dev += devDeps;
            dependencies.sources.push({ name: 'package.json', count: deps + devDeps, dev: devDeps });
        } catch { /* ignore */ }
    }
    const requirementsPath = path.join(root, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
        try {
            const deps = fs.readFileSync(requirementsPath, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
            dependencies.total += deps; dependencies.sources.push({ name: 'requirements.txt', count: deps });
        } catch { /* ignore */ }
    }
    const pomPath = path.join(root, 'pom.xml');
    if (fs.existsSync(pomPath)) {
        try {
            const deps = (fs.readFileSync(pomPath, 'utf-8').match(/<dependency>/g) || []).length;
            dependencies.total += deps; dependencies.sources.push({ name: 'pom.xml', count: deps });
        } catch { /* ignore */ }
    }
    const cargoPath = path.join(root, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
        try {
            const content = fs.readFileSync(cargoPath, 'utf-8');
            const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
            const devDepsMatch = content.match(/\[dev-dependencies\]([\s\S]*?)(\[|$)/);
            const deps = depsMatch ? depsMatch[1].split('\n').filter(l => l.trim() && !l.startsWith('#')).length : 0;
            const devDeps = devDepsMatch ? devDepsMatch[1].split('\n').filter(l => l.trim() && !l.startsWith('#')).length : 0;
            dependencies.total += deps + devDeps; dependencies.dev += devDeps;
            dependencies.sources.push({ name: 'Cargo.toml', count: deps + devDeps, dev: devDeps });
        } catch { /* ignore */ }
    }
    return dependencies;
}

async function gatherStats(root: string): Promise<ProjectStats> {
    const startTime = Date.now();
    const deps = scanDependencies(root);
    const { gitInfo, commitActivityData } = getGitInfo(root);
    const scanned = await scanFiles(root);

    const partialStats: Omit<ProjectStats, 'health'> = {
        codeStats: scanned.codeStats,
        mediaStats: scanned.mediaStats,
        complexity: scanned.complexity,
        totalFiles: scanned.totalFiles,
        codeTopFiles: scanned.codeTopFiles,
        totalEdits: scanned.totalEdits,
        lastModified: scanned.lastModified,
        dailySaves: scanned.dailySaves,
        mostEditedFiles: scanned.mostEditedFiles,
        staleFiles: scanned.staleFiles,
        gitInfo,
        commitActivityData,
        dependencies: deps,
        performance: { scanTime: Date.now() - startTime, filesScanned: scanned.totalFiles, lastRefresh: new Date().toLocaleTimeString() }
    };

    const health = calcHealthScore(partialStats, commitActivityData);
    return { ...partialStats, health };
}

export function activate(context: vscode.ExtensionContext): void {
    const treeProvider = new StatifyTreeDataProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('statifyTreeView', treeProvider)
    );

    const dashboardCmd = vscode.commands.registerCommand('statify.openDashboard', async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) { vscode.window.showWarningMessage('Open a folder first!'); return; }

        const rootPath = folders[0].uri.fsPath;
        const panel = vscode.window.createWebviewPanel('statifyDashboard', 'Statify / Dashboard', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });

        panels.set(rootPath, panel);
        panel.onDidDispose(() => panels.delete(rootPath));

        const renderDashboard = async () => {
            const themeId = context.globalState.get<string>('statifyTheme', 'gruvbox-dark-hard');
            const theme = getTheme(themeId);
            const stats = await gatherStats(rootPath);
            const growth = calcGrowth(context.workspaceState, rootPath, stats);
            const config = getDashboardConfig();
            panel.webview.html = getWebviewContent(stats, rootPath, growth, theme, config);
        };

        await renderDashboard();

        panel.webview.onDidReceiveMessage(async (msg: { command: string; path?: string; line?: number; theme?: string; key?: string; value?: boolean }) => {
            if (msg.command === 'openFile' && msg.path) {
                try {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(msg.path));
                    await vscode.window.showTextDocument(doc, { selection: new vscode.Range(msg.line ?? 0, 0, msg.line ?? 0, 0), preview: false });
                } catch { vscode.window.showErrorMessage(`Could not open file: ${msg.path}`); }
            } else if (msg.command === 'refresh') {
                await renderDashboard();
            } else if (msg.command === 'setTheme' && msg.theme) {
                await context.globalState.update('statifyTheme', msg.theme);
                await renderDashboard();
            } else if (msg.command === 'updateCardConfig' && msg.key) {
                await vscode.workspace.getConfiguration('statify.dashboardCards').update(msg.key, msg.value, vscode.ConfigurationTarget.Global);
            }
        });
    });

    function refreshAll(): void {
        panels.forEach(p => { if (p.visible) { p.webview.postMessage({ command: 'refresh' }); } });
        treeProvider.refresh();
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(() => refreshAll()),
        vscode.workspace.onDidCreateFiles(() => refreshAll()),
        vscode.workspace.onDidDeleteFiles(() => refreshAll()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => { panels.clear(); treeProvider.refresh(); }),
        dashboardCmd
    );
}

export function deactivate(): void { }
