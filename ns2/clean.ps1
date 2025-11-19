Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function SafeRemove($path) {
  try { if (Test-Path $path) { Remove-Item -Recurse -Force $path } } catch {}
}

$Ns2Root = $PSScriptRoot
$RepoRoot = Split-Path -Parent $PSScriptRoot
$editor = Join-Path $Ns2Root 'electron-editor'
$reader = Join-Path $Ns2Root 'electron-reader'
$build  = Join-Path $Ns2Root 'build'

Write-Host '== Cleaning app output folders =='
SafeRemove (Join-Path $editor 'out')
SafeRemove (Join-Path $editor 'dist')
SafeRemove (Join-Path $editor 'release')
SafeRemove (Join-Path $reader 'out')
SafeRemove (Join-Path $reader 'dist')
SafeRemove (Join-Path $reader 'release')

Write-Host '== Removing older per-app zips (keeps combined zips) =='
$editorZip = Join-Path $editor 'NS2-Editor-win64.zip'
$readerZip = Join-Path $reader 'NS2-Reader-win64.zip'
SafeRemove $editorZip
SafeRemove $readerZip

Write-Host '== Cleaning temp build roots under C:\ns2-build =='
SafeRemove 'C:\ns2-build\pack'
# Keep portable temp only if a build is running; usually safe to clear
SafeRemove 'C:\ns2-build\portable'
SafeRemove 'C:\ns2-build\zip'

Write-Host '== Preserving final artifacts in build folder =='
Write-Host ("  Keeping: {0}" -f (Join-Path $build 'portable'))
Write-Host ("  Keeping: {0}" -f (Join-Path $build 'ns2-windows-x64.zip'))
Write-Host ("  Keeping: {0}" -f (Join-Path $build 'ns2-portable-exes.zip'))
