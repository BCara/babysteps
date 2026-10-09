$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$tailscaleOutput = & tailscale ip -4
if ($LASTEXITCODE -ne 0 -or -not $tailscaleOutput) {
  throw 'Tailscale must be connected before starting Metro.'
}
$tailscaleAddress = @($tailscaleOutput)[0].Trim()

$listener = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-Output 'Port 8081 is already in use. Leave the existing server running and verify its project before restarting it.'
  exit 0
}

$logDirectory = Join-Path $projectRoot '.codex/metro'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$logStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $tailscaleAddress
$nodePath = (Get-Command node.exe).Source
$expoPath = Join-Path $projectRoot 'node_modules/expo/bin/cli'
$metroProcess = Start-Process -FilePath $nodePath `
  -ArgumentList @(('"{0}"' -f $expoPath), 'start', '--dev-client', '--lan', '--port', '8081') `
  -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $logDirectory "$logStamp.stdout.log") `
  -RedirectStandardError (Join-Path $logDirectory "$logStamp.stderr.log")
Write-Output "Started Metro process $($metroProcess.Id) for $projectRoot."
Write-Output "Tailscale URL: http://${tailscaleAddress}:8081"
Write-Output "Logs: $logDirectory"
