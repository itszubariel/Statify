# Changelog

All notable changes to Statify are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.2] — Project Health, Git Intelligence & Theme System

### Added

- **Project Health score** — 0–100 grade (A–F) computed from five weighted factors: TODO density, stale file ratio, commit frequency, recent activity, and average file size per file
- **Theme system** — 10 built-in themes across Gruvbox Dark (Hard/Medium/Soft), Gruvbox Light (Hard/Medium/Soft), Nord, Catppuccin Mocha, Tokyo Night, and Dracula; selection persisted per-machine via `globalState`
- **Settings panel** — slide-in drawer with theme picker, color swatch previews, and a live preview card before committing
- **Top contributors** — ranked git author list by commit count with initials avatar and proportional bar
- **Most changed files** — top 10 files by total git touch count, capped at last 500 commits for performance
- **Stale files panel** — code files untouched for 6+ months, sorted by age with human-readable durations (`180d` / `2y`)
- **Folder breakdown** — top 8 folders by line count rendered as a proportional bar chart alongside file counts
- **Commit activity heatmap** — parallel heatmap for git commits sitting alongside the file-saves heatmap
- **Commit streaks** — current and longest commit streaks in a dedicated card, mirroring the save streak card
- **File search / filter** — global search bar filters recently edited, largest, media, and most changed lists simultaneously with a clear button
- **JSON export** — one-click download of a full project snapshot as a timestamped `.json` file covering health, git, deps, growth history, and performance
- **Expandable language list** — top 5 languages shown by default; additional languages collapsible behind a toggle

### Changed

- Heatmap window extended from 12 to **14 weeks**
- Each dashboard card now has a themed **accent color bar** (two-pixel top border) tied to the active theme's color variables
- Growth chart line and tooltip colors now **reflect the active theme** dynamically rather than hardcoded hex values
- Media assets list raised to **top 10** displayed files
- Text file detection now enforces a **5 MB size cap** and a UTF-8 heuristic (≥90% printable, <10% control characters) to more reliably exclude binary files

---

## [0.1.1] — Rebrand & Stability

### Changed

- Renamed from **Project Stats** to **Statify** — updated all UI labels, metadata, and branding
- Expanded language detection to cover a significantly wider range of file extensions, including previously missed types (`.yml`, `.brainfuck`, and others)

### Fixed

- Growth graph rendering was inconsistent across scans — corrected snapshot delta calculation logic
- Historical project statistics were occasionally inaccurate due to snapshot deduplication errors — improved stability of the snapshot pipeline

---

## [0.1.0] — Initial Release

First release of Statify. Ships a complete project analytics dashboard inside VS Code with no configuration required.

### Added

- **Interactive webview panel** — real-time codebase insights with click-to-open file navigation
- **Manual refresh button** — re-scan the workspace at any time
- **Auto-refresh** — dashboard updates automatically on file save, create, and delete events
- **Total lines of code** — broken down by language with percentage bars
- **TODO / FIXME detection** — counts and groups findings by file
- **Largest files** — ranked list of biggest code files by size
- **Most recently edited files** — activity list covering the last 30 days
- **File save streak tracking** — current and longest streaks
- **Git commit streak tracking** — current and longest streaks
- **Dual heatmap** — file saves and Git commits visualised over the last 12 weeks
- **Git integration** — automatic repo and branch detection, latest commit message with relative timestamp, and weekly commit count
- **Full yearly commit history** — powers heatmap and streak calculation
- **Dependency detection** — reads `package.json`, `requirements.txt`, `pom.xml`, and `Cargo.toml`
- **Media analysis** — detects image, video, and audio files; shows total count, combined size, and top 5 largest assets
- **Project growth tracking** — per-workspace snapshot history (up to 100 snapshots, 30-day window) with line and file count delta
- **Historical trend chart** — line count over time rendered with Chart.js
- **Performance panel** — scan duration in milliseconds, total files scanned, and last refresh timestamp