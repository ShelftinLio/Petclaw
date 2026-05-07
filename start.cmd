@echo off
chcp 65001 >nul 2>&1

title Petclaw Gateway Console

echo.
echo   +==========================================+
echo   :      Petclaw Desktop Pet  v3.5.2          :
echo   :      Gateway Console - Live Monitor       :
echo   +==========================================+
echo.
echo   [%TIME%] Starting Petclaw...
echo   [%TIME%] Gateway logs will appear below
echo   ------------------------------------------
echo.

cd /d "%~dp0"
"node_modules\.bin\electron.cmd" . %*
