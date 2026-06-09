@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 22+ from https://nodejs.org/
  exit /b 1
)
node scripts\start.mjs
exit /b %ERRORLEVEL%
