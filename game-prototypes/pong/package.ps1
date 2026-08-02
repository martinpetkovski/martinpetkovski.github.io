[CmdletBinding()]
param(
    [string]$Version = '2013'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectDirectory = $PSScriptRoot
$buildScript = Join-Path $projectDirectory 'build.ps1'
$releaseDirectory = Join-Path $projectDirectory 'build\Release'
$distDirectory = Join-Path $projectDirectory 'dist'
$stagingRoot = Join-Path $projectDirectory 'package-staging'
$packageName = "pong-$Version-windows-x64"
$stagingDirectory = Join-Path $stagingRoot $packageName
$zipPath = Join-Path $distDirectory "$packageName.zip"

Write-Host 'Building the Release executable...'
& $buildScript -Configuration Release
if ($LASTEXITCODE -ne 0) {
    throw "Release build failed with exit code $LASTEXITCODE."
}

$requiredFiles = @(
    'pong.exe',
    'skola.otf',
    'ball.png',
    'bat.png',
    'menu_music.wav',
    'thejohn.wav',
    'dang.wav',
    'hs.sav'
)
foreach ($filename in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $releaseDirectory $filename))) {
        throw "Required package file is missing: $filename"
    }
}

if (Test-Path -LiteralPath $stagingRoot) {
    $resolvedStaging = (Resolve-Path -LiteralPath $stagingRoot).Path
    $expectedStaging = [IO.Path]::GetFullPath($stagingRoot)
    if ($resolvedStaging -ne $expectedStaging -or -not $resolvedStaging.StartsWith($projectDirectory, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove unexpected staging path: $resolvedStaging"
    }
    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
}
New-Item -ItemType Directory -Force $stagingDirectory, $distDirectory | Out-Null

Write-Host 'Collecting executable, Allegro dependencies, and game assets...'
Get-ChildItem -LiteralPath $releaseDirectory -File |
    Where-Object { $_.Name -ne '.gitkeep' } |
    Copy-Item -Destination $stagingDirectory
Copy-Item -LiteralPath (Join-Path $projectDirectory 'package\README.txt') -Destination $stagingDirectory

$visualStudioRoot = Join-Path $env:ProgramFiles 'Microsoft Visual Studio\2022'
$crtDirectory = Get-ChildItem -LiteralPath $visualStudioRoot -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
        Get-ChildItem -LiteralPath (Join-Path $_.FullName 'VC\Redist\MSVC') -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^\d+\.\d+' } |
            Sort-Object Name -Descending |
            Select-Object -First 1 |
            ForEach-Object { Join-Path $_.FullName 'x64\Microsoft.VC143.CRT' }
    } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1

if (-not $crtDirectory) {
    throw 'The Visual C++ x64 runtime directory could not be found.'
}
Get-ChildItem -LiteralPath $crtDirectory -Filter '*.dll' -File |
    Copy-Item -Destination $stagingDirectory

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
Write-Host "Creating $zipPath..."
Compress-Archive -LiteralPath $stagingDirectory -DestinationPath $zipPath -CompressionLevel Optimal

Remove-Item -LiteralPath $stagingRoot -Recurse -Force

$zip = Get-Item -LiteralPath $zipPath
Write-Host "Package complete: $($zip.FullName)" -ForegroundColor Green
Write-Host ("Package size: {0:N1} MB" -f ($zip.Length / 1MB))
Write-Host 'After uploading it, paste its public URL into the "build" field in:'
Write-Host (Join-Path $projectDirectory '..\prototypes.json')
