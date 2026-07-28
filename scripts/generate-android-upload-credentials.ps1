$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$credentialsDirectory = Join-Path $projectRoot '.release-credentials'
$keystorePath = Join-Path $credentialsDirectory 'babysteps-upload.jks'
$recoveryPath = Join-Path $credentialsDirectory 'RECOVERY.txt'
$easCredentialsPath = Join-Path $projectRoot 'credentials.json'

if (
  (Test-Path -LiteralPath $keystorePath) -or
  (Test-Path -LiteralPath $recoveryPath) -or
  (Test-Path -LiteralPath $easCredentialsPath)
) {
  throw 'Release credentials already exist. No files were overwritten.'
}

New-Item -ItemType Directory -Path $credentialsDirectory -Force | Out-Null

$passwordBytes = New-Object byte[] 32
$randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$randomNumberGenerator.GetBytes($passwordBytes)
$randomNumberGenerator.Dispose()
$password = [Convert]::ToBase64String($passwordBytes)
$alias = 'babysteps-upload'

$keytool = Get-Command keytool.exe -ErrorAction Stop
& $keytool.Source `
  -genkeypair `
  -v `
  -keystore $keystorePath `
  -storepass $password `
  -keypass $password `
  -alias $alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -dname 'CN=BabySteps Upload, OU=Mobile, O=BabySteps, L=Sydney, ST=NSW, C=AU'

if ($LASTEXITCODE -ne 0) {
  throw "keytool failed with exit code $LASTEXITCODE."
}

$credentials = @{
  android = @{
    keystore = @{
      keystorePath = '.release-credentials/babysteps-upload.jks'
      keystorePassword = $password
      keyAlias = $alias
      keyPassword = $password
    }
  }
} | ConvertTo-Json -Depth 4

$recovery = @"
BabySteps Android upload key

Created: $((Get-Date).ToString('o'))
Package: com.babysteps.app
Key alias: $alias
Keystore password: $password
Key password: $password
Keystore: $keystorePath

Store this keystore and these passwords in a secure password manager or encrypted
backup before the first Play upload. Losing the upload key creates a recovery
process and can delay releases. Never commit this file.
"@

$utf8NoBom = New-Object Text.UTF8Encoding $false
[IO.File]::WriteAllText($easCredentialsPath, $credentials, $utf8NoBom)
[IO.File]::WriteAllText($recoveryPath, $recovery, $utf8NoBom)

Write-Output "Created local EAS credentials at $easCredentialsPath."
Write-Output "Created upload keystore at $keystorePath."
Write-Output "Created a recovery record at $recoveryPath."
Write-Output 'No passwords were printed.'
