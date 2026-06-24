import * as vscode from 'vscode';
import { getTheme } from './themes/index';
import { gatherStats, getScanConfig } from './stats';
import { calcGrowth } from './state';
import { getWebviewContent } from './webview';
import { StatifyTreeDataProvider } from './treeView';
import type { DashboardConfig } from './types';

const panels = new Map<string, vscode.WebviewPanel>();

let refreshTimer: NodeJS.Timeout;

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
            const themeId = context.globalState.get<string>('statifyTheme', 'gruvbox-dark-hard') ?? 'gruvbox-dark-hard';
            const theme = getTheme(themeId);
            const scanConfig = getScanConfig();
            const stats = await gatherStats(rootPath, scanConfig);
            const growth = await calcGrowth(context.workspaceState, rootPath, stats);
            const config = getDashboardConfig();
            panel.webview.html = getWebviewContent(stats, rootPath, growth, theme, config, scanConfig.staleDays);
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
        vscode.workspace.onDidChangeTextDocument(() => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => refreshAll(), 500);
        }),
        vscode.workspace.onDidCreateFiles(() => refreshAll()),
        vscode.workspace.onDidDeleteFiles(() => refreshAll()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => { panels.clear(); treeProvider.refresh(); }),
        dashboardCmd
    );
}

export function deactivate(): void { }
