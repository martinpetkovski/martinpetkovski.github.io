param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Apps {
  try {
    Get-Process |
      Where-Object { $_.Path -like '*NS2 Editor-win32-x64*' -or $_.Path -like '*NS2 Reader-win32-x64*' -or $_.ProcessName -like '*NS2*' -or $_.ProcessName -like '*electron*' } |
      Stop-Process -Force -ErrorAction SilentlyContinue
  } catch {}
}

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) { [void](New-Item -ItemType Directory -Force -Path $path) }
}

function Clear-DirContents($path, $keepNames = @()) {
  if (-not (Test-Path $path)) { return }
  Get-ChildItem -Force $path |
    Where-Object { $keepNames -notcontains $_.Name } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

function Copy-Assets($appOutPath, $srcRoot, $assets) {
  $res = Join-Path $appOutPath 'resources'
  $dst = Join-Path $res 'ns2'
  Ensure-Dir $dst
  foreach ($f in $assets) {
    $src = Join-Path $srcRoot $f
    if (Test-Path $src) { Copy-Item -Force $src -Destination (Join-Path $dst $f) }
  }
}

$Ns2Root = $PSScriptRoot
$RepoRoot = Split-Path -Parent $PSScriptRoot

$EditorDir = Join-Path $Ns2Root 'electron-editor'
$ReaderDir = Join-Path $Ns2Root 'electron-reader'

# Use a fresh, unique pack output each run to avoid file locks
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$PackRoot = Join-Path 'C:\ns2-build\pack' $timestamp
$PackEditorOutRoot = Join-Path $PackRoot 'editor'
$PackReaderOutRoot = Join-Path $PackRoot 'reader'
Ensure-Dir $PackEditorOutRoot
Ensure-Dir $PackReaderOutRoot

$EditorOut = Join-Path $PackEditorOutRoot 'NS2 Editor-win32-x64'
$ReaderOut = Join-Path $PackReaderOutRoot 'NS2 Reader-win32-x64'

$BuildDir  = Join-Path $Ns2Root 'build'
$BundleDir = Join-Path $BuildDir 'NS2-bundle'
$ZipPath   = Join-Path $BuildDir 'ns2-windows-x64.zip'

Write-Host "== Stopping running apps to release file locks =="
Stop-Apps
Start-Sleep -Milliseconds 300

Write-Host "== Clearing build folder fully =="
Ensure-Dir $BuildDir
Clear-DirContents -path $BuildDir -keepNames @('build-all.ps1')
Ensure-Dir $BundleDir

Write-Host "== Removing previous app outputs (legacy) =="
Remove-Item -Recurse -Force (Join-Path $EditorDir 'out') -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $ReaderDir 'out') -ErrorAction SilentlyContinue
try { if (Test-Path 'C:\ns2-build\pack') { Remove-Item -Recurse -Force 'C:\ns2-build\pack' } } catch {}
Ensure-Dir $PackEditorOutRoot
Ensure-Dir $PackReaderOutRoot
Start-Sleep -Milliseconds 300

Write-Host "== Building Editor (portable) =="
Push-Location $EditorDir
npm install
npx electron-packager . "NS2 Editor" --platform=win32 --arch=x64 --out="$PackEditorOutRoot" --overwrite --icon=../icon_transparent.png --asar
Pop-Location

Write-Host "== Building Reader (portable) =="
Push-Location $ReaderDir
npm install
npx electron-packager . "NS2 Reader" --platform=win32 --arch=x64 --out="$PackReaderOutRoot" --overwrite --icon=../icon_reader.ico --asar
Pop-Location

Write-Host "== Copying runtime assets into packaged apps =="
$commonAssets = @('NSE2.js','NSE2.wasm','style.css','icon_transparent.png','languages.json','ai.html','about.html','guide.html','play.js')
Copy-Assets -appOutPath $EditorOut -srcRoot $Ns2Root -assets (@('editor.html','reader.html') + $commonAssets)
Copy-Assets -appOutPath $ReaderOut -srcRoot $Ns2Root -assets (@('reader.html') + $commonAssets + @('icon_reader.ico'))

Write-Host "== Preparing combined bundle =="
Ensure-Dir $BundleDir
# clean previous contents
Get-ChildItem -Force $BundleDir | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force $EditorOut (Join-Path $BundleDir 'NS2 Editor-win32-x64')
Copy-Item -Recurse -Force $ReaderOut (Join-Path $BundleDir 'NS2 Reader-win32-x64')

Write-Host "== Creating combined zip =="
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
# To avoid transient file locks, zip from a temp copy
$tempRoot = 'C:\ns2-build\zip\bundle'
try { if (Test-Path $tempRoot) { Remove-Item -Recurse -Force $tempRoot } } catch {}
Ensure-Dir (Split-Path -Parent $tempRoot)
Copy-Item -Recurse -Force $BundleDir $tempRoot
Compress-Archive -Path $tempRoot -DestinationPath $ZipPath -Force

Write-Host "== Bundle created: $ZipPath =="

# Cleanup temporary pack root
try { if (Test-Path $PackRoot) { Remove-Item -Recurse -Force $PackRoot } } catch {}
