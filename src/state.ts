import * as vscode from 'vscode';
import type { Growth, ProjectStats, Snapshot } from './types';

export function calcStreaks(data: { date: string; count: number }[]): { current: number; longest: number } {
    if (!data.length) { return { current: 0, longest: 0 }; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let current = 0;
    const checkDate = new Date(today);
    for (let i = 0; i < 365; i++) {
        const ds = checkDate.toISOString().split('T')[0];
        if (data.find(s => s.date === ds)) { current++; checkDate.setDate(checkDate.getDate() - 1); }
        else { break; }
    }
    const dates = data.map(s => new Date(s.date).getTime()).sort((a, b) => b - a);
    let longest = 0, temp = 0;
    for (let i = 0; i < dates.length; i++) {
        if (i === 0 || dates[i - 1] - dates[i] <= 86400000) { temp++; longest = Math.max(longest, temp); }
        else { temp = 1; }
    }
    return { current, longest };
}

export function generateHeatmap(data: { date: string; count: number }[], weeks: number): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - weeks * 7);
    const saveMap = new Map(data.map(s => [s.date, s.count]));
    let html = '<div class="heatmap">';
    for (let w = 0; w < weeks; w++) {
        html += '<div class="heatmap-week">';
        for (let d = 0; d < 7; d++) {
            const cur = new Date(startDate);
            cur.setDate(startDate.getDate() + w * 7 + d);
            if (cur > today) { html += '<div class="heatmap-day" style="opacity:0.25;"></div>'; continue; }
            const ds = cur.toISOString().split('T')[0];
            const count = saveMap.get(ds) || 0;
            let level = 0;
            if (count >= 1) { level = 1; } if (count >= 3) { level = 2; } if (count >= 6) { level = 3; } if (count >= 10) { level = 4; }
            html += `<div class="heatmap-day ${level > 0 ? `l${level}` : ''}" title="${ds}: ${count}"></div>`;
        }
        html += '</div>';
    }
    return html + '</div>';
}

export async function calcGrowth(workspaceState: vscode.Memento, rootPath: string, stats: ProjectStats): Promise<Growth> {
    const historyKey = `projectGrowth_${rootPath}`;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let snapshots: Snapshot[] = workspaceState.get<Snapshot[]>(historyKey) || [];
    snapshots = snapshots.filter(s => s.timestamp > Date.now() - thirtyDaysMs).slice(-100);

    const now = Date.now();
    const totalCodeFiles = Object.values(stats.codeStats.languages).reduce((a, b) => a + b, 0);

    const prev = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

    const todayStr = new Date().toISOString().split('T')[0];
    const existingIndex = snapshots.findIndex(s => s.date === todayStr);
    const newSnapshot = { timestamp: now, date: todayStr, lines: stats.codeStats.totalLines, files: totalCodeFiles };

    if (existingIndex !== -1) {
        snapshots[existingIndex] = newSnapshot;
    } else {
        snapshots.push(newSnapshot);
    }
    await workspaceState.update(historyKey, snapshots);

    return {
        linesDelta: prev ? stats.codeStats.totalLines - prev.lines : 0,
        filesDelta: prev ? totalCodeFiles - prev.files : 0,
        minutesAgo: prev ? Math.round((now - prev.timestamp) / 60000) : 0,
        history: snapshots,
        snapshotCount: snapshots.length
    };
}
