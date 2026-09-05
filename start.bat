@echo off
cd /d "%~dp0"
node server.js
echo.
echo 服务已停止或启动失败。按任意键关闭窗口。
pause >nul
