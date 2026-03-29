# Changelog

All notable changes to **Statify** are documented in this file.

---

## [0.1.1] — Rebrand & Stability Update

### 🔄 Rebrand
- Renamed project from **Project Stats** to **Statify**
- Updated branding across extension UI and metadata

### 🧠 Language & File Detection Improvements
- Expanded language detection to support **a much wider range of file extensions**
  - Including previously missed or niche languages (e.g. Brainfuck, YML, etc.)
- Improved general file type recognition and classification

### 📈 Project Growth Tracking Fixes
- Fixed bugs in project growth graph
  - Corrected inconsistent or incorrect data rendering
  - Improved snapshot tracking stability
- Improved accuracy of historical project statistics

---

## [0.1.0] — Initial Release

The first release of **Statify**, introducing a full project analytics dashboard inside VS Code.

### ✨ Dashboard
- Interactive webview dashboard with real-time project insights
- Centralized view of codebase, activity, and project structure

### 📊 Code Statistics
- Total lines of code per language  
- TODO / FIXME detection  
- Language usage breakdown with visual bars  
- Largest files in the project  
- Top files ranked by size  

### 🧩 Media Analysis
- Detection of media files  
- Total media count and size  
- Largest media assets  

### ⚡ Activity Tracking
- Most edited files (last 30 days)  
- File save tracking and streaks  
- Git commit streak tracking  
- Dual heatmap:
  - File saves  
  - Git commits  
  *(last 12 weeks of activity)*  

### 🔗 Git Integration
- Automatic repository detection  
- Branch and latest commit details  
- Weekly commit count  
- Yearly commit activity history  

### 📦 Dependency Detection
- Node.js (`package.json`)  
- Python (`requirements.txt`)  
- Java (`pom.xml`)  
- Rust (`Cargo.toml`)  

### ⏱ Performance Tracking
- Scan duration measurement  
- Total files scanned  
- Last refresh timestamp  

### 🔄 Controls & Navigation
- Manual refresh button to update stats instantly  
- Click-to-open files directly from the dashboard  

---

### 🚀 Summary

This release establishes **Statify** as a powerful, real-time project analytics tool inside VS Code, with deep insights into code, activity, and project structure.