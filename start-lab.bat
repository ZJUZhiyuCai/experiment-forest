@echo off
chcp 65001 >nul
title 实验小森林 - 启动服务
echo.
echo ====================================
echo     🧪 实验小森林 - 科研管理平台
echo ====================================
echo.
echo 正在启动开发服务器...
echo 请稍等，第一次启动可能需要几秒钟...
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查npm是否可用
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: npm 不可用
    pause
    exit /b 1
)

:: 切换到项目目录
cd /d "%~dp0"

:: 检查依赖是否已安装
if not exist "node_modules" (
    echo 📦 正在安装项目依赖...
    echo 这可能需要几分钟时间，请耐心等待...
    npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
)

:: 启动开发服务器
echo 🚀 正在启动实验小森林...
echo.
echo 启动完成后将自动打开浏览器
echo 如果没有自动打开，请手动访问: http://localhost:3000
echo.
echo 按 Ctrl+C 可以停止服务器
echo ====================================
echo.

:: 启动服务器并在后台打开浏览器
start "" npm run dev:client
timeout /t 3 /nobreak >nul
start "" http://localhost:3000

echo.
echo 🎉 实验小森林已启动！
echo 浏览器应该会自动打开 http://localhost:3000
echo.
echo 使用完毕后，请在此窗口按 Ctrl+C 停止服务器
pause