@echo off
REM =====================================================================
REM Worker invoked by the pre-authorized SYSTEM task
REM "JudicialLawSearchRebuild". Not meant to be run by hand.
REM
REM Flow:
REM   1. npm run build
REM   2. End main task + kill any node still holding :3000
REM   3. Start main task again
REM
REM Everything is logged to logs/rebuild.log.
REM =====================================================================

setlocal
set "PROJECT_DIR=C:\Users\26371\Documents\MLocalCoding\judicial-law-search"
set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
set "MAIN_TASK=JudicialLawSearch"
set "LOG=%PROJECT_DIR%\logs\rebuild.log"

cd /d "%PROJECT_DIR%"
if not exist "logs" mkdir "logs"

echo. >> "%LOG%"
echo [%date% %time%] ===== rebuild triggered ===== >> "%LOG%"

echo [%date% %time%] running npm run build ... >> "%LOG%"
call "%NPM_CMD%" run build >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] BUILD FAILED -- keeping old service running >> "%LOG%"
    exit /b 1
)

echo [%date% %time%] build OK, stopping main task >> "%LOG%"
schtasks /End /TN "%MAIN_TASK%" >> "%LOG%" 2>&1

REM Wait ~3s for the old node to release port 3000.
REM (timeout.exe needs a TTY which we don't have under SYSTEM task;
REM  ping is the classic workaround.)
ping -n 4 127.0.0.1 > nul

REM Belt and suspenders: taskkill anything still on :3000.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo [%date% %time%] killing lingering PID %%a >> "%LOG%"
    taskkill /F /PID %%a >> "%LOG%" 2>&1
)

echo [%date% %time%] starting main task >> "%LOG%"
schtasks /Run /TN "%MAIN_TASK%" >> "%LOG%" 2>&1
echo [%date% %time%] done >> "%LOG%"
endlocal
exit /b 0
