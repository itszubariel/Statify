import * as cp from 'child_process';
import type { Contributor, ChangedFile, DailySave, GitInfo } from './types';

export function getGitInfo(root: string): { gitInfo: GitInfo; commitActivityData: DailySave[] } {
    let gitInfo: GitInfo = { isRepo: false, branch: '', lastCommit: { message: '', time: '' }, commitsThisWeek: 0, contributors: [], mostChangedFiles: [] };
    let commitActivityData: DailySave[] = [];

    try {
        cp.execSync('git rev-parse --git-dir', { cwd: root, stdio: 'pipe' });
        gitInfo.isRepo = true;
        gitInfo.branch = cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, stdio: 'pipe' }).toString().trim();
        gitInfo.lastCommit = {
            message: cp.execSync('git log -1 --pretty=format:%s', { cwd: root, stdio: 'pipe' }).toString().trim(),
            time: cp.execSync('git log -1 --pretty=format:%ar', { cwd: root, stdio: 'pipe' }).toString().trim()
        };
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        gitInfo.commitsThisWeek = parseInt(cp.execSync(`git rev-list --count --since="${weekAgo.toISOString().split('T')[0]}" HEAD`, { cwd: root, stdio: 'pipe' }).toString().trim(), 10) || 0;

        const commitCounts: Record<string, number> = {};
        cp.execSync('git log --since="1 year ago" --pretty=format:%ad --date=format:%Y-%m-%d', { cwd: root, stdio: 'pipe' })
            .toString().split('\n').filter(l => l.trim())
            .forEach(date => { commitCounts[date] = (commitCounts[date] || 0) + 1; });
        commitActivityData = Object.entries(commitCounts)
            .map(([date, count]) => ({ date, count: Number(count) }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const contribRaw = cp.execSync('git shortlog -sn --no-merges -100', { cwd: root, stdio: 'pipe' }).toString().trim();
        gitInfo.contributors = contribRaw.split('\n')
            .filter(l => l.trim())
            .slice(0, 8)
            .map(l => {
                const m = l.trim().match(/^(\d+)\s+(.+)$/);
                return m ? { commits: parseInt(m[1], 10), name: m[2].trim() } : null;
            })
            .filter((c): c is Contributor => c !== null);

        const changedRaw = cp.execSync('git log --name-only --pretty=format: -500', { cwd: root, stdio: 'pipe' }).toString();
        const fileCounts: Record<string, number> = {};
        changedRaw.split('\n').filter(l => l.trim()).forEach(f => { fileCounts[f] = (fileCounts[f] || 0) + 1; });
        gitInfo.mostChangedFiles = Object.entries(fileCounts)
            .map(([p, changes]) => ({ path: p, changes }))
            .sort((a, b) => b.changes - a.changes)
            .slice(0, 10);
    } catch { gitInfo.isRepo = false; }

    return { gitInfo, commitActivityData };
}
