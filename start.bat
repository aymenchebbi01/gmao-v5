@echo off
setlocal EnableExtensions EnableDelayedExpansion
title GMAO Enterprise Server - Thermoplastics Tunisia

REM Change to script directory
cd /d "%~dp0"

echo =====================================================================
echo           GMAO THERMOPLASTICS - SYSTEM LAUNCHER
echo =====================================================================
echo.

REM -- 1. CHECK NODE.JS ---------------------------------------------------
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :node_missing

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VERSION=%%v
echo [OK] Node.js detected: %NODE_VERSION%

REM -- 2. CHECK NPM -------------------------------------------------------
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :npm_missing

for /f "tokens=*" %%v in ('npm -v 2^>nul') do set NPM_VERSION=%%v
echo [OK] npm detected: %NPM_VERSION%

REM -- 3. CREATE .env IF MISSING ------------------------------------------
if exist ".env" goto :env_exists

if exist ".env.example" (
    echo [INFO] Creating .env from template .env.example...
    copy /y ".env.example" ".env" >nul
    echo [OK] .env created.
) else (
    echo [INFO] Generating default .env configuration...
    echo PORT=5033> .env
    echo NODE_ENV=development>> .env
    echo JWT_SECRET=gmao-pro-secret-key-2026>> .env
    echo WHATSAPP_GROUP_INVITE="">> .env
    echo [OK] Default .env created.
)

:env_exists

REM -- 4. CREATE SYSTEM DIRECTORIES ---------------------------------------
if not exist "data"          mkdir "data"
if not exist "uploads"       mkdir "uploads"
if not exist "backups"       mkdir "backups"
if not exist "whatsapp_auth" mkdir "whatsapp_auth"
echo [OK] System directories ready.

REM -- 5. VERIFY DEPENDENCIES ---------------------------------------------
set NEED_INSTALL=0

if not exist "node_modules"         set NEED_INSTALL=1
if not exist "node_modules\express" set NEED_INSTALL=1
if not exist "node_modules\sql.js"  set NEED_INSTALL=1
if not exist "node_modules\vite"    set NEED_INSTALL=1
if not exist "node_modules\tsx"     set NEED_INSTALL=1

if "%NEED_INSTALL%"=="0" goto :deps_ready

echo.
echo =====================================================================
echo  [INSTALL] Downloading and installing required packages...
echo            This might take 1 to 3 minutes on the first setup.
echo            Please keep this window open.
echo =====================================================================
echo.

call npm install
if !ERRORLEVEL! EQU 0 goto :deps_installed

echo.
echo [WARNING] Standard install had issues. Retrying with --legacy-peer-deps...
call npm install --legacy-peer-deps
if !ERRORLEVEL! NEQ 0 goto :npm_install_error

:deps_installed
echo.
echo [OK] All dependencies successfully installed.
echo.

:deps_ready

REM -- 6. VERIFY TSX RUNTIME ----------------------------------------------
if exist "node_modules\.bin\tsx.cmd" goto :tsx_ready

echo [INFO] Restoring tsx runner...
call npm install tsx
if !ERRORLEVEL! NEQ 0 goto :npm_install_error

:tsx_ready

REM -- 7. START SERVER ----------------------------------------------------
set PORT=5033
echo.
echo =====================================================================
echo   GMAO SERVER STARTING ON PORT %PORT%
echo   Desktop : http://localhost:%PORT%
echo   Tablet  : http://localhost:%PORT%/#tablet
echo   Keep this window OPEN while using the application.
echo   Press Ctrl+C to stop the server.
echo =====================================================================
echo.

REM Open browser in background after 4 seconds
start "" cmd /c "timeout /t 4 >nul && start http://localhost:%PORT%"

call "node_modules\.bin\tsx.cmd" server.ts
if !ERRORLEVEL! NEQ 0 goto :server_error

echo.
echo [INFO] Server stopped normally.
pause
exit /b 0

REM -- ERROR HANDLERS -----------------------------------------------------

:node_missing
echo [ERROR] Node.js is NOT installed or not in PATH.
echo.
echo Please install Node.js LTS from https://nodejs.org/
echo After installing, restart your computer and run start.bat again.
goto :error_exit

:npm_missing
echo [ERROR] npm was not found in your PATH.
echo Please ensure Node.js is installed correctly.
goto :error_exit

:npm_install_error
echo.
echo [ERROR] npm install failed.
echo Check your internet connection and run npm install manually to see the error.
goto :error_exit

:server_error
echo.
echo [ERROR] Server exited with an error. See the messages above.
goto :error_exit

:error_exit
echo.
echo =====================================================================
echo  An error occurred. This window will stay open for review.
echo =====================================================================
echo.
pause
exit /b 1