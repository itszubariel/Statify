import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

export function activate(context: vscode.ExtensionContext) {

    const dashboardCmd = vscode.commands.registerCommand('statify.openDashboard', async () => {

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showWarningMessage('Open a folder first!');
            return;
        }

        const rootPath = folders[0].uri.fsPath;
        const panel = vscode.window.createWebviewPanel(
            'statifyDashboard',
            'Statify — Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        
        // Add to panels tracking
        panels.set(rootPath, panel);
        
        panel.onDidDispose(() => {
            panels.delete(rootPath);
        });

        const stats = await gatherStats(rootPath);
        
// Track project snapshots (every scan, timestamp-based)
        const historyKey = `projectGrowth_${rootPath}`;
        let snapshots: Array<{timestamp: number; date: string; lines: number; files: number}> = context.workspaceState.get(historyKey) || [];
        
        // Prune old entries (>30 days or >100 entries)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        snapshots = snapshots.filter(s => s.timestamp > thirtyDaysAgo).slice(-100);
        
        // Add current snapshot
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];
        snapshots.push({
            timestamp: now,
            date: today,
            lines: stats.codeStats.totalLines,
            files: Object.values(stats.codeStats.languages).reduce((a: number, b: number) => a + b, 0)
        });
        
        await context.workspaceState.update(historyKey, snapshots);
        
        // Calculate growth since LAST scan
        const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
        const minutesAgo = previousSnapshot ? Math.round((now - previousSnapshot.timestamp) / 60000) : 0;
        const growth = {
            linesDelta: previousSnapshot ? stats.codeStats.totalLines - previousSnapshot.lines : 0,
            filesDelta: previousSnapshot ? stats.totalFiles - previousSnapshot.files : 0,
            minutesAgo,
            history: snapshots,
            snapshotCount: snapshots.length
        };

        panel.webview.html = getWebviewContent(stats, panel.webview, rootPath, growth);

        // Set up message handler
        panel.webview.onDidReceiveMessage(async msg => {
            if (msg.command === 'openFile') {
                const fileUri = vscode.Uri.file(msg.path);
                try {
                    const doc = await vscode.workspace.openTextDocument(fileUri);
                    await vscode.window.showTextDocument(doc, {
                        selection: new vscode.Range(msg.line, 0, msg.line, 0),
                        preview: false
                    });
                } catch (err: unknown) {
                    vscode.window.showErrorMessage(`Could not open file: ${msg.path}`);
                    console.error('Error opening file:', err);
                }
            } else if (msg.command === 'refresh') {
                const newStats = await gatherStats(rootPath);
                
// Update snapshots on refresh (same logic)
                const refreshNow = Date.now();
                let newSnapshots: Array<{timestamp: number; date: string; lines: number; files: number}> = context.workspaceState.get(historyKey) || [];
                
                // Prune old
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                newSnapshots = newSnapshots.filter(s => s.timestamp > thirtyDaysAgo).slice(-100);
                
                newSnapshots.push({
                    timestamp: refreshNow,
                    date: new Date().toISOString().split('T')[0],
                    lines: newStats.codeStats.totalLines,
            files: Object.values(newStats.codeStats.languages).reduce((a: number, b: number) => a + b, 0)
                });
                
                await context.workspaceState.update(historyKey, newSnapshots);
                
                const newPrevious = newSnapshots.length > 1 ? newSnapshots[newSnapshots.length - 2] : null;
                const newMinutesAgo = newPrevious ? Math.round((refreshNow - newPrevious.timestamp) / 60000) : 0;
                const newGrowth = {
                    linesDelta: newPrevious ? newStats.codeStats.totalLines - newPrevious.lines : 0,
                    filesDelta: newPrevious ? newStats.totalFiles - newPrevious.files : 0,
                    minutesAgo: newMinutesAgo,
                    history: newSnapshots,
                    snapshotCount: newSnapshots.length
                };
                
                panel.webview.html = getWebviewContent(newStats, panel.webview, rootPath, newGrowth);
            }
        });
    });

    // File watchers for real-time updates
    const panels = new Map<string, vscode.WebviewPanel>();
    
    const changeWatcher = vscode.workspace.onDidChangeTextDocument((e) => {
        panels.forEach((panel, root) => {
            // Debounced refresh (simple timeout)
            if (panel.visible) {
                panel.webview.postMessage({ command: 'refresh' });
            }
        });
    });
    
    const createWatcher = vscode.workspace.onDidCreateFiles(() => {
        panels.forEach((panel, root) => {
            if (panel.visible) {
                panel.webview.postMessage({ command: 'refresh' });
            }
        });
    });
    
    const deleteWatcher = vscode.workspace.onDidDeleteFiles(() => {
        panels.forEach((panel, root) => {
            if (panel.visible) {
                panel.webview.postMessage({ command: 'refresh' });
            }
        });
    });
    
    context.subscriptions.push(changeWatcher, createWatcher, deleteWatcher, dashboardCmd);
    
    // Track panels
    const onDispose = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        panels.clear();
    });
    context.subscriptions.push(onDispose);
}

