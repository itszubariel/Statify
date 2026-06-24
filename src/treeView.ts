import * as vscode from 'vscode';
import { gatherStats, getScanConfig } from './stats';
import type { ProjectStats } from './types';

class StatifyTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        description: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        command?: vscode.Command,
        icon?: vscode.ThemeIcon,
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.tooltip = `${label}${description ? ': ' + description : ''}`;
        if (command) { this.command = command; }
        if (icon) { this.iconPath = icon; }
        this.contextValue = collapsibleState === vscode.TreeItemCollapsibleState.None ? 'statItem' : 'statSection';
    }
}

type LazyStats = ProjectStats | null;

export class StatifyTreeDataProvider implements vscode.TreeDataProvider<StatifyTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<StatifyTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private statsCache: LazyStats = null;
    private rootPath: string = '';

    refresh(): void {
        this.statsCache = null;
        this._onDidChangeTreeData.fire(undefined);
    }

    private async getStats(): Promise<LazyStats> {
        if (this.statsCache) { return this.statsCache; }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) { return null; }
        const root = folders[0].uri.fsPath;
        this.rootPath = root;

        const scanConfig = getScanConfig();
        this.statsCache = await gatherStats(root, scanConfig);
        return this.statsCache;
    }

    getTreeItem(element: StatifyTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: StatifyTreeItem): Promise<StatifyTreeItem[]> {
        if (!element) {
            return this.getRootItems();
        }
        return this.getChildItems(element);
    }

    private async getRootItems(): Promise<StatifyTreeItem[]> {
        const items: StatifyTreeItem[] = [];

        const dashItem = new StatifyTreeItem(
            'Open Dashboard', '',
            vscode.TreeItemCollapsibleState.None,
            { command: 'statify.openDashboard', title: '', arguments: [] },
            new vscode.ThemeIcon('dashboard'),
        );
        items.push(dashItem);

        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
            items.push(new StatifyTreeItem('Open a folder to see stats', '', vscode.TreeItemCollapsibleState.None));
            return items;
        }

        items.push(new StatifyTreeItem('', '', vscode.TreeItemCollapsibleState.None));

        const stats = await this.getStats();
        if (!stats) {
            items.push(new StatifyTreeItem('Error loading stats', '', vscode.TreeItemCollapsibleState.None));
            return items;
        }

        const totalCodeFiles = Object.values(stats.codeStats.languages).reduce((a, b) => a + b, 0);
        const todoTotal = stats.codeStats.todos.reduce((a, b) => a + b.count, 0);

        items.push(new StatifyTreeItem(
            `Overview`, '',
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            new vscode.ThemeIcon('symbol-file'),
        ));
        items.push(new StatifyTreeItem(
            `Languages`, '',
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            new vscode.ThemeIcon('symbol-color'),
        ));
        items.push(new StatifyTreeItem(
            `Top Folders`, '',
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            new vscode.ThemeIcon('folder'),
        ));
        items.push(new StatifyTreeItem(
            `Health`, `Score: ${stats.health.score}/100 (${stats.health.grade})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            new vscode.ThemeIcon(stats.health.score >= 70 ? 'heart' : 'issues'),
        ));
        if (stats.gitInfo.isRepo) {
            items.push(new StatifyTreeItem(
                `Git`, `⎇ ${stats.gitInfo.branch}`,
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                new vscode.ThemeIcon('git-branch'),
            ));
        }

        return items;
    }

    private getChildItems(element: StatifyTreeItem): StatifyTreeItem[] {
        const stats = this.statsCache;
        if (!stats) { return []; }

        const totalCodeFiles = Object.values(stats.codeStats.languages).reduce((a, b) => a + b, 0);
        const todoTotal = stats.codeStats.todos.reduce((a, b) => a + b.count, 0);
        const sizeMb = (stats.mediaStats.totalSize / (1024 * 1024)).toFixed(1);
        const langTotal = stats.codeStats.totalLines || 1;

        switch (element.label) {
            case 'Overview': {
                return [
                    new StatifyTreeItem('Code Files', totalCodeFiles.toLocaleString(), vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('symbol-file')),
                    new StatifyTreeItem('Lines of Code', stats.codeStats.totalLines.toLocaleString(), vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('symbol-ruler')),
                    new StatifyTreeItem('TODOs', String(todoTotal), vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('issues')),
                    new StatifyTreeItem('Media Files', String(stats.mediaStats.totalFiles), vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('file-media')),
                    new StatifyTreeItem('Total Size', `${sizeMb} MB`, vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('symbol-numeric')),
                ];
            }
            case 'Languages': {
                const langStats = Object.entries(stats.codeStats.languages)
                    .map(([lang, count]) => ({ lang, count, lines: stats.codeStats.langLines[lang] || 0 }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8);
                return langStats.map(l => {
                    const pct = (l.count / totalCodeFiles * 100).toFixed(0);
                    return new StatifyTreeItem(
                        l.lang.toUpperCase(),
                        `${l.count} files (${pct}%) · ${l.lines.toLocaleString()} lines`,
                        vscode.TreeItemCollapsibleState.None,
                    );
                });
            }
            case 'Top Folders': {
                const folderEntries = Object.entries(stats.codeStats.folders)
                    .map(([folder, files]) => ({ folder, files: files as number, lines: stats.codeStats.folderLines[folder] || 0 }))
                    .filter(f => f.files > 0)
                    .sort((a, b) => b.files - a.files)
                    .slice(0, 6);
                return folderEntries.map(f => {
                    const name = f.folder === '.' ? '(root)' : f.folder;
                    return new StatifyTreeItem(name, `${f.files} files · ${f.lines.toLocaleString()} lines`, vscode.TreeItemCollapsibleState.None);
                });
            }
            case 'Health': {
                return stats.health.factors.map(f => {
                    const color = f.color === 'green' ? '●' : f.color === 'yellow' ? '●' : '●';
                    return new StatifyTreeItem(
                        `${color} ${f.label}`,
                        `${f.score}/${f.max}`,
                        vscode.TreeItemCollapsibleState.None,
                    );
                });
            }
            case 'Git': {
                const items: StatifyTreeItem[] = [
                    new StatifyTreeItem('Branch', `⎇ ${stats.gitInfo.branch}`, vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('git-branch')),
                    new StatifyTreeItem('Last Commit', `"${stats.gitInfo.lastCommit.message}"`, vscode.TreeItemCollapsibleState.None),
                    new StatifyTreeItem('Commits This Week', String(stats.gitInfo.commitsThisWeek), vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('git-commit')),
                    new StatifyTreeItem('Contributors', String(stats.gitInfo.contributors.length), vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('organization')),
                    new StatifyTreeItem('Changed Files (500)', String(stats.gitInfo.mostChangedFiles.length), vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('file')),
                ];
                return items;
            }
            default:
                return [];
        }
    }
}
