@echo off
setlocal
title Trophy Room Kiosk
cd /d "%~dp0"

set PORT=8484

REM ---------- 1) find Node: system install, or local portable copy ----------
where node >nul 2>nul
if %errorlevel%==0 (
    set "NODE=node"
    goto :run
)
if exist "%~dp0runtime\node\node.exe" (
    set "NODE=%~dp0runtime\node\node.exe"
    goto :run
)

echo Node.js not found - installing it now (one time only)...
echo.

REM ---------- 2) try winget (built into Windows 10/11) ----------
where winget >nul 2>nul
if %errorlevel%==0 (
    echo Installing Node.js LTS via winget...
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    REM winget updates PATH for new shells only, so look up the exe directly
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE=%ProgramFiles%\nodejs\node.exe"
        goto :run
    )
)

REM ---------- 3) fallback: download portable Node (no admin rights needed) ----------
echo Downloading portable Node.js from nodejs.org...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$zip = Join-Path $env:TEMP 'node-portable.zip';" ^
  "Invoke-WebRequest 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip' -OutFile $zip;" ^
  "Expand-Archive $zip -DestinationPath '%~dp0runtime' -Force;" ^
  "Rename-Item '%~dp0runtime\node-v22.14.0-win-x64' 'node';" ^
  "Remove-Item $zip"
if exist "%~dp0runtime\node\node.exe" (
    set "NODE=%~dp0runtime\node\node.exe"
    goto :run
)

echo.
echo ERROR: Could not install Node.js automatically.
echo Please install it manually from https://nodejs.org and run this file again.
pause
exit /b 1

:run
echo.
echo Starting Trophy Room Kiosk on port %PORT% ...
REM open the browser a moment after the server has had time to bind
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"
"%NODE%" server.js %PORT%
pause
