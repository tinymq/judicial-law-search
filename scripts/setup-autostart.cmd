@echo off
REM =====================================================================
REM One-shot installer: registers the boot-time scheduled task and opens
REM TCP port 3000 in Windows Firewall for judicial-law-search.
REM Run this file as Administrator (right-click -> Run as administrator).
REM Safe to re-run: both operations overwrite the previous entry.
REM =====================================================================

setlocal

REM --- check admin -----------------------------------------------------
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] This installer must run as Administrator.
    echo Right-click the file and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

set "TASK_NAME=JudicialLawSearch"
set "REBUILD_TASK=JudicialLawSearchRebuild"
set "PROJECT_DIR=C:\Users\26371\Documents\MLocalCoding\judicial-law-search"
set "CMD_PATH=%PROJECT_DIR%\scripts\start-server.cmd"
set "WORKER_PATH=%PROJECT_DIR%\scripts\rebuild-worker.cmd"
set "FW_RULE=JudicialLawSearch 3000 TCP"

echo.
echo === Registering main scheduled task "%TASK_NAME%" ===
schtasks /Create /TN "%TASK_NAME%" /TR "\"%CMD_PATH%\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
if errorlevel 1 (
    echo [ERROR] Failed to register main scheduled task.
    pause
    exit /b 1
)

echo.
echo === Registering rebuild worker task "%REBUILD_TASK%" ===
REM On-demand task with no trigger (fired only via /Run from the git hook).
REM Uses PowerShell's Register-ScheduledTask cmdlet because schtasks.exe
REM requires a /SC trigger and the date format /SD is locale-sensitive.
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\register-rebuild-task.ps1"
if errorlevel 1 (
    echo [ERROR] Failed to register rebuild worker task.
    pause
    exit /b 1
)

echo.
echo === Adding Windows Firewall inbound rule (TCP 3000) ===
netsh advfirewall firewall delete rule name="%FW_RULE%" >nul 2>&1
netsh advfirewall firewall add rule name="%FW_RULE%" dir=in action=allow protocol=TCP localport=3000 profile=any
if errorlevel 1 (
    echo [ERROR] Failed to add firewall rule.
    pause
    exit /b 1
)

echo.
echo === Starting the task now (so you don't need to reboot) ===
schtasks /Run /TN "%TASK_NAME%"

echo.
echo =====================================================================
echo  Done.
echo  - Task "%TASK_NAME%" will run on every boot under SYSTEM account.
echo  - Task "%REBUILD_TASK%" is pre-authorized; git hooks trigger it
echo    after every `git pull` so production rebuild is fully automated.
echo  - Port 3000 is open on all network profiles.
echo  - Server log:  %PROJECT_DIR%\logs\server.log
echo  - Rebuild log: %PROJECT_DIR%\logs\rebuild.log
echo  - To stop:   schtasks /End /TN %TASK_NAME%
echo  - To remove: run scripts\remove-autostart.cmd as Administrator
echo =====================================================================
echo.
pause
