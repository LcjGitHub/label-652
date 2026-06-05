@echo off
chcp 65001 >nul
title 商品管理系统 - 一键启动

echo ========================================
echo   商品管理系统 启动脚本
echo ========================================
echo.

echo [1/4] 检查后端依赖...
if not exist "backend\node_modules" (
    echo   正在安装后端依赖...
    cd backend
    call npm install
    cd ..
    echo   后端依赖安装完成
) else (
    echo   后端依赖已存在
)

echo.
echo [2/4] 检查前端依赖...
if not exist "frontend\node_modules" (
    echo   正在安装前端依赖...
    cd frontend
    call npm install
    cd ..
    echo   前端依赖安装完成
) else (
    echo   前端依赖已存在
)

echo.
echo [3/4] 启动后端服务器...
start "后端服务 - 端口 3000" cmd /k "cd backend && npm start"

echo.
echo [4/4] 等待后端启动后启动前端...
timeout /t 3 /nobreak >nul
echo   启动前端开发服务器...
start "前端服务 - 端口 5173" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   启动完成!
echo   后端地址: http://localhost:3000
echo   前端地址: http://localhost:5173
echo ========================================
echo.
pause
