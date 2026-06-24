# Changelog

All notable changes to Statify are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---
## [1.4.0]: Codebase Cleaning, Stat Gathering Refactor & ESLint Hardening

### Added

- **`src/stats.ts`**: shared `gatherStats()`, `scanDependencies()`, and `getScanConfig()` extracted out of `extension.ts` and `treeView.ts` so both consume from a single source
- **`src/languages.ts`**: language color maps, badge maps, and helper functions (`getLangColor`, `getLangBadge`, `getLangIcon`) extracted from the webview template into a dedicated typed module
- **ESLint rules**: `@typescript-eslint/no-unused-vars`, `@typescript-eslint/no-floating-promises`, and `parserOptions.projectService` for type-aware linting

### Changed

- **Stats gathering deduplicated**: `extension.ts` and `treeView.ts` no longer maintain separate scan pipelines; both call into `stats.ts`'s `gatherStats()` which handles scanning, git info, dependencies, and health scoring in one place
- **`themeToCss` refactored**: now uses `Object.entries` iteration instead of manually concatenating 18 CSS variable strings
- **`escapeJson` hardened**: also escapes backslashes and single quotes now (previously only `</script>`)
- **`calcGrowth` timeline fix**: previous snapshot is captured *before* the snapshots array is mutated, fixing `minutesAgo` display on sequential refreshes
- **`workspaceState.update` now awaited**: was fire-and-forget before, could lose state under rapid calls
- **File change listener debounced**: `onDidChangeTextDocument` now waits 500ms after the last keystroke before triggering a refresh, instead of firing on every character typed

### Removed

- **`recentFiles` from scan return**: the full list of recently-modified files was computed and returned but never consumed by the dashboard; removed from `scanFiles()` return type
- **Unused `as number` casts**: removed from folder entry mapping in both `webview.ts` and `treeView.ts`
- **Unused imports and variables**: cleaned up across `extension.ts`, `treeView.ts`, `webview.ts`, and `git.ts`
- **Test suite removed**: all test files (`src/test/`) and their build config removed; test-related scripts (`compile:tests`, `pretest`, `test`) removed from `package.json`
- **CI workflow removed**: `.github/workflows/ci.yml` removed alongside the test suite

---
## [1.3.2]: Codebase Refactor, Native Tree View, Complexity & Configurable Cards

### Added

