# 商品管理系统 - 一键启动脚本 (PowerShell)
param([switch]$NoInstall)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  商品管理系统 启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 加载配置
$configPath = Join-Path $ScriptDir "config.json"
if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    $backendPort = $config.backend.port
    $frontendPort = $config.frontend.port
} else {
    $backendPort = "3000"
    $frontendPort = "5173"
}

# 1. 检查后端依赖
Write-Host "[1/4] 检查后端依赖..." -ForegroundColor Yellow
$backendNodeModules = Join-Path $ScriptDir "backend" "node_modules"
if (-not (Test-Path $backendNodeModules) -and -not $NoInstall) {
    Write-Host "  正在安装后端依赖..." -ForegroundColor Gray
    Set-Location (Join-Path $ScriptDir "backend")
    npm install
    Set-Location $ScriptDir
    Write-Host "  后端依赖安装完成" -ForegroundColor Green
} else {
    Write-Host "  后端依赖已存在" -ForegroundColor Green
}

Write-Host ""

# 2. 检查前端依赖
Write-Host "[2/4] 检查前端依赖..." -ForegroundColor Yellow
$frontendNodeModules = Join-Path $ScriptDir "frontend" "node_modules"
if (-not (Test-Path $frontendNodeModules) -and -not $NoInstall) {
    Write-Host "  正在安装前端依赖..." -ForegroundColor Gray
    Set-Location (Join-Path $ScriptDir "frontend")
    npm install
    Set-Location $ScriptDir
    Write-Host "  前端依赖安装完成" -ForegroundColor Green
} else {
    Write-Host "  前端依赖已存在" -ForegroundColor Green
}

Write-Host ""

# 3. 启动后端服务器
Write-Host "[3/4] 启动后端服务器..." -ForegroundColor Yellow
$backendPath = Join-Path $ScriptDir "backend"
$backendCmd = "cd `"$backendPath`" ; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
Write-Host "  后端服务已启动 (端口: $backendPort)" -ForegroundColor Green

Write-Host ""

# 4. 等待后端启动后启动前端
Write-Host "[4/4] 等待后端启动后启动前端..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "  启动前端开发服务器..." -ForegroundColor Gray
$frontendPath = Join-Path $ScriptDir "frontend"
$frontendCmd = "cd `"$frontendPath`" ; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal
Write-Host "  前端服务已启动 (端口: $frontendPort)" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动完成!" -ForegroundColor Green
Write-Host "  后端地址: http://localhost:$backendPort" -ForegroundColor White
Write-Host "  前端地址: http://localhost:$frontendPort" -ForegroundColor White
Write-Host "  健康检查: http://localhost:$backendPort/api/health" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示: 按任意键退出本脚本，服务将继续在后台运行" -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
