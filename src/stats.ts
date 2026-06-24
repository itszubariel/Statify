import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanFiles } from './scanner';
import { getGitInfo } from './git';
import { calcHealthScore } from './health';
import type { Dependencies, ProjectStats, ScanConfig } from './types';
import { DEFAULT_SCAN_CONFIG } from './types';

export function getScanConfig(): ScanConfig {
    const cfg = vscode.workspace.getConfiguration('statify.scan');
    const result: ScanConfig = { ...DEFAULT_SCAN_CONFIG };
    const patterns = cfg.get<string[]>('excludePatterns');
    if (patterns !== undefined) { result.excludePatterns = patterns; }
    const concurrency = cfg.get<number>('concurrency');
    if (concurrency !== undefined) { result.concurrency = concurrency; }
    const cc = cfg.get<number>('complexityConcurrency');
    if (cc !== undefined) { result.complexityConcurrency = cc; }
    const cfl = cfg.get<number>('complexityFileLimit');
    if (cfl !== undefined) { result.complexityFileLimit = cfl; }
    const sd = cfg.get<number>('staleDays');
    if (sd !== undefined) { result.staleDays = sd; }
    return result;
}

export function scanDependencies(root: string): Dependencies {
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

export async function gatherStats(root: string, config?: ScanConfig): Promise<ProjectStats> {
    const startTime = Date.now();
    const deps = scanDependencies(root);
    const { gitInfo, commitActivityData } = await getGitInfo(root);
    const scanned = await scanFiles(root, config);

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
