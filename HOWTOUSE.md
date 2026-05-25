# How to use Statify

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

## Opening the Dashboard

There are two ways to get to the dashboard:

**Option 1: Activity Bar (recommended)**
1. Look for the Statify icon in the left sidebar rail (the bar with Explorer, Source Control, Extensions, etc.)
2. Click it to open the Statify sidebar panel
3. Hit **Open Dashboard** to launch the full dashboard in an editor panel

**Option 2: Command Palette**
1. Open the command palette: `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Run: `Open Statify Dashboard`

---

## Sidebar Panel

The sidebar is a native VS Code tree view with expandable/collapsible sections: no HTML rendering, feels like part of the editor:

- **Overview**: code files, total lines, TODO count, media files, project size
- **Languages**: top 8 languages with file count, percentage, and line count
- **Top Folders**: top 6 folders by file count with line counts
- **Health**: overall score with per-factor breakdowns
- **Git**: branch, last commit, weekly commits, contributor count (only shown when a repo is detected)
- **Open Dashboard**: clickable item at the top to launch the full dashboard

It refreshes automatically every time you save a file.

---

## Dashboard

Once the full dashboard is open:

- **Click any file** in the lists to jump straight to it in the editor
- **Search bar** at the top filters across all file lists simultaneously
- **Refresh button** re-scans the workspace on demand
- **Settings (gear icon)** opens the settings panel with two sections: **Dashboard Cards** (toggle individual cards on/off with pill switches, changes apply immediately) and **Theme** (preview themes live before applying)
- The dashboard **auto-refreshes** on file save, create, and delete events

---

## Themes

Click the gear icon in the top-right of the dashboard to open the settings panel. The live preview sits to the left of the theme list so you can see colors before committing. Pick a theme and hit **Apply Theme**.

25 built-in themes across four groups:

| Group | Themes |
|---|---|
| Gruvbox Dark | Hard · Medium · Soft |
| Gruvbox Light | Hard · Medium · Soft |
| Popular | Nord · Catppuccin Mocha · Catppuccin Latte · Catppuccin Macchiato · Tokyo Night · Tokyo Night Storm · Dracula · One Dark Pro · Solarized Dark · Solarized Light · Monokai Pro · Material Ocean |
| Extras | Rosé Pine · Rosé Pine Moon · Everforest Dark · Kanagawa · Ayu Dark · Nightfox · Oxocarbon |

Preview screenshots for every theme are in [`src/previews/`](src/previews/): named after the theme ID (e.g. `dracula.png`, `kanagawa.png`).

Your theme choice is saved globally across all workspaces.

---

## Notes

- Git features require a `.git` repository in the workspace root
- Files over 5 MB are skipped during text analysis
- `node_modules` is excluded from all scans
- All file extensions are counted in the language breakdown, including niche formats
- Snapshot history is stored per-workspace in VS Code's workspace state
