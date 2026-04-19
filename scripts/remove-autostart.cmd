@echo off
REM =====================================================================
REM Uninstaller: removes the boot-time scheduled task and the firewall
REM rule created by setup-autostart.cmd.
REM Run this file as Administrator (right-click -> Run as administrator).
REM Safe to re-run: missing items are reported but ignored.
REM =====================================================================

setlocal

REM --- check admin -----------------------------------------------------
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] This uninstaller must run as Administrator.
    echo Right-click the file and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

set "TASK_NAME=JudicialLawSearch"
set "REBUILD_TASK=JudicialLawSearchRebuild"
set "FW_RULE=JudicialLawSearch 3000 TCP"

echo.
echo === Stopping task "%TASK_NAME%" (if running) ===
schtasks /End /TN "%TASK_NAME%" >nul 2>&1

echo.
echo === Deleting scheduled task "%TASK_NAME%" ===
schtasks /Delete /TN "%TASK_NAME%" /F
if errorlevel 1 (
    echo [WARN] Main task did not exist or could not be deleted.
)

echo.
echo === Deleting rebuild worker task "%REBUILD_TASK%" ===
schtasks /End /TN "%REBUILD_TASK%" >nul 2>&1
schtasks /Delete /TN "%REBUILD_TASK%" /F
if errorlevel 1 (
    echo [WARN] Rebuild worker task did not exist or could not be deleted.
)

echo.
echo === Removing Windows Firewall rule "%FW_RULE%" ===
netsh advfirewall firewall delete rule name="%FW_RULE%"
if errorlevel 1 (
    echo [WARN] Firewall rule did not exist or could not be deleted.
)

echo.
echo === Killing any lingering node.exe on port 3000 ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo Killing PID %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo =====================================================================
echo  Uninstall complete.
echo  Note: the scripts themselves (start-server.cmd/.vbs/.js) are kept
echo        so you can still start manually. Delete them by hand if you
echo        no longer need them.
echo =====================================================================
echo.
pause
