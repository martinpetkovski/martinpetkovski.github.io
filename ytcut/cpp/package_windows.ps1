[CmdletBinding()]
param(
  [ValidateSet('Debug','Release')]
  [string]$Configuration = 'Release'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$outDir = Join-Path $repoRoot 'ytcut\downloads'
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ytcut_pkg_" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

function Download-File([string]$Url, [string]$Dest) {
  Write-Host "Downloading: $Url"
  Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
}

try {
  # 1) Build ytcut.exe
  Write-Host "Building ytcut.exe ($Configuration)..."
  & (Join-Path $PSScriptRoot 'build_windows.ps1') -Configuration $Configuration -OutDir $tempDir

  # 2) Download yt-dlp.exe (official GitHub release)
  $ytdlpExe = Join-Path $tempDir 'yt-dlp.exe'
  Download-File 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' $ytdlpExe

  # 3) Download ffmpeg (gyan.dev full build zip) and extract ffmpeg.exe + LICENSE
  $ffZip = Join-Path $tempDir 'ffmpeg.zip'
  Download-File 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' $ffZip

  $ffExtract = Join-Path $tempDir 'ffmpeg_extract'
  New-Item -ItemType Directory -Force -Path $ffExtract | Out-Null
  Expand-Archive -Path $ffZip -DestinationPath $ffExtract -Force

  $ffmpegExe = Get-ChildItem -Path $ffExtract -Recurse -Filter ffmpeg.exe -File | Select-Object -First 1
  if (-not $ffmpegExe) { throw 'Could not find ffmpeg.exe inside the downloaded archive.' }
  Copy-Item -Force $ffmpegExe.FullName (Join-Path $tempDir 'ffmpeg.exe')

  # Grab license/readme files if present
  $licenseFiles = Get-ChildItem -Path $ffExtract -Recurse -File -Include 'LICENSE*','COPYING*','README*' -ErrorAction SilentlyContinue
  $licensesOut = Join-Path $tempDir 'licenses'
  New-Item -ItemType Directory -Force -Path $licensesOut | Out-Null
  foreach ($f in $licenseFiles) {
    Copy-Item -Force $f.FullName (Join-Path $licensesOut $f.Name)
  }

  # 4) Add yt-dlp license text (raw) as best-effort
  $ytdlpLicense = Join-Path $licensesOut 'yt-dlp-LICENSE.txt'
  try {
    $txt = Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/yt-dlp/yt-dlp/master/LICENSE' -UseBasicParsing
    $txt.Content | Out-File -FilePath $ytdlpLicense -Encoding utf8
  } catch {
    'yt-dlp license could not be fetched automatically. See https://github.com/yt-dlp/yt-dlp' | Out-File -FilePath $ytdlpLicense -Encoding utf8
  }

  # 5) Bundle zip (single download, no extra installs)
  $bundleZip = Join-Path $outDir 'ytcut-win64.zip'
  if (Test-Path $bundleZip) { Remove-Item -Force $bundleZip }

  $bundleRoot = Join-Path $tempDir 'bundle'
  New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null

  Copy-Item -Force (Join-Path $tempDir 'ytcut.exe') (Join-Path $bundleRoot 'ytcut.exe')
  Copy-Item -Force (Join-Path $tempDir 'yt-dlp.exe') (Join-Path $bundleRoot 'yt-dlp.exe')
  Copy-Item -Force (Join-Path $tempDir 'ffmpeg.exe') (Join-Path $bundleRoot 'ffmpeg.exe')

  if (Test-Path $licensesOut) {
    Copy-Item -Recurse -Force $licensesOut (Join-Path $bundleRoot 'licenses')
  }

  # Also include your own C++ README for usage.
  Copy-Item -Force (Join-Path $PSScriptRoot 'README.md') (Join-Path $bundleRoot 'README.md')

  Compress-Archive -Path (Join-Path $bundleRoot '*') -DestinationPath $bundleZip
  Write-Host "Wrote: $bundleZip"
} finally {
  if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
  }
}
