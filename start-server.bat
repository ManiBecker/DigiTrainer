
@echo off
setlocal
title DigiTrainer - Lokaler Webserver

cd /d "%~dp0"

echo ========================================
echo   DigiTrainer - Lokaler Webserver
echo ========================================
echo.
echo URL: http://localhost:8000/
echo.
echo Zum Beenden Strg+C druecken.
echo.

start "" "http://localhost:8000/"

python -m http.server 8000 --bind 127.0.0.1

if errorlevel 1 (
    echo.
    echo Server konnte nicht gestartet werden.
    echo Ist Python installiert und Port 8000 frei?
    pause
)
