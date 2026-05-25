import type { DailySave, HealthScore, ProjectStats } from './types';

export function calcHealthScore(stats: Omit<ProjectStats, 'health'>, commitActivityData: DailySave[]): HealthScore {
    const totalLines = stats.codeStats.totalLines || 1;
    const todoCount = stats.codeStats.todos.reduce((a, b) => a + b.count, 0);
    const totalCodeFiles = Object.values(stats.codeStats.languages).reduce((a, b) => a + b, 0) || 1;

    const todoPer100 = (todoCount / totalLines) * 100;
    const todoScore = Math.max(0, 25 - Math.round(todoPer100 * 10));

    const staleRatio = stats.staleFiles.length / totalCodeFiles;
    const staleScore = Math.max(0, Math.round(20 * (1 - staleRatio * 3)));

    const recentCommitDays = commitActivityData.filter(d => {
        const daysAgo = (Date.now() - new Date(d.date).getTime()) / 86400000;
        return daysAgo <= 30;
    }).length;
    const commitScore = Math.min(25, Math.round(recentCommitDays * 0.9));

    const recentActivity = stats.dailySaves.filter(d => {
        const daysAgo = (Date.now() - new Date(d.date).getTime()) / 86400000;
        return daysAgo <= 7;
    }).length;
    const activityScore = Math.min(20, recentActivity * 4);

    const avgFileLines = totalLines / totalCodeFiles;
    const sizeScore = avgFileLines < 200 ? 10 : avgFileLines < 500 ? 6 : avgFileLines < 1000 ? 3 : 0;

    const total = todoScore + staleScore + commitScore + activityScore + sizeScore;
    const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F';

    return {
        score: total,
        grade,
        factors: [
            { label: 'TODO Density', score: todoScore, max: 25, note: `${todoPer100.toFixed(2)} per 100 lines`, color: todoScore >= 18 ? 'green' : todoScore >= 10 ? 'yellow' : 'red' },
            { label: 'Fresh Files', score: staleScore, max: 20, note: `${stats.staleFiles.length} stale files`, color: staleScore >= 15 ? 'green' : staleScore >= 8 ? 'yellow' : 'red' },
            { label: 'Commit Frequency', score: commitScore, max: 25, note: `${recentCommitDays} active days (30d)`, color: commitScore >= 18 ? 'green' : commitScore >= 10 ? 'yellow' : 'red' },
            { label: 'Recent Activity', score: activityScore, max: 20, note: `${recentActivity} active days (7d)`, color: activityScore >= 14 ? 'green' : activityScore >= 8 ? 'yellow' : 'red' },
            { label: 'File Focus', score: sizeScore, max: 10, note: `avg ${Math.round(avgFileLines)} lines/file`, color: sizeScore >= 8 ? 'green' : sizeScore >= 4 ? 'yellow' : 'red' },
        ]
    };
}
