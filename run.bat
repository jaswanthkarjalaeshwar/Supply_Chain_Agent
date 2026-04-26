@echo off
title Supply Chain Disruption Agent
cd /d "%~dp0"

:: ── Dependency check ────────────────────────────────────────────────────────
if not exist "node_modules\" (
    echo [setup] node_modules not found — running npm install...
    npm install
    if errorlevel 1 (
        echo [error] npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
)

:: ── .env check ───────────────────────────────────────────────────────────────
if not exist ".env" (
    echo [setup] .env not found — copying from .env.example...
    copy ".env.example" ".env" > nul
    echo [setup] Please open .env and add your OPENROUTER_API_KEY, then re-run.
    pause
    exit /b 1
)

:: Check if key is still empty (line reads "OPENROUTER_API_KEY=" with nothing after =)
findstr /r "^OPENROUTER_API_KEY=$" .env > nul 2>&1
if not errorlevel 1 (
    echo.
    echo  WARNING: OPENROUTER_API_KEY is not set in .env
    echo  Open .env and paste your OpenRouter API key, then re-run.
    echo.
    pause
)

:: ── Menu loop ─────────────────────────────────────────────────────────────────
:menu
cls
echo.
echo  ================================================
echo   Supply Chain Disruption Agent
echo  ================================================
echo.
echo   1.  Run single scan  (Port of Miami, live)
echo   2.  Replay last disruption  (no API call)
echo   3.  Start continuous monitor  (Ctrl+C to stop)
echo   4.  Open web dashboard  (browser + server)
echo   5.  Exit
echo.
set /p "choice=  Enter choice [1-5]: "

if "%choice%"=="1" goto single
if "%choice%"=="2" goto replay
if "%choice%"=="3" goto monitor
if "%choice%"=="4" goto web
if "%choice%"=="5" goto done
echo  Invalid choice — try again.
timeout /t 1 /nobreak > nul
goto menu

:single
echo.
node index.js
echo.
echo  ── Scan complete ──
pause
goto menu

:replay
echo.
node index.js --replay
echo.
pause
goto menu

:monitor
echo.
echo  Starting continuous monitor (Ctrl+C to stop)...
echo.
node index.js --monitor
echo.
echo  Monitor stopped.
pause
goto menu

:web
echo.
echo  Starting web dashboard...
start "Supply Chain Web Dashboard" node src/web/server.js
timeout /t 2 /nobreak > nul
start "" http://localhost:3000
echo.
echo  Dashboard is running in a separate window.
echo  Close that console window to stop the server.
echo.
pause
goto menu

:done
exit /b 0
