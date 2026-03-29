# Statify

**Statify** is a VS Code extension that provides real-time insights into your project. It analyzes your codebase and displays detailed statistics, activity tracking, and Git data, all inside a single dashboard.

---

## ✨ Features

### 📊 Code Insights
- Lines of code per language  
- Language usage breakdown with visual bars  
- Detection of TODO / FIXME comments  
- Largest files in your project  
- Top files ranked by size  

### ⚡ Activity Tracking
- Most edited files (last 30 days)  
- File save streaks  
- Git commit streaks  
- Activity heatmap (file saves + commits over time)  

### 🔗 Git Integration
- Repository and branch detection  
- Latest commit details  
- Weekly and yearly commit activity  

### 🧩 Project Analysis
- Dependency detection for:
  - Node.js (`package.json`)
  - Python (`requirements.txt`)
  - Java (`pom.xml`)
  - Rust (`Cargo.toml`)  
- Media file detection and size tracking  

### 🚀 Dashboard
- Interactive webview dashboard  
- Click any file to open it instantly in VS Code  
- Refresh statistics at any time  

---

## 📦 Installation

1. Open **VS Code**
2. Go to the **Extensions** panel
3. Search for `Statify`
4. Click **Install**

---

## 🚀 Usage

1. Open your project folder in VS Code  
2. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)  
3. Run:
```Open Statify Dashboard```
4. Explore your project insights in the Statify dashboard  

---

## ⚙️ Configuration

Statify works out of the box with no setup required.  
It automatically scans your workspace when opened.

---

## ⚠️ Notes

- Some features depend on project structure and available files  
- Git-related features require a Git repository  
- Statistics are based on detected file changes and scans  

---

## 📄 License

This project is licensed under the MIT License.