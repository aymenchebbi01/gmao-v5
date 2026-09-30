@echo off
setlocal enabledelayedexpansion

title Thermoplastics Tunisia GMAO - Local Server (Port 5033)

echo ======================================================================
echo   Thermoplastics Tunisia - GMAO Maintenance Management System
echo ======================================================================
echo.

:: Configure application port
set PORT=5033
set NODE_ENV=development

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe ou n'est pas dans le PATH !
    echo Veuillez installer Node.js (version 20 ou 22 recommandee) depuis https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Verify and install npm dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] Le dossier node_modules est introuvable. Installation des dependances...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERREUR] L'installation des dependances a echoue.
        pause
        exit /b 1
    )
)

:: Ensure required storage directories exist
if not exist "data\" mkdir data
if not exist "uploads\" mkdir uploads
if not exist "backups\" mkdir backups

echo [OK] Port configure : %PORT%
echo [OK] Demarrage du serveur GMAO local...
echo.
echo   * Application Bureau : http://localhost:%PORT%
echo   * Mode Tablette      : http://localhost:%PORT/#tablet
echo.
echo Pour arreter l'application, fermez cette fenetre ou appuyez sur Ctrl+C.
echo ======================================================================
echo.

:: Automatically open default browser after a 2-second delay
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"

:: Run the application with tsx server
call npm run dev

pause
