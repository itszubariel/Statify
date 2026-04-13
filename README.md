```
███████╗████████╗ █████╗ ████████╗██╗███████╗██╗   ██╗
██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██║██╔════╝╚██╗ ██╔╝
███████╗   ██║   ███████║   ██║   ██║█████╗   ╚████╔╝
╚════██║   ██║   ██╔══██║   ██║   ██║██╔══╝    ╚██╔╝
███████║   ██║   ██║  ██║   ██║   ██║██║        ██║
╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝        ╚═╝
```

> **Codebase intelligence, right inside VS Code.**

Statify gives you a real-time analytics dashboard for your project — lines of code, language breakdowns, Git activity, health scores, theming, and more. No config. No cloud. Just open it and go.

---

## Features

### Activity Bar & Sidebar
Statify lives in the VS Code sidebar rail — click the icon to open a persistent mini-dashboard showing:
- Code file count, total lines, TODO count, media files, and total project size
- Top 5 language breakdown with proportional bars
- Top folders by file count
- **Open Dashboard** button to launch the full panel

All stats refresh automatically on every file save.

### Code Insights
Track what your codebase is actually made of.
- Lines of code broken down by language with visual percentage bars and file type icons
- Folder breakdown, top 8 folders by file count
- TODO / FIXME detection grouped by file
- Largest files ranked by size
- Binary and media file detection with total size tracking
- Expandable language list, top 5 shown, rest collapsible
- Universal language detection — every file extension is counted, including niche formats like `.gleam`, `.zig`, `.wgsl`, `.nix`, `.prisma`, and more

### Activity Tracking
See how you work, not just what you built.
- Most recently edited files over the last 30 days
- File save streaks, current and longest
- Git commit streaks, current and longest
- Dual heatmap: file saves and commits over the last 14 weeks

### Project Health
Know how clean your project actually is.

Statify scores your project from 0–100 and assigns a grade (A–F) based on five factors:

| Factor | Max | What it measures |
|---|---|---|
| TODO Density | 25 | TODOs per 100 lines |
| Fresh Files | 20 | Ratio of recently touched files |
| Commit Frequency | 25 | Active commit days in the last 30 days |
| Recent Activity | 20 | Active file-edit days in the last 7 days |
| File Focus | 10 | Average lines per file |

### Git Integration
Your repo context, always visible.
- Branch detection and display
- Latest commit message with relative timestamp
- Commits this week at a glance
- Full yearly commit history for heatmap and streak calculation
- Top contributors ranked by commit count
- Most changed files across the last 500 commits

### Stale File Detection
Find the parts of your project nobody's touched in months.
- Lists code files untouched for 6+ months
- Sorted by age, shown with human-readable durations (`180d`, `2y`)
- Click any file to open it directly

### Dependency Analysis
Know what you're depending on.

| File | Ecosystem |
|---|---|
| `package.json` | Node.js |
| `requirements.txt` | Python |
| `pom.xml` | Java / Maven |
| `Cargo.toml` | Rust |

### Project Growth
Watch your project evolve over time.
- Line and file count delta since your last scan
- Up to 100 snapshots retained over a 30-day window
- Growth chart with historical trend line (Chart.js)

### Themes
25 built-in themes across four groups, switchable from the settings panel — no restart required. The live preview card sits alongside the theme list so you can see colors before applying.

Preview screenshots for every theme are available in [`src/previews/`](src/previews/).

| Group | Themes |
|---|---|
| Gruvbox Dark | Hard · Medium · Soft |
| Gruvbox Light | Hard · Medium · Soft |
| Popular | Nord · Catppuccin Mocha · Catppuccin Latte · Catppuccin Macchiato · Tokyo Night · Tokyo Night Storm · Dracula · One Dark Pro · Solarized Dark · Solarized Light · Monokai Pro · Material Ocean |
| Extras | Rosé Pine · Rosé Pine Moon · Everforest Dark · Kanagawa · Ayu Dark · Nightfox · Oxocarbon |

Open **Settings** (gear icon), pick a theme, preview it live, and hit **Apply**.

### Export
One-click JSON export of your full project snapshot health score, language stats, git data, dependency counts, growth history, and performance timings. Saved as a timestamped `.json` file.

### Search
A search bar at the top filters across all file lists simultaneously recently edited, largest files, media assets, and most changed files.

### Performance
Because a slow tool is a bad tool.
- Scan time in milliseconds
- Total files scanned
- Last refresh timestamp
- Most recently modified file

---

## Installation

**From the Marketplace:**
1. Open VS Code
2. Go to the Extensions panel (`Ctrl+Shift+X`)
3. Search `Statify`
4. Click **Install**

**From VSIX:**
```bash
code --install-extension statify-*.vsix
```

---

## Usage

1. Open a project folder in VS Code
2. Click the **Statify icon** in the activity bar (sidebar rail) for a quick stats overview
3. Hit **Open Dashboard** from the sidebar, or open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run `Open Statify Dashboard`
4. The full dashboard opens in a new editor panel

From there: click any file to jump straight to it, use the search bar to filter file lists, hit **Refresh** to re-scan, switch themes from the gear icon, or just leave it open — it updates automatically on file changes.

---

## Notes

- Git features require a `.git` repository in the workspace root
- Files over 5 MB are skipped during text analysis
- Binary files are detected via UTF-8 heuristic (≥90% printable characters required)
- `node_modules` is excluded from all scans
- Snapshot history is stored per-workspace in VS Code's workspace state
- Theme preference is stored globally across all workspaces

---

## License

MIT — do whatever you want with it.