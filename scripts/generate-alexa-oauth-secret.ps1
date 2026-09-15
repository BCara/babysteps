$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$credentialDirectory = Join-Path $projectRoot '.release-credentials'
$secretPath = Join-Path $credentialDirectory 'alexa-oauth-client-secret.txt'

if (Test-Path -LiteralPath $secretPath) {
  Write-Output "Alexa OAuth client secret already exists at $secretPath"
  exit 0
}

New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
$bytes = [byte[]]::new(48)
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $generator.GetBytes($bytes)
} finally {
  $generator.Dispose()
}
$secret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
[System.IO.File]::WriteAllText($secretPath, $secret, [System.Text.Encoding]::ASCII)
Write-Output "Created the Alexa OAuth client secret at $secretPath"
