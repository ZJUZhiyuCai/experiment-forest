@echo off
title 实验小森林
cd /d "%~dp0"
echo 启动实验小森林...
start "" npm run dev:client
timeout /t 3 >nul
start "" http://localhost:3000
echo 实验小森林已启动，浏览器将自动打开！
pause