# One-shot: run register-rebuild-task.ps1 with UAC elevation.
# Temporary — safe to delete after the worker task is set up correctly.

$script = 'C:\Users\26371\Documents\MLocalCoding\judicial-law-search\scripts\register-rebuild-task.ps1'

Start-Process -FilePath 'powershell.exe' `
              -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$script `
              -Verb RunAs `
              -Wait

Write-Host "Elevated register-rebuild-task.ps1 exited. See logs\register-task.log for details."
