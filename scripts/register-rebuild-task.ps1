# Registers the on-demand rebuild worker task using the PowerShell
# ScheduledTasks module. Unlike schtasks.exe this handles "no trigger"
# tasks natively and is immune to the locale-dependent date parsing
# that broke /SD 01/01/2099 on zh-CN Windows.
#
# Must run as Administrator.

$ErrorActionPreference = 'Stop'

$taskName   = 'JudicialLawSearchRebuild'
$workerPath = 'C:\Users\26371\Documents\MLocalCoding\judicial-law-search\scripts\rebuild-worker.cmd'

# Mirror all host output to a log so we can diagnose even when the
# elevated console window closes before we can read it.
$logDir  = 'C:\Users\26371\Documents\MLocalCoding\judicial-law-search\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logPath = Join-Path $logDir 'register-task.log'
Start-Transcript -Path $logPath -Append -IncludeInvocationHeader | Out-Null

$action    = New-ScheduledTaskAction -Execute $workerPath
$principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -RunLevel Highest  # S-1-5-18 = LocalSystem
$settings  = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName   $taskName `
    -Action     $action `
    -Principal  $principal `
    -Settings   $settings `
    -Description 'Rebuilds production bundle and restarts main service. Invoked on demand by git hooks.' `
    -Force | Out-Null

Write-Host "Registered scheduled task: $taskName"

# Grant BUILTIN\Users Read+Execute on the task so non-admins can /Run it
# (required because the git post-merge hook runs under the user session,
#  not elevated). The task still EXECUTES as SYSTEM.
#
# SDDL breakdown:
#   D:(A;;GA;;;SY)   -> SYSTEM                  : GenericAll
#   (A;;GA;;;BA)     -> BUILTIN\Administrators  : GenericAll
#   (A;;GRGX;;;BU)   -> BUILTIN\Users           : Read + Execute
$sddl = 'D:(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGX;;;BU)'

$ts = New-Object -ComObject 'Schedule.Service'
$ts.Connect()
$folder = $ts.GetFolder('\')
# IRegisteredTask.SetSecurityDescriptor(sddl, flags)
# NB: ITaskFolder has its own SetSecurityDescriptor for the folder level,
# but to change a specific task we must resolve the task first.
$registeredTask = $folder.GetTask($taskName)
$registeredTask.SetSecurityDescriptor($sddl, 0)

# The SDDL above updates the task object's internal security descriptor,
# but schtasks /Run also needs NTFS Read+Execute on the underlying XML
# file under C:\Windows\System32\Tasks\. By default only SYSTEM and
# Administrators have access — we need to add BUILTIN\Users here too.
# Using the SID directly avoids zh-CN vs en-US group-name differences
# (e.g. "Users" vs "用户").
$xmlPath = Join-Path $env:WINDIR "System32\Tasks\$taskName"
Write-Host "Task XML path: $xmlPath"
Write-Host "Exists:        $(Test-Path $xmlPath)"

# Run icacls and capture BOTH stdout and stderr so we can see the outcome.
$icaclsOutput = (& icacls $xmlPath /grant '*S-1-5-32-545:(RX)' 2>&1) -join "`n"
Write-Host '--- icacls output ---'
Write-Host $icaclsOutput
Write-Host '--- end icacls output ---'

# Verify by listing the new ACL
$verifyOutput = (& icacls $xmlPath 2>&1) -join "`n"
Write-Host '--- verify ACL ---'
Write-Host $verifyOutput
Write-Host '--- end verify ---'

Write-Host "Done."
Stop-Transcript | Out-Null
