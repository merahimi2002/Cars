@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is required. Install Node.js, then open Start.cmd again.
    pause
    exit /b 1
)
node scripts\start.cjs
if errorlevel 1 pause
