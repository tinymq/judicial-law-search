# One-shot helper: trigger a UAC prompt and run setup-autostart.cmd
# as Administrator, then wait for it to finish.
# Temporary — safe to delete after setup succeeds.

$script = 'C:\Users\26371\Documents\MLocalCoding\judicial-law-search\scripts\setup-autostart.cmd'

Start-Process -FilePath 'cmd.exe' `
              -ArgumentList '/c', $script `
              -Verb RunAs `
              -Wait

Write-Host "Elevated process exited."