export function deactivate() {
    // Cleanup
}

interface TodoItem { file: string; count: number; lines: number[]; }
interface FileItem { path: string; size: number; }

function isTextFile(filePath: string): boolean {
    try {
        // Skip very large files
        const stats = fs.statSync(filePath);
        if (stats.size > 5 * 1024 * 1024) return false;  // Reduced from 10MB

        const rawBytes = fs.readFileSync(filePath);
        
        // Quick binary checks
        if (rawBytes.includes(0)) return false;  // Null bytes
        if (rawBytes.length < 10) return true;
        
        // Sample first 8192 bytes
        const sampleSize = Math.min(8192, rawBytes.length);
        const sample = rawBytes.slice(0, sampleSize);
        
        let utf8Errors = 0;
        let validChars = 0;
        for (let i = 0; i < sample.length; i++) {
            const byte = sample[i];
            if (byte === 0) return false;
            if (byte >= 32 && byte <= 126) validChars++;
            // Count obvious binary patterns
            if (byte < 32 && byte !== 10 && byte !== 13) utf8Errors++;
        }
        
        const textRatio = validChars / sample.length;
        const errorRatio = utf8Errors / sample.length;
        
        return textRatio > 0.90 && errorRatio < 0.10;
    } catch {
        return false;
    }
}

