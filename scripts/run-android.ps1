param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $ExpoArgs
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$credentialsPath = Join-Path $projectRoot 'credentials.json'

if (-not (Test-Path -LiteralPath $credentialsPath)) {
  throw "credentials.json was not found. The local Android signing configuration is required by the generated project."
}

$releaseCredentials = Get-Content -LiteralPath $credentialsPath -Raw | ConvertFrom-Json
$keystore = $releaseCredentials.android.keystore

$env:BABYSTEPS_KEYSTORE_PATH = (Resolve-Path -LiteralPath (Join-Path $projectRoot $keystore.keystorePath)).Path
$env:BABYSTEPS_KEYSTORE_PASSWORD = $keystore.keystorePassword
$env:BABYSTEPS_KEY_ALIAS = $keystore.keyAlias
$env:BABYSTEPS_KEY_PASSWORD = $keystore.keyPassword

& npx.cmd expo run:android @ExpoArgs
exit $LASTEXITCODE
