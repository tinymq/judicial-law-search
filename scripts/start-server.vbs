' Silent launcher for judicial-law-search.
' Runs start-server.cmd with a hidden window so nothing appears on the desktop.
' Entry point for the Windows Task Scheduler auto-start task.

Set WshShell = CreateObject("WScript.Shell")
cmdPath = "C:\Users\26371\Documents\MLocalCoding\judicial-law-search\scripts\start-server.cmd"
' Run with window style 0 (hidden) and do not wait for it to finish.
WshShell.Run Chr(34) & cmdPath & Chr(34), 0, False