async function gatherStats(root: string) {
    const startTime = Date.now();

    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
    let totalLines = 0;

    const mediaExts = ['png','jpg','jpeg','gif','mp4','mov','avi','webm','mp3','wav','ogg','bmp','ico','webp','svg','flv','mkv','flac','aac','m4a'];

    const codeStats = { totalLines:0, todos:[] as TodoItem[], biggest: null as FileItem | null, languages: {} as Record<string,number>, langLines: {} as Record<string,number>, folders: {} as Record<string,number> };
    const mediaStats = { totalFiles:0, totalSize:0, biggest: null as FileItem | null, files: [] as {path: string, size: number}[], topFiles: [] as {path: string, size: number}[] };

    const recentFiles: Array<{path: string; mtime: number}> = [];

    for (const file of files) {
        const relPath = vscode.workspace.asRelativePath(file.fsPath);
        const ext = path.extname(file.fsPath).replace('.', '').toLowerCase() || 'other';
        const folder = path.dirname(relPath);
        const s = fs.statSync(file.fsPath);
        if (!s.isFile()) continue;

        const isMedia = mediaExts.includes(ext);
        const isText = isTextFile(file.fsPath);

        if (isMedia) {
            mediaStats.totalFiles++;
            mediaStats.totalSize += s.size;
            const mediaFileItem = {path: relPath, size: s.size};
            mediaStats.files.push(mediaFileItem);
            if(!mediaStats.biggest || s.size>mediaStats.biggest.size) mediaStats.biggest = {path:relPath,size:s.size};
        } else if (isText) {
            let content = '';
            try { 
                content = fs.readFileSync(file.fsPath, 'utf-8'); 
            } catch {
                continue;
            }
            
            const lines = content.split('\n');
            codeStats.totalLines += lines.length;

            const todoLines:number[] = [];
            lines.forEach((l,i)=>{ if(l.match(/TODO|FIXME/)) todoLines.push(i); });
            if(todoLines.length) codeStats.todos.push({file:relPath,count:todoLines.length,lines:todoLines});

            codeStats.languages[ext] = (codeStats.languages[ext]||0)+1;
            codeStats.langLines[ext] = (codeStats.langLines[ext]||0) + lines.length;
            codeStats.folders[folder] = (codeStats.folders[folder]||0)+1;

            if(!codeStats.biggest || s.size>codeStats.biggest.size) codeStats.biggest = {path:relPath,size:s.size};
            
            const daysSinceModified = (Date.now() - s.mtimeMs) / (1000 * 60 * 60 * 24);
            if (daysSinceModified <= 30) {
                recentFiles.push({path: relPath, mtime: s.mtimeMs});
            }
        }
    }

    mediaStats.files.sort((a,b) => b.size - a.size);
    mediaStats.topFiles = mediaStats.files.slice(0,5);

    const mostEditedFiles = recentFiles
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 10)
        .map(f => ({ path: f.path, lastModified: new Date(f.mtime).toLocaleDateString() }));

    let gitInfo: any = { isRepo: false, branch: '', lastCommit: { message: '', time: '' }, commitsThisWeek: 0 };
    let commitActivityData: Array<{date: string; count: number}> = [];
    try {
        cp.execSync('git rev-parse --git-dir', { cwd: root, stdio: 'pipe' });
        gitInfo.isRepo = true;
        
        gitInfo.branch = cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString().trim();
        
        const lastCommitMsg = cp.execSync('git log -1 --pretty=format:%s', { cwd: root }).toString().trim();
        const lastCommitTime = cp.execSync('git log -1 --pretty=format:%ar', { cwd: root }).toString().trim();
        gitInfo.lastCommit = { message: lastCommitMsg, time: lastCommitTime };
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        const commitsThisWeek = cp.execSync(`git rev-list --count --since="${weekAgoStr}" HEAD`, { cwd: root }).toString().trim();
        gitInfo.commitsThisWeek = parseInt(commitsThisWeek) || 0;
        
        const commitLog = cp.execSync('git log --since="1 year ago" --pretty=format:%ad --date=format:%Y-%m-%d', { cwd: root }).toString();
        const commitCounts: Record<string,number> = {};
        commitLog.split('\n').filter(line => line.trim()).forEach(date => {
            commitCounts[date] = (commitCounts[date] || 0) + 1;
        });
        commitActivityData = Object.entries(commitCounts)
            .map(([date,count]) => ({date, count: Number(count)}))
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
        gitInfo.isRepo = false;
    }

    const dependencies: any = { total: 0, dev: 0, sources: [] };
    
    const packageJsonPath = path.join(root, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const deps = Object.keys(packageJson.dependencies || {}).length;
            const devDeps = Object.keys(packageJson.devDependencies || {}).length;
            dependencies.total += deps + devDeps;
            dependencies.dev += devDeps;
            dependencies.sources.push({ name: 'package.json', count: deps + devDeps, dev: devDeps });
        } catch {}
    }
    
    const requirementsPath = path.join(root, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
        try {
            const content = fs.readFileSync(requirementsPath, 'utf-8');
            const deps = content.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
            dependencies.total += deps;
            dependencies.sources.push({ name: 'requirements.txt', count: deps });
        } catch {}
    }
    
    const pomPath = path.join(root, 'pom.xml');
    if (fs.existsSync(pomPath)) {
        try {
            const content = fs.readFileSync(pomPath, 'utf-8');
            const deps = (content.match(/<dependency>/g) || []).length;
            dependencies.total += deps;
            dependencies.sources.push({ name: 'pom.xml', count: deps });
        } catch {}
    }
    
    const cargoPath = path.join(root, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
        try {
            const content = fs.readFileSync(cargoPath, 'utf-8');
            const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
            const devDepsMatch = content.match(/\[dev-dependencies\]([\s\S]*?)(\[|$)/);
            const deps = depsMatch ? depsMatch[1].split('\n').filter(line => line.trim() && !line.startsWith('#')).length : 0;
            const devDeps = devDepsMatch ? devDepsMatch[1].split('\n').filter(line => line.trim() && !line.startsWith('#')).length : 0;
            dependencies.total += deps + devDeps;
            dependencies.dev += devDeps;
            dependencies.sources.push({ name: 'Cargo.toml', count: deps + devDeps, dev: devDeps });
        } catch {}
    }

    interface DailySave { date: string; count: number; }
    let dailySaves: DailySave[] = [];
    let totalEdits = 0;
    let lastModified = '';
    
    try {
        const dateCounts: Record<string,number> = {};
        let mostRecentMtime = 0;
        let mostRecentFile = '';
        
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        
        for (const file of files) {
            const stats = fs.statSync(file.fsPath);
            if (!stats.isFile()) continue;
            
            if (!isTextFile(file.fsPath)) continue;
            
            const mtime = stats.mtimeMs;
            
            if (mtime < oneYearAgo) continue;
            
            totalEdits++;
            const dateStr = new Date(mtime).toISOString().split('T')[0];
            
            dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
            
            if (mtime > mostRecentMtime) {
                mostRecentMtime = mtime;
                mostRecentFile = vscode.workspace.asRelativePath(file.fsPath);
            }
        }
        
        lastModified = mostRecentFile ? `${mostRecentFile} (${new Date(mostRecentMtime).toLocaleDateString()})` : 'N/A';
        
        dailySaves = Object.entries(dateCounts)
            .map(([date,count]) => ({date, count: Number(count)}))
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
        console.log('Error tracking file modifications:', e);
    }

    const codeTopFiles: FileItem[] = files
        .filter(f => {
            const stats = fs.statSync(f.fsPath);
            return stats.isFile() && isTextFile(f.fsPath);
        })
        .map(f => ({ path: vscode.workspace.asRelativePath(f.fsPath), size: fs.statSync(f.fsPath).size }))
        .sort((a,b)=>b.size-a.size)
        .slice(0,7);

    const scanTime = Date.now() - startTime;
    const performance = {
        scanTime,
        filesScanned: files.length,
        lastRefresh: new Date().toLocaleTimeString()
    };

    return { 
        codeStats, 
        mediaStats, 
        totalFiles: files.length, 
        codeTopFiles, 
        totalEdits, 
        lastModified, 
        dailySaves, 
        mostEditedFiles,
        gitInfo,
        commitActivityData,
        dependencies,
        performance
    };
}

