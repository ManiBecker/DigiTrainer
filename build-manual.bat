
@echo off
setlocal
title DigiTrainer - Handbuch erstellen

cd /d "%~dp0"

echo.
echo ========================================
echo   DigiTrainer - Handbuch erstellen
echo ========================================
echo.

asciidoctor-pdf ^
  -a pdf-theme=default ^
  -o "docs\DigiTrainer-Handbuch.pdf" ^
  "docs\DigiTrainer-Handbuch.adoc"

if errorlevel 1 (
    echo.
    echo FEHLER: Das PDF konnte nicht erstellt werden!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   PDF erfolgreich erstellt!
echo ========================================
echo.
echo Datei: docs\DigiTrainer-Handbuch.pdf
echo.

pause

