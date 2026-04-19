@echo off
REM =====================================================================
REM Non-admin trigger for the rebuild worker.
REM
REM Regular users can /Run an existing SYSTEM task, they just can't
REM /Create, /End or /Delete one. So this file simply asks Windows to
REM run the pre-authorized worker task and returns immediately.
REM
REM Called automatically by .git/hooks/post-merge after every git pull.
REM You can also run it manually by double-clicking.
REM =====================================================================

schtasks /Run /TN "JudicialLawSearchRebuild"
