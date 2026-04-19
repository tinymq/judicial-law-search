@echo off
REM Auto-start loop for judicial-law-search (port 3000, LAN accessible)
REM Invoked by start-server.vbs (hidden window) via Windows Task Scheduler.

setlocal
set "PROJECT_DIR=C:\Users\26371\Documents\MLocalCoding\judicial-law-search"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "PORT=3000"

cd /d "%PROJECT_DIR%"
if not exist "logs" mkdir "logs"

:loop
echo [%date% %time%] starting server >> "logs\server.log"
"%NODE_EXE%" scripts\start-server.js >> "logs\server.log" 2>&1
echo [%date% %time%] server exited, restarting in 5s >> "logs\server.log"
timeout /t 5 /nobreak > nul
goto loop
