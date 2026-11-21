# Signs the native app for the stores, on the owner's own PC. The signing key never leaves this PC.
# Double-click SIGNER.bat (it runs this file). Output: <App>-v2-google-play.aab and <App>-v2-amazon.apk.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
function Say($text, $color = 'White') { Write-Host $text -ForegroundColor $color }
function Fail($text) { Say ''; Say $text 'Red'; exit 1 }

$aab = Get-ChildItem -Path "$here\*" -Include '*-a-signer.aab' -File | Select-Object -First 1
$apk = Get-ChildItem -Path "$here\*" -Include '*-a-signer.apk' -File | Select-Object -First 1
if (-not $aab -or -not $apk) { Fail "Les fichiers *-a-signer.aab et *-a-signer.apk doivent être dans ce dossier. Décompressez tout le ZIP téléchargé de GitHub ici." }
$app = $aab.Name -replace '-a-signer\.aab$', ''
Say "Signature de l'application $app pour Google Play et Amazon" 'Cyan'
Say ''

# 1. Java (gratuit). jarsigner et keytool viennent avec Java.
$java = Get-Command java -ErrorAction SilentlyContinue
$bin = $null
if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\jarsigner.exe")) { $bin = "$env:JAVA_HOME\bin" }
elseif ($java) { $bin = Split-Path $java.Source }
if (-not $bin -or -not (Test-Path "$bin\jarsigner.exe")) {
  Start-Process 'https://adoptium.net/temurin/releases/?version=17&package=jdk&os=windows'
  Fail "Java (JDK 17) n'est pas installé. La page de téléchargement gratuite vient de s'ouvrir : prenez le fichier .msi pour Windows, installez-le (cochez « Set JAVA_HOME »), puis double-cliquez de nouveau sur SIGNER.bat."
}
$javaExe = "$bin\java.exe"; $jarsigner = "$bin\jarsigner.exe"; $keytool = "$bin\keytool.exe"

# 2. La clé de signature : un fichier .keystore ou .jks dans ce dossier, sinon on vous le demande.
$ks = Get-ChildItem -Path "$here\*" -Include '*.keystore', '*.jks' -File | Select-Object -First 1
if (-not $ks) {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = "Choisissez votre clé de signature $app (fichier .keystore, par exemple signing.keystore du ZIP PWABuilder)"
  $dialog.Filter = 'Clé de signature (*.keystore;*.jks)|*.keystore;*.jks'
  if ($dialog.ShowDialog() -eq 'OK') { $ks = Get-Item $dialog.FileName }
}
$alias = $null; $storePass = $null; $keyPass = $null
if (-not $ks) {
  $answer = Read-Host "Aucune clé choisie. Créer une NOUVELLE clé pour $app ? Seulement si l'application n'est pas encore sur Google Play (O/N)"
  if ($answer -notmatch '^[oOyY]') { Fail 'Arrêt : aucune clé.' }
  $secure = Read-Host 'Choisissez un mot de passe pour la nouvelle clé (12 caractères ou plus)' -AsSecureString
  $storePass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  if ($storePass.Length -lt 12) { Fail 'Mot de passe trop court.' }
  $keyPass = $storePass; $alias = 'upload'
  $path = Join-Path $here "$app-upload.keystore"
  $env:TK_STORE_PASS = $storePass
  & $keytool -genkeypair -keystore $path -alias $alias -keyalg RSA -keysize 2048 -validity 10000 -storepass:env TK_STORE_PASS -keypass:env TK_STORE_PASS -dname "CN=$app"
  if ($LASTEXITCODE -ne 0) { Fail 'La clé n''a pas pu être créée.' }
  $ks = Get-Item $path
  Say ''
  Say "Nouvelle clé créée : $($ks.FullName)" 'Yellow'
  Say 'IMPORTANT : gardez une copie de ce fichier et de son mot de passe en lieu sûr (clé USB). Sans eux, impossible de publier une mise à jour.' 'Yellow'
}

# 3. Alias et mots de passe : lus dans signing-key-info.txt (à côté de la clé) s'il existe, sinon demandés.
$info = Join-Path $ks.DirectoryName 'signing-key-info.txt'
if (-not $alias -and (Test-Path $info)) {
  $text = Get-Content $info -Raw
  if ($text -match '(?im)^\s*key\s*alias\s*:\s*(.+?)\s*$') { $alias = $Matches[1] }
  if ($text -match '(?im)^\s*key\s*store\s*password\s*:\s*(.+?)\s*$') { $storePass = $Matches[1] }
  if ($text -match '(?im)^\s*key\s*password\s*:\s*(.+?)\s*$') { $keyPass = $Matches[1] }
}
if (-not $alias) { $alias = Read-Host "Nom de l'alias de la clé (Entrée = my-key-alias)"; if (-not $alias) { $alias = 'my-key-alias' } }
if (-not $storePass) {
  $secure = Read-Host 'Mot de passe de la clé' -AsSecureString
  $storePass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if (-not $keyPass) { $keyPass = $storePass }
$env:TK_STORE_PASS = $storePass; $env:TK_KEY_PASS = $keyPass

# 4. Signature.
$playOut = Join-Path $here "$app-v2-google-play.aab"
$amazonOut = Join-Path $here "$app-v2-amazon.apk"
Say 'Signature du fichier Google Play (.aab)...'
& $jarsigner -keystore $ks.FullName -storepass:env TK_STORE_PASS -keypass:env TK_KEY_PASS -sigalg SHA256withRSA -digestalg SHA-256 -signedjar $playOut $aab.FullName $alias | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'La signature du .aab a échoué. Vérifiez le mot de passe et l''alias.' }
Say 'Signature du fichier Amazon (.apk)...'
& $javaExe -jar (Join-Path $here 'apksigner.jar') sign --ks $ks.FullName --ks-key-alias $alias --ks-pass env:TK_STORE_PASS --key-pass env:TK_KEY_PASS --out $amazonOut $apk.FullName
if ($LASTEXITCODE -ne 0) { Fail 'La signature du .apk a échoué. Vérifiez le mot de passe et l''alias.' }
& $javaExe -jar (Join-Path $here 'apksigner.jar') verify $amazonOut
if ($LASTEXITCODE -ne 0) { Fail 'Le .apk signé ne passe pas la vérification.' }
Remove-Item Env:TK_STORE_PASS, Env:TK_KEY_PASS -ErrorAction SilentlyContinue
Remove-Item (Join-Path $here '*.idsig') -ErrorAction SilentlyContinue

Say ''
Say 'Terminé.' 'Green'
Say "  Google Play : $playOut"
Say "  Amazon      : $amazonOut"
Say 'Ces deux fichiers restent sur ce PC. Téléversez-les dans la console de chaque magasin.'
Start-Process explorer.exe $here
