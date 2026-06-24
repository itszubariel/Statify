export interface Snapshot { timestamp: number; date: string; lines: number; files: number; }

export interface TodoItem { file: string; count: number; lines: number[]; }

export interface FileItem { path: string; size: number; }

export interface DailySave { date: string; count: number; }

export interface DepSource { name: string; count: number; dev?: number; }

export interface StaleFile { path: string; daysSince: number; size: number; }

export interface Contributor { name: string; commits: number; }

export interface ChangedFile { path: string; changes: number; }

export interface CodeStats {
    totalLines: number;
    todos: TodoItem[];
    biggest: FileItem | null;
    languages: Record<string, number>;
    langLines: Record<string, number>;
    folders: Record<string, number>;
    folderLines: Record<string, number>;
}

export interface MediaStats {
    totalFiles: number;
    totalSize: number;
    biggest: FileItem | null;
    files: FileItem[];
    topFiles: FileItem[];
}

export interface GitInfo {
    isRepo: boolean;
    branch: string;
    lastCommit: { message: string; time: string };
    commitsThisWeek: number;
    contributors: Contributor[];
    mostChangedFiles: ChangedFile[];
}

export interface Dependencies {
    total: number;
    dev: number;
    sources: DepSource[];
}

export interface HealthScore {
    score: number;
    grade: string;
    factors: Array<{ label: string; score: number; max: number; note: string; color: string }>;
}

export interface ComplexityFile {
    path: string;
    functions: number;
    classes: number;
    longLinePct: number;
}

export interface ComplexityInfo {
    totalFunctions: number;
    totalClasses: number;
    topFiles: ComplexityFile[];
}

export interface ProjectStats {
    codeStats: CodeStats;
    mediaStats: MediaStats;
    complexity: ComplexityInfo;
    totalFiles: number;
    codeTopFiles: FileItem[];
    totalEdits: number;
    lastModified: string;
    dailySaves: DailySave[];
    mostEditedFiles: Array<{ path: string; lastModified: string }>;
    staleFiles: StaleFile[];
    gitInfo: GitInfo;
    commitActivityData: DailySave[];
    dependencies: Dependencies;
    health: HealthScore;
    performance: { scanTime: number; filesScanned: number; lastRefresh: string };
}

export interface Growth {
    linesDelta: number;
    filesDelta: number;
    minutesAgo: number;
    history: Snapshot[];
    snapshotCount: number;
}

export interface ScanConfig {
    excludePatterns: string[];
    concurrency: number;
    complexityConcurrency: number;
    complexityFileLimit: number;
    staleDays: number;
}

export interface DashboardConfig {
    showOverview: boolean;
    showSaveStreak: boolean;
    showCommitStreak: boolean;
    showHealth: boolean;
    showGrowth: boolean;
    showActivity: boolean;
    showLanguages: boolean;
    showFolders: boolean;
    showRecentlyEdited: boolean;
    showLargestFiles: boolean;
    showMediaAssets: boolean;
    showStaleFiles: boolean;
    showContributors: boolean;
    showChangedFiles: boolean;
    showGit: boolean;
    showDependencies: boolean;
    showPerformance: boolean;
    showComplexity: boolean;
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
    excludePatterns: [
        '**/node_modules/**', '**/target/**', '**/build/**', '**/dist/**',
        '**/.venv/**', '**/venv/**', '**/__pycache__/**', '**/.next/**',
        '**/.nuxt/**', '**/vendor/**', '**/bin/**', '**/obj/**',
        '**/.git/**', '**/coverage/**', '**/.terraform/**'
    ],
    concurrency: 50,
    complexityConcurrency: 5,
    complexityFileLimit: 25,
    staleDays: 180,
};
