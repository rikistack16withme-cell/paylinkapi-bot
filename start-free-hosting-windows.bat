@echo off
title PaylinkApi 24/7 Free Hosting Server
color 0A

echo ========================================================
echo   PAYLINKAPI - 24/7 FREE HOSTING ENGINE
echo   Bot: @PayLinkAPI_bot
echo   Portal: Express + Next.js (Port 5000)
echo   Bypass: Bakong SSR Proxy (Port 3000)
echo ========================================================
echo.

:: Ensure dependencies are installed
if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    call npm.cmd install
) else (
    echo [1/3] Dependencies verified.
)

:: Build Next.js Web Portal if needed
if not exist ".next\" (
    echo [2/3] Building Web Portal...
    call npm.cmd run build
) else (
    echo [2/3] Web Portal build verified.
)

echo [3/3] Starting PaylinkApi Core Engine...
echo.
echo ========================================================
echo   SERVER IS LIVE! KEEP THIS WINDOW OPEN FOR 24/7 UPTIME
echo   Press Ctrl+C to stop.
echo ========================================================
echo.

node index.js
pause
