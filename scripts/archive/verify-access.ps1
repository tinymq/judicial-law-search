# Verifies whether the local service on port 3000 is reachable via the
# same code path a browser would take (WinINET / system proxy).
# Temporary diagnostic — safe to delete.

$targets = @(
    'http://127.0.0.1:3000/',
    'http://localhost:3000/',
    'http://192.168.1.16:3000/'
)

foreach ($url in $targets) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 6
        Write-Host ("{0,-32} -> HTTP {1}  bytes={2}" -f $url, $r.StatusCode, $r.RawContentLength)
    } catch {
        Write-Host ("{0,-32} -> FAIL: {1}" -f $url, $_.Exception.Message)
    }
}

Write-Host ""
Write-Host "-- System proxy settings --"
$reg = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
Write-Host ("ProxyEnable = {0}" -f $reg.ProxyEnable)
Write-Host ("ProxyServer = {0}" -f $reg.ProxyServer)
Write-Host ("ProxyOverride present = {0}" -f ($null -ne $reg.ProxyOverride))
if ($reg.ProxyOverride) {
    $hasLan = ($reg.ProxyOverride -match '192\.168')
    Write-Host ("ProxyOverride contains 192.168 = {0}" -f $hasLan)
}
