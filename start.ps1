# Literary Studio - Windows startup
# Usage:
#   Double-click start.bat
#   powershell -ExecutionPolicy Bypass -File .\start.ps1
#   npm start

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '[ERROR] Node.js not found. Install Node.js 22+ from https://nodejs.org/' -ForegroundColor Red
    exit 1
}

& node (Join-Path $ROOT 'scripts\start.mjs')
exit $LASTEXITCODE
