# Literary Studio API Test Runner
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "未找到 python，请先安装 Python 3.9+"
}

Write-Host "Installing test dependencies..."
python -m pip install -q -r requirements.txt

Write-Host "Running pytest..."
python -m pytest @args
