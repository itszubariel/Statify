import * as cp from 'child_process';
import { promisify } from 'util';
import type { Contributor, DailySave, GitInfo } from './types';

const execAsync = promisify(cp.exec);

export async function getGitInfo(root: string): Promise<{ gitInfo: GitInfo; commitActivityData: DailySave[] }> {
    console.log('[Statify] getGitInfo started');
    let gitInfo: GitInfo = { isRepo: false, branch: '', lastCommit: { message: '', time: '' }, commitsThisWeek: 0, contributors: [], mostChangedFiles: [] };
    let commitActivityData: DailySave[] = [];

    try {
        console.log('[Statify] Checking if directory is Git repository...');
        await execAsync('git --no-pager rev-parse --git-dir', { cwd: root, timeout: 1500 });
        gitInfo.isRepo = true;
        console.log('[Statify] Directory is Git repository. Running git commands in parallel...');

        const safeExec = async (cmd: string, timeout = 3000) => {
            try {
                return await execAsync(cmd, { cwd: root, timeout });
            } catch (e) {
                console.log(`[Statify] Git command failed: ${cmd}`, e);
                return { stdout: '', stderr: '' };
            }
        };

        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const [branchOut, lastMsgOut, lastTimeOut, countOut, logOut, shortlogOut, changedOut] = await Promise.all([
            safeExec('git --no-pager rev-parse --abbrev-ref HEAD', 3000),
            safeExec('git --no-pager log -1 --pretty=format:%s', 3000),
            safeExec('git --no-pager log -1 --pretty=format:%ar', 3000),
            safeExec(`git --no-pager rev-list --count --since="${weekAgo.toISOString().split('T')[0]}" HEAD`, 3000),
            safeExec('git --no-pager log --since="1 year ago" --pretty=format:%ad --date=format:%Y-%m-%d', 3000),
            safeExec('git --no-pager shortlog -sn --no-merges -100', 3000),
            safeExec('git --no-pager log --name-only --pretty=format: -500', 3000)
        ]);

        console.log('[Statify] Parallel git commands finished. Parsing outputs...');

        gitInfo.branch = branchOut.stdout.trim();
        gitInfo.lastCommit = {
            message: lastMsgOut.stdout.trim(),
            time: lastTimeOut.stdout.trim()
        };
        gitInfo.commitsThisWeek = parseInt(countOut.stdout.trim(), 10) || 0;

        const commitCounts: Record<string, number> = {};
        if (logOut.stdout) {
            logOut.stdout.split('\n').filter(l => l.trim())
                .forEach(date => { commitCounts[date] = (commitCounts[date] || 0) + 1; });
        }
        commitActivityData = Object.entries(commitCounts)
            .map(([date, count]) => ({ date, count: Number(count) }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (shortlogOut.stdout) {
            gitInfo.contributors = shortlogOut.stdout.trim().split('\n')
                .filter(l => l.trim())
                .slice(0, 8)
                .map(l => {
                    const m = l.trim().match(/^(\d+)\s+(.+)$/);
                    return m ? { commits: parseInt(m[1], 10), name: m[2].trim() } : null;
                })
                .filter((c): c is Contributor => c !== null);
        }

        if (changedOut.stdout) {
            const fileCounts: Record<string, number> = {};
            changedOut.stdout.split('\n').filter(l => l.trim()).forEach(f => { fileCounts[f] = (fileCounts[f] || 0) + 1; });
            gitInfo.mostChangedFiles = Object.entries(fileCounts)
                .map(([p, changes]) => ({ path: p, changes }))
                .sort((a, b) => b.changes - a.changes)
                .slice(0, 10);
        }

        console.log('[Statify] Git info parsing completed successfully');
    } catch (e) {
        console.log('[Statify] Git info check failed:', e);
        gitInfo.isRepo = false;
    }

    return { gitInfo, commitActivityData };
}
