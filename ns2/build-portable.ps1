param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Apps {
  try {
    Get-Process |
      Where-Object { $_.ProcessName -like '*NS2*' -or $_.ProcessName -like '*electron*' } |
      Stop-Process -Force -ErrorAction SilentlyContinue
  } catch {}
}

function Ensure-Dir($p){ if (-not (Test-Path $p)) { [void](New-Item -ItemType Directory -Force -Path $p) } }

$Ns2Root = $PSScriptRoot
$RepoRoot = Split-Path -Parent $PSScriptRoot
$editor = Join-Path $Ns2Root 'electron-editor'
$reader = Join-Path $Ns2Root 'electron-reader'
$buildDir = Join-Path $Ns2Root 'build'
$outDir = Join-Path $buildDir 'portable'
$zipPath = Join-Path $buildDir 'ns2-portable-exes.zip'
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$ebOutEditor = Join-Path 'C:\ns2-build\portable' ("editor_" + $ts)
$ebOutReader = Join-Path 'C:\ns2-build\portable' ("reader_" + $ts)
Ensure-Dir (Split-Path -Parent $ebOutEditor)

Write-Host '== Preparing output folder =='
Ensure-Dir $buildDir
Get-ChildItem -Force $outDir -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Ensure-Dir $outDir

Write-Host '== Stopping running apps =='
Stop-Apps
Start-Sleep -Milliseconds 300

# Disable code signing auto-discovery explicitly
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$env:WIN_CSC_LINK = ''
$env:CSC_LINK = ''

Write-Host '== Building Editor portable EXE =='
Push-Location $editor
npm install
try { if (Test-Path $ebOutEditor) { Remove-Item -Recurse -Force $ebOutEditor } } catch {}
npx electron-builder --win portable --config.directories.output="$ebOutEditor"
Pop-Location

Write-Host '== Building Reader portable EXE =='
Push-Location $reader
npm install
try { if (Test-Path $ebOutReader) { Remove-Item -Recurse -Force $ebOutReader } } catch {}
npx electron-builder --win portable --config.directories.output="$ebOutReader"
Pop-Location

# Locate generated portable EXEs
$editorPortable = Get-ChildItem -Path $ebOutEditor -Recurse -Filter '*.exe' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$readerPortable = Get-ChildItem -Path $ebOutReader -Recurse -Filter '*.exe' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $editorPortable -or -not $readerPortable) { throw 'Portable EXEs not found. Check build logs.' }

Copy-Item -Force $editorPortable.FullName (Join-Path $outDir 'NS2-Editor-portable.exe')
Copy-Item -Force $readerPortable.FullName (Join-Path $outDir 'NS2-Reader-portable.exe')

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $outDir '*') -DestinationPath $zipPath -Force

Write-Host "== Portable EXEs created in: $outDir =="
Write-Host "== Zip: $zipPath =="

# Cleanup temporary electron-builder output dirs
try { if (Test-Path $ebOutEditor) { Remove-Item -Recurse -Force $ebOutEditor } } catch {}
try { if (Test-Path $ebOutReader) { Remove-Item -Recurse -Force $ebOutReader } } catch {}