function getWebviewContent(stats: any, webview: vscode.Webview, root: string, growth: any) {
    const { codeStats, mediaStats, codeTopFiles, totalEdits, lastModified, dailySaves, mostEditedFiles, gitInfo, commitActivityData, dependencies, performance } = stats;
    const langLabels = Object.keys(codeStats.languages);
    const langTotal = codeStats.totalLines;
    
    const langStats = langLabels.map(l => ({
        lang: l,
        lines: codeStats.langLines[l as keyof typeof codeStats.langLines] as number || 0,
        percent: (((codeStats.langLines[l as keyof typeof codeStats.langLines] as number || 0) / langTotal) * 100)
    })).sort((a,b) => b.lines - a.lines);

    const langColors: Record<string, string> = {
        'ts': '#3178c6', 'tsx': '#3178c6', 'js': '#f1e05a', 'jsx': '#f1e05a',
        'py': '#3572A5', 'java': '#b07219', 'c': '#555555', 'cpp': '#f34b7d',
        'cs': '#178600', 'html': '#e34c26', 'css': '#563d7c', 'scss': '#c6538c',
        'json': '#292929', 'md': '#083fa1', 'other': '#858585', 'go': '#00ADD8',
        'rs': '#dea584', 'rb': '#701516', 'php': '#4F5D95', 'swift': '#ffac45',
        'kt': '#F18E33', 'scala': '#c22d40', 'gradle': '#02303a'
    };

    function getLangColor(lang: string): string {
        // Language-inspired hash colors
        let hash = 0;
        for (let i = 0; i < lang.length; i++) {
            hash = lang.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = (hash % 360);
        return `hsl(${hue}, 60%, 55%)`;
    }

    const topLangs = langStats.slice(0, 5);
    const otherLangs = langStats.slice(5);
    const langBarsHTML = topLangs.map(l => {
        const color = langColors[l.lang] || getLangColor(l.lang);
        return `
        <div class="lang-item">
            <div class="lang-info">
                <span class="lang-dot" style="background-color: ${color}"></span>
                <span class="lang-name">${l.lang.toUpperCase()}</span>
                <span class="lang-percent">${l.percent.toFixed(1)}%</span>
            </div>
            <div class="lang-bar-container">
                <div class="lang-bar" style="width: ${l.percent}%; background-color: ${color}"></div>
            </div>
        </div>`;
    }).join('') + (otherLangs.length ? `
        <div class="lang-item" id="more-langs" style="display: none;">
            ${otherLangs.map(l => {
                const color = langColors[l.lang] || getLangColor(l.lang);
                return `
            <div class="lang-item">
                <div class="lang-info">
                    <span class="lang-dot" style="background-color: ${color}"></span>
                    <span class="lang-name">${l.lang.toUpperCase()}</span>
                    <span class="lang-percent">${l.percent.toFixed(1)}%</span>
                </div>
                <div class="lang-bar-container">
                    <div class="lang-bar" style="width: ${l.percent}%; background-color: ${color}"></div>
                </div>
            </div>`;
            }).join('')}
        </div>
        <button onclick="toggleLanguages()" id="lang-toggle" style="width: 100%; margin-top: 12px; padding: 8px; background: #21262d; border: 1px solid #30363d; color: #58a6ff; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">+ Show ${otherLangs.length} more languages</button>` : '');

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (dailySaves.length > 0) {
        const saveDates = dailySaves.map((s: {date: string; count: number}) => new Date(s.date).getTime()).sort((a: number, b: number) => b - a);
        
        let checkDate = new Date(today);
        for (let i = 0; i < 365; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (dailySaves.find((s: {date: string; count: number}) => s.date === dateStr)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        for (let i = 0; i < saveDates.length; i++) {
            if (i === 0 || saveDates[i-1] - saveDates[i] <= 86400000) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else {
                tempStreak = 1;
            }
        }
    }

    let currentCommitStreak = 0;
    let longestCommitStreak = 0;
    let tempCommitStreak = 0;
    
    if (commitActivityData.length > 0) {
        const commitDates = commitActivityData.map((s: {date: string; count: number}) => new Date(s.date).getTime()).sort((a: number, b: number) => b - a);
        
        let checkCommitDate = new Date(today);
        for (let i = 0; i < 365; i++) {
            const dateStr = checkCommitDate.toISOString().split('T')[0];
            if (commitActivityData.find((s: {date: string; count: number}) => s.date === dateStr)) {
                currentCommitStreak++;
                checkCommitDate.setDate(checkCommitDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        for (let i = 0; i < commitDates.length; i++) {
            if (i === 0 || commitDates[i-1] - commitDates[i] <= 86400000) {
                tempCommitStreak++;
                longestCommitStreak = Math.max(longestCommitStreak, tempCommitStreak);
            } else {
                tempCommitStreak = 1;
            }
        }
    }

    const recentActivityHTML = mostEditedFiles.slice(0, 10).map((f: any) => {
        const fullPath = path.join(root, f.path);
        return `<div class="list-item" onclick="openFile('${fullPath.replace(/\\/g, '\\\\')}', 0)">
            <svg class="file-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm.256 7a4.474 4.474 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10c.26 0 .507.009.74.025.226-.341.496-.65.804-.918C9.077 9.038 8.564 9 8 9c-5 0-6 3-6 4s1 1 1 1h5.256Z"/><path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm1.679-4.493-1.335 2.226a.75.75 0 0 1-1.174.144l-.774-.773a.5.5 0 0 1 .708-.708l.547.548 1.17-1.951a.5.5 0 1 1 .858.514Z"/></svg>
            <span class="file-name">${f.path}</span>
            <span class="file-size">${f.lastModified}</span>
        </div>`;
    }).join('') || '<div class="empty-state">No recent edits</div>';

    const topFilesHTML = codeTopFiles.slice(0, 10).map((f: FileItem) => {
        const fullPath = path.join(root, f.path);
        return `<div class="list-item" onclick="openFile('${fullPath.replace(/\\/g, '\\\\')}', 0)">
            <svg class="file-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 3.5a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-11zm2-2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7zM0 13a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 13V6a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 0 6v7zm1.5.5A.5.5 0 0 1 1 13V6a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-13z"/></svg>
            <span class="file-name">${f.path}</span>
            <span class="file-size">${(f.size/1024).toFixed(1)} KB</span>
        </div>`;
    }).join('');

    const mediaFilesHTML = mediaStats.topFiles.slice(0, 10).map((f: FileItem) => 
        `<div class="list-item">
            <svg class="file-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg>
            <span class="file-name">${f.path}</span>
            <span class="file-size">${(f.size/1024).toFixed(1)} KB</span>
        </div>`
    ).join('') || '<div class="empty-state">No media files</div>';

    const weeksToShow = 12;
    const saveHeatmapHTML = generateHeatmap(dailySaves, weeksToShow);
    const commitHeatmapHTML = generateHeatmap(commitActivityData, weeksToShow);
    
    const dualHeatmapHTML = `
    <div style="display: flex; gap: 32px;">
        <div style="flex: 1;">
            <div style="font-size: 0.8rem; color: #8b949e; margin-bottom: 8px;">File Saves</div>
            ${saveHeatmapHTML}
        </div>
        <div style="flex: 1;">
            <div style="font-size: 0.8rem; color: #8b949e; margin-bottom: 8px;">Git Commits</div>
            ${commitHeatmapHTML}
        </div>
    </div>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Statify Dashboard</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
    background: #0d1117;
    color: #c9d1d9;
    padding: 24px;
    line-height: 1.6;
}

.header {
    margin-bottom: 32px;
    text-align: center;
}

.header h1 {
    font-size: 2rem;
    font-weight: 600;
    color: #58a6ff;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
}

.header p {
    color: #8b949e;
    font-size: 0.9rem;
}

.refresh-btn {
    background: #21262d;
    border: 1px solid #30363d;
    color: #8b949e;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
}

.refresh-btn svg {
    width: 16px;
    height: 16px;
}

.refresh-btn:hover {
    background: #30363d;
    border-color: #58a6ff;
    color: #58a6ff;
    transform: rotate(180deg);
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
}

.card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
    border-color: #58a6ff;
    box-shadow: 0 0 0 1px #58a6ff;
    transform: scale(1.02);
}

.card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #8b949e;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.stat-item {
    display: flex;
    flex-direction: column;
}

.stat-label {
    font-size: 0.75rem;
    color: #8b949e;
    margin-bottom: 4px;
}

.stat-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: #58a6ff;
}

.stat-value.green { color: #3fb950; }
.stat-value.orange { color: #d29922; }
.stat-value.purple { color: #bc8cff; }

.lang-item {
    margin-bottom: 12px;
}

.lang-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 0.875rem;
}

.lang-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
}

.lang-name {
    flex: 1;
    font-weight: 500;
}

.lang-percent {
    color: #8b949e;
    font-size: 0.75rem;
}

.lang-bar-container {
    height: 8px;
    background: #21262d;
    border-radius: 4px;
    overflow: hidden;
}

.lang-bar {
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 4px;
}

.streak-container {
    display: flex;
    justify-content: space-around;
    text-align: center;
}

.streak-item {
    flex: 1;
}

.streak-value {
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, #58a6ff 0%, #bc8cff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.streak-label {
    font-size: 0.75rem;
    color: #8b949e;
    margin-top: 4px;
}

.heatmap {
    display: flex;
    gap: 3px;
    overflow-x: auto;
    padding: 8px 0;
}

.heatmap-week {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.heatmap-day {
    width: 11px;
    height: 11px;
    background: #161b22;
    border-radius: 2px;
    border: 1px solid #30363d;
    cursor: pointer;
    transition: transform 0.2s;
    position: relative;
}

.heatmap-day:hover {
    transform: scale(1.5);
    z-index: 10;
    border-color: #58a6ff;
}

.heatmap-day.level-1 { background: #0e4429; }
.heatmap-day.level-2 { background: #006d32; }
.heatmap-day.level-3 { background: #26a641; }
.heatmap-day.level-4 { background: #39d353; }

.list-container {
    max-height: 300px;
    overflow-y: auto;
}

.list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
}

.list-item:hover {
    background: #21262d;
}

.file-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: #8b949e;
}

.file-name {
    flex: 1;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-count, .file-size {
    font-size: 0.75rem;
    color: #8b949e;
    background: #21262d;
    padding: 2px 8px;
    border-radius: 12px;
}

.empty-state {
    text-align: center;
    color: #6e7681;
    padding: 24px;
    font-size: 0.875rem;
}

.wide-card {
    grid-column: 1 / -1;
}

::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: #161b22;
}

::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: #484f58;
}

@media (max-width: 768px) {
    .stat-grid {
        grid-template-columns: 1fr;
    }
    
    .grid {
        grid-template-columns: 1fr;
    }
}
</style>
</head>
<body>

<div class="header">
    <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
        <h1 style="margin: 0;">
            <svg style="width: 32px; height: 32px; display: inline-block; vertical-align: middle; margin-right: 8px;" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
            </svg>
            Statify Statistics
        </h1>
        <button onclick="refreshStats()" class="refresh-btn" title="Refresh Statistics">
            <svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
        </button>
    </div>
    <p>Comprehensive overview of your codebase</p>
</div>

<div class="grid">
    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
            Overview
        </div>
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-label">Total Files</div>
                <div class="stat-value">${(Object.values(codeStats.languages) as number[]).reduce((a,b)=>a+b,0)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Lines of Code</div>
                <div class="stat-value green">${codeStats.totalLines.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">TODO Items</div>
                <div class="stat-value orange">${codeStats.todos.reduce((a:any,b:any)=>a+b.count,0)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">File Edits</div>
                <div class="stat-value purple">${totalEdits || '0'}</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M8.05 1.5a4.5 4.5 0 0 1 2.828 8L8 12.328 5.122 9.5A4.5 4.5 0 1 1 8.05 1.5zm-1.414 6.586a.5.5 0 0 1 .707 0L8 8.743l.707-.707a.5.5 0 0 1 .707.707L8.707 9.45a.5.5 0 0 1-.707 0L7.293 8.743a.5.5 0 0 1 0-.707z"/></svg>
            File Saves Streak
        </div>
        <div class="streak-container">
            <div class="streak-item">
                <div class="streak-value">${currentStreak}</div>
                <div class="streak-label">Current</div>
            </div>
            <div class="streak-item">
                <div class="streak-value">${longestStreak}</div>
                <div class="streak-label">Longest</div>
            </div>
            <div class="streak-item">
                <div class="streak-value">${dailySaves.length}</div>
                <div class="streak-label">Active Days</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5Z"/></svg>
            Git Commits Streak
        </div>
        <div class="streak-container">
            <div class="streak-item">
                <div class="streak-value">${currentCommitStreak || 0}</div>
                <div class="streak-label">Current</div>
            </div>
            <div class="streak-item">
                <div class="streak-value">${longestCommitStreak || 0}</div>
                <div class="streak-label">Longest</div>
            </div>
            <div class="streak-item">
                <div class="streak-value">${commitActivityData.length}</div>
                <div class="streak-label">Active Days</div>
            </div>
        </div>
    </div>

    <div class="card wide-card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/><path d="M1.713 11.865v-.474H2c.217 0 .363-.137.363-.317 0-.185-.158-.31-.361-.31-.223 0-.367.152-.373.31h-.59c.016-.467.373-.787.986-.787.588-.002.954.291.957.703a.595.595 0 0 1-.492.594v.033a.615.615 0 0 1 .569.631c.003.533-.502.8-1.051.8-.656 0-1-.37-1.008-.794h.582c.008.178.186.306.422.309.254 0 .424-.145.422-.35-.002-.195-.155-.348-.414-.348h-.3zm-.004-4.699h-.604v-.035c0-.408.295-.844.958-.844.583 0 .96.326.96.756 0 .389-.257.617-.476.848l-.537.572v.03h1.054V9H1.143v-.395l.957-.99c.138-.142.293-.304.293-.508 0-.18-.147-.32-.342-.32a.33.33 0 0 0-.342.338v.041z"/></svg>
            Most Used Languages
        </div>
        ${langBarsHTML}
    </div>

    <div class="card wide-card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>
            Activity (Last ${weeksToShow} Weeks)
        </div>
${dualHeatmapHTML}
    </div>

    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>
            Recently Edited
        </div>
        <div class="list-container">
            ${recentActivityHTML}
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>
            Performance
        </div>
        <div class="stat-grid" style="grid-template-columns: 1fr;">
            <div class="stat-item">
                <div class="stat-label">Scan Time</div>
                <div class="stat-value" style="font-size: 1.2rem;">${performance.scanTime}ms</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Files Scanned</div>
                <div class="stat-value" style="font-size: 1.2rem;">${performance.filesScanned.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Last Refresh</div>
                <div class="stat-value" style="font-size: 1.2rem; color: #8b949e;">${performance.lastRefresh}</div>
            </div>
        </div>
    </div>

        ${gitInfo.isRepo ? `
        <div class="card">
            <div class="card-title">
                <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5Z"/></svg>
                Git Repository
            </div>
            <div class="stat-grid" style="grid-template-columns: 1fr;">
                <div class="stat-item">
                    <div class="stat-label">Branch</div>
                    <div class="stat-value" style="font-size: 1rem; color: #58a6ff;">${gitInfo.branch}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Last Commit</div>
                    <div style="font-size: 0.875rem; color: #c9d1d9; margin-top: 4px;">${gitInfo.lastCommit.message}</div>
                    <div style="font-size: 0.75rem; color: #8b949e; margin-top: 2px;">${gitInfo.lastCommit.time}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">This Week</div>
                    <div class="stat-value" style="font-size: 1.2rem; color: #3fb950;">${gitInfo.commitsThisWeek} commits</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${dependencies.total > 0 ? `
        <div class="card">
            <div class="card-title">
                <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/><path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/></svg>
                Dependencies
            </div>
            <div class="stat-item" style="margin-bottom: 12px;">
                <div class="stat-label">Total Dependencies</div>
                <div class="stat-value">${dependencies.total}</div>
                ${dependencies.dev > 0 ? `<div style="font-size: 0.75rem; color: #8b949e; margin-top: 4px;">${dependencies.dev} dev dependencies</div>` : ''}
            </div>
            ${dependencies.sources.map((src: any) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-top: 1px solid #21262d;">
                    <span style="font-size: 0.875rem; color: #c9d1d9;">${src.name}</span>
                    <span style="font-size: 0.875rem; color: #58a6ff;">${src.count}</span>
                </div>
            `).join('')}
        </div>
        ` : ''}

    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M0 0h1v15h15v1H0V0Zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07Z"/></svg>
            Project Growth
        </div>
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-label">Since Last Scan</div>
                <div class="stat-value" style="font-size: 1rem; color: ${growth.linesDelta >= 0 ? '#3fb950' : '#f85149'};">
                    ${growth.linesDelta >= 0 ? '+' : ''}${growth.linesDelta} lines
                </div>
                <div style="font-size: 0.75rem; color: #8b949e; margin-top: 2px;">
                    ${growth.filesDelta >= 0 ? '+' : ''}${growth.filesDelta} files
                </div>
            </div>
            <div class="stat-item">
        <div class="stat-label">Tracking</div>
                <div class="stat-value" style="font-size: 1rem; color: #8b949e;">${growth.snapshotCount} scans</div>
                <div style="font-size: 0.75rem; color: #6e7681;">(${growth.minutesAgo} min ago)</div>
            </div>
        </div>
        <div style="margin-top: 12px;">
            <canvas id="growthChart" style="max-height: 100px;"></canvas>
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 3.5a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-11zm2-2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7zM0 13a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 13V6a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 0 6v7zm1.5.5A.5.5 0 0 1 1 13V6a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-13z"/></svg>
            Largest Files
        </div>
        <div class="list-container">
            ${topFilesHTML}
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" viewBox="0 0 16 16" fill="currentColor"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg>
            Media Assets
        </div>
        <div class="stat-item" style="margin-bottom: 16px;">
            <div class="stat-label">Total Size</div>
            <div class="stat-value" style="font-size: 1.2rem;">${(mediaStats.totalSize/1024/1024).toFixed(2)} MB</div>
        </div>
        <div class="list-container">
            ${mediaFilesHTML}
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
const vscodeApi = acquireVsCodeApi();

function openFile(file, line) {
    vscodeApi.postMessage({ command: 'openFile', path: file, line: line });
}

let showMoreLangs = false;

function toggleLanguages() {
    const moreLangs = document.getElementById('more-langs');
    const toggleBtn = document.getElementById('lang-toggle');
    showMoreLangs = !showMoreLangs;
    
    if (moreLangs) {
        moreLangs.style.display = showMoreLangs ? 'block' : 'none';
    }
    
    if (toggleBtn) {
        toggleBtn.textContent = showMoreLangs ? '− Hide extra languages' : '+ Show more languages';
    }
}

function refreshStats() {
    vscodeApi.postMessage({ command: 'refresh' });
}

window.addEventListener('DOMContentLoaded', () => {
    const growthCanvas = document.getElementById('growthChart');
    if (growthCanvas) {
        const growthHistory = ${JSON.stringify(growth.history)};
        const labels = growthHistory.map(h => {
            const date = new Date(h.date);
            return (date.getMonth() + 1) + '/' + date.getDate();
        });
        const linesData = growthHistory.map(h => h.lines);
        
        new Chart(growthCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Lines of Code',
                    data: linesData,
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#161b22',
                        titleColor: '#c9d1d9',
                        bodyColor: '#c9d1d9',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        padding: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toLocaleString() + ' lines';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8b949e',
                            font: {
                                size: 10
                            },
                            maxRotation: 0
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8b949e',
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return value >= 1000 ? (value / 1000).toFixed(1) + 'K' : value;
                            }
                        }
                    }
                }
            }
        });
    }
});
</script>

</body>
</html>
`;
}

function generateHeatmap(dailySaves: Array<{date: string; count: number}>, weeks: number): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (weeks * 7));
    
    const saveMap = new Map(dailySaves.map(s => [s.date, s.count]));
    
    let html = '<div class="heatmap">';
    
    for (let w = 0; w < weeks; w++) {
        html += '<div class="heatmap-week">';
        for (let d = 0; d < 7; d++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (w * 7) + d);
            
            if (currentDate > today) {
                html += '<div class="heatmap-day" style="opacity: 0.3;"></div>';
                continue;
            }
            
            const dateStr = currentDate.toISOString().split('T')[0];
            const count = saveMap.get(dateStr) || 0;
            
            let level = 0;
            if (count > 0) level = 1;
            if (count >= 3) level = 2;
            if (count >= 6) level = 3;
            if (count >= 10) level = 4;
            
            html += `<div class="heatmap-day level-${level}" title="${dateStr}: ${count} activities"></div>`;
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}