- **Native tree view sidebar**: the webview sidebar is replaced with a native VS Code `TreeDataProvider`: sections for Overview, Languages, Top Folders, Health, and Git, each collapsible with leaf values and native VS Code icons; "Open Dashboard" button at top works as a clickable tree item
- **File complexity analysis**: regex-based function and class counting for 15+ languages (JS/TS, Python, Java, Rust, Go, C/C++, C#, Ruby, PHP, Swift, Kotlin); long-line percentage tracking; top 10 most complex files card in the dashboard with function/class counts
- **Configurable dashboard cards**: 18 toggleable cards controlled via VS Code settings (`statify.dashboardCards.*`); toggle checkboxes in the settings panel with styled pill-switch UI; changes persist globally
- **Styled toggle switches**: card toggles in the settings panel now render as custom pill-shaped switches (green when active, with sliding knob) instead of raw browser checkboxes

### Changed

- **Codebase modularized**: the monolithic 1214-line `extension.ts` has been split into dedicated modules:
  - `types.ts`: all shared interfaces and type definitions
  - `scanner.ts`: file scanning, language detection, binary detection, complexity analysis
  - `git.ts`: all git operations (branch, commits, contributors, changed files)
  - `health.ts`: health score calculation
  - `state.ts`: snapshot management, streak calculation, heatmap generation
  - `webview.ts`: full dashboard HTML/CSS/JS template generation
  - `treeView.ts`: native tree data provider for the sidebar
  - `extension.ts`: slimmed to 155 lines as a clean entry point

### Fixed

- **Tree item commands not firing**: the `command` parameter in `StatifyTreeItem` was accepted but never assigned to `this.command`, causing clickable items like "Open Dashboard" to silently do nothing

---
## [1.3.1]: Bug Fixes & Layout Polish

### Fixed

- **Grid layout inconsistency**: cards that had no data were being removed from the DOM entirely, breaking the CSS grid and leaving awkward empty columns; all cards now always render and show a friendly empty state message instead (e.g. "No git repository found", "No stale files: nice!")
- **Responsive layout collapse**: at narrow panel widths, `.grid` and `.grid-2` containers collapsed at different breakpoints causing misaligned rows; all grid containers now collapse consistently together
- **Git stderr noise**: git commands were missing `stdio: 'pipe'` on some `execSync` calls, causing git error output (e.g. "Not a git repository") to leak into the VS Code debug console

## [1.3.0]: Activity Bar, Theme Overhaul & Language Icons

### Added

- **Activity bar icon**: Statify now has a dedicated icon in the VS Code sidebar rail (next to Explorer, Source Control, etc.), opening a persistent sidebar panel
- **Sidebar panel**: shows a live mini-dashboard: code file count, total lines, TODO count, media files, total project size, top 5 language bars, and top folders by file count; refreshes on every file save
- **25 new themes**: theme system expanded from 10 to 25 built-in themes across four groups:
  - *Gruvbox Dark*: Hard, Medium, Soft
  - *Gruvbox Light*: Hard, Medium, Soft
  - *Popular*: Nord, Catppuccin Mocha, Catppuccin Latte, Catppuccin Macchiato, Tokyo Night, Tokyo Night Storm, Dracula, One Dark Pro, Solarized Dark, Solarized Light, Monokai Pro, Material Ocean
  - *Extras*: Rosé Pine, Rosé Pine Moon, Everforest Dark, Kanagawa, Ayu Dark, Nightfox, Oxocarbon
- **Theme preview screenshots**: PNG previews for all 25 themes added to `src/previews/`, named by theme ID
- **Per-theme source files**: every theme now lives in its own file under `src/themes/` (e.g. `dracula.ts`, `kanagawa.ts`); adding a new theme is a single file drop + one import line in `index.ts`
- **File type icons in language breakdown**: each language row now shows a colored badge icon (TypeScript blue, Python blue, Rust red, etc.); niche languages like Zig, Gleam, WGSL, Prisma, Nix, Elixir, and others all have icons; unknown extensions get an auto-generated fallback badge
- **Theme preview repositioned**: the live preview card in the settings panel is now a sticky left column alongside the theme list instead of below it

### Changed

- **Universal language detection**: all non-media files are now counted by extension regardless of whether they pass the UTF-8 text heuristic; niche and binary-adjacent formats (`.wasm`, `.wgsl`, `.gleam`, etc.) now appear in the language breakdown
- **Folder breakdown**: now uses file count as the bar width basis (previously line count), so folders with binary or non-text files always show up correctly

---

## [1.2.0]: Project Health, Git Intelligence & Theme System

### Added

- **Project Health score**: 0–100 grade (A–F) computed from five weighted factors: TODO density, stale file ratio, commit frequency, recent activity, and average file size per file
- **Theme system**: 10 built-in themes across Gruvbox Dark (Hard/Medium/Soft), Gruvbox Light (Hard/Medium/Soft), Nord, Catppuccin Mocha, Tokyo Night, and Dracula; selection persisted per-machine via `globalState`
- **Settings panel**: slide-in drawer with theme picker, color swatch previews, and a live preview card before committing
- **Top contributors**: ranked git author list by commit count with initials avatar and proportional bar
- **Most changed files**: top 10 files by total git touch count, capped at last 500 commits for performance
- **Stale files panel**: code files untouched for 6+ months, sorted by age with human-readable durations (`180d` / `2y`)
- **Folder breakdown**: top 8 folders by line count rendered as a proportional bar chart alongside file counts
- **Commit activity heatmap**: parallel heatmap for git commits sitting alongside the file-saves heatmap
- **Commit streaks**: current and longest commit streaks in a dedicated card, mirroring the save streak card
- **File search / filter**: global search bar filters recently edited, largest, media, and most changed lists simultaneously with a clear button
- **JSON export**: one-click download of a full project snapshot as a timestamped `.json` file covering health, git, deps, growth history, and performance
- **Expandable language list**: top 5 languages shown by default; additional languages collapsible behind a toggle

### Changed

- Heatmap window extended from 12 to **14 weeks**
- Each dashboard card now has a themed **accent color bar** (two-pixel top border) tied to the active theme's color variables
- Growth chart line and tooltip colors now **reflect the active theme** dynamically rather than hardcoded hex values
- Media assets list raised to **top 10** displayed files
- Text file detection now enforces a **5 MB size cap** and a UTF-8 heuristic (≥90% printable, <10% control characters) to more reliably exclude binary files

---

## [1.1.0]: Rebrand & Stability

### Changed

- Renamed from **Project Stats** to **Statify**: updated all UI labels, metadata, and branding
- Expanded language detection to cover a significantly wider range of file extensions, including previously missed types (`.yml`, `.brainfuck`, and others)

### Fixed

- Growth graph rendering was inconsistent across scans: corrected snapshot delta calculation logic
- Historical project statistics were occasionally inaccurate due to snapshot deduplication errors: improved stability of the snapshot pipeline

---

## [1.0.0]: Initial Release

First release of Statify. Ships a complete project analytics dashboard inside VS Code with no configuration required.

### Added

- **Interactive webview panel**: real-time codebase insights with click-to-open file navigation
- **Manual refresh button**: re-scan the workspace at any time
- **Auto-refresh**: dashboard updates automatically on file save, create, and delete events
- **Total lines of code**: broken down by language with percentage bars
- **TODO / FIXME detection**: counts and groups findings by file
- **Largest files**: ranked list of biggest code files by size
- **Most recently edited files**: activity list covering the last 30 days
- **File save streak tracking**: current and longest streaks
- **Git commit streak tracking**: current and longest streaks
- **Dual heatmap**: file saves and Git commits visualised over the last 12 weeks
- **Git integration**: automatic repo and branch detection, latest commit message with relative timestamp, and weekly commit count
- **Full yearly commit history**: powers heatmap and streak calculation
- **Dependency detection**: reads `package.json`, `requirements.txt`, `pom.xml`, and `Cargo.toml`
- **Media analysis**: detects image, video, and audio files; shows total count, combined size, and top 5 largest assets
- **Project growth tracking**: per-workspace snapshot history (up to 100 snapshots, 30-day window) with line and file count delta
- **Historical trend chart**: line count over time rendered with Chart.js
- **Performance panel**: scan duration in milliseconds, total files scanned, and last refresh timestamp