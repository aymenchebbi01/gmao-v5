@echo off
setlocal
cd /d "%~dp0"

title Thermoplastics Tunisia GMAO - Port 5033

echo ======================================================================
echo   Thermoplastics Tunisia - GMAO Maintenance Management System
echo ======================================================================
echo Dossier du projet : %CD%
echo.

node -v >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n est pas installe sur votre systeme.
    echo.
    echo Veuillez installer Node.js (version 20 ou 22 LTS recommandee) :
    echo https://nodejs.org
    echo.
    echo Une fois l installation terminee, relancez ce fichier start.bat.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detecte :
node -v
echo [OK] npm detecte :
call npm -v
echo.

if not exist "node_modules" (
    echo [INFO] Le dossier node_modules est absent.
    echo Installation automatique des dependances (npm install)...
    echo Veuillez patienter pendant le telechargement...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERREUR] L installation des dependances a echoue.
        echo Verifiez votre connexion internet et reessayez.
        echo.
        pause
        exit /b 1
    )
    echo [OK] Dependances installees avec succes.
    echo.
)

if not exist "data" mkdir data
if not exist "uploads" mkdir uploads
if not exist "backups" mkdir backups

set PORT=5033
set NODE_ENV=development

echo ======================================================================
echo   Demarrage du serveur GMAO sur le port %PORT%...
echo.
echo   * Application Bureau : http://localhost:%PORT%
echo   * Mode Tablette      : http://localhost:%PORT/#tablet
echo.
echo   Gardez cette fenetre ouverte pendant l utilisation du GMAO.
echo   Pour arreter le serveur : appuyez sur Ctrl+C ou fermez la fenetre.
echo ======================================================================
echo.

start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process http://localhost:5033" >nul 2>&1

call npm run dev

echo.
echo ======================================================================
echo Le serveur s est arrete.
echo ======================================================================
pause
