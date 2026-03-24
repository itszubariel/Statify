# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — Initial Release

First release of **Project Stats** extension with the following features:

- **Dashboard**: Webview panel showing an overview of your project.
- **Code Statistics**:
  - Total lines of code per language
  - TODO/FIXME items detection
  - Biggest files in the project
  - Language usage breakdown with GitHub-style bars
  - Top files sorted by size
- **Media Statistics**:
  - Count and size of media files
  - Largest media files
- **Recent Activity**:
  - Most edited files (last 30 days)
  - File save streak tracking
  - Commit activity streaks (from Git)
  - Dual heatmap for daily saves and commits (last 12 weeks)
- **Git Integration**:
  - Detect repository, branch, last commit
  - Commits per week and last year
- **Dependencies Overview**:
  - Node.js (`package.json`), Python (`requirements.txt`), Java (`pom.xml`), Rust (`Cargo.toml`)
- **Performance Tracking**:
  - Scan time and number of files scanned
  - Last refresh timestamp
- **Refresh Button**: Quickly update statistics without closing the dashboard
- **File Explorer**: Open files directly from the dashboard

This release establishes the foundation of the project with comprehensive project insights.
