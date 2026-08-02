[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectDirectory = $PSScriptRoot
$buildDirectory = Join-Path $projectDirectory 'build'
$vcpkgDirectory = Join-Path $projectDirectory '.vcpkg'
$vcpkgExecutable = Join-Path $vcpkgDirectory 'vcpkg.exe'
$toolchainFile = Join-Path $vcpkgDirectory 'scripts\buildsystems\vcpkg.cmake'
$assetsDirectory = Join-Path $projectDirectory 'assets'

function Require-Command {
    param([Parameter(Mandatory)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found on PATH."
    }
}

Require-Command 'cmake'

if (-not (Test-Path -LiteralPath $vcpkgDirectory)) {
    Require-Command 'git'
    Write-Host 'Downloading vcpkg...'
    & git clone --depth 1 https://github.com/microsoft/vcpkg.git $vcpkgDirectory
    if ($LASTEXITCODE -ne 0) {
        throw "git clone failed with exit code $LASTEXITCODE."
    }
}

if (-not (Test-Path -LiteralPath $vcpkgExecutable)) {
    $bootstrapScript = Join-Path $vcpkgDirectory 'bootstrap-vcpkg.bat'
    if (-not (Test-Path -LiteralPath $bootstrapScript)) {
        throw "vcpkg bootstrap script was not found at '$bootstrapScript'."
    }

    Write-Host 'Bootstrapping vcpkg...'
    & $bootstrapScript -disableMetrics
    if ($LASTEXITCODE -ne 0) {
        throw "vcpkg bootstrap failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Configuring Pong ($Configuration)..."
& cmake `
    -S $projectDirectory `
    -B $buildDirectory `
    -A x64 `
    "-DCMAKE_TOOLCHAIN_FILE=$($toolchainFile.Replace('\', '/'))"
if ($LASTEXITCODE -ne 0) {
    throw "CMake configuration failed with exit code $LASTEXITCODE."
}

Write-Host "Building Pong ($Configuration)..."
& cmake --build $buildDirectory --config $Configuration --parallel
if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE."
}

$executable = Join-Path $buildDirectory "$Configuration\pong.exe"
Write-Host "Build complete: $executable" -ForegroundColor Green

$requiredAssets = @(
    'skola.otf',
    'ball.png',
    'bat.png',
    'menu_music.wav',
    'thejohn.wav',
    'dang.wav'
)
$missingAssets = @(
    $requiredAssets | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $assetsDirectory $_))
    }
)

if ($missingAssets.Count -gt 0) {
    Write-Warning "The game will not run correctly until these files are added to '$assetsDirectory':"
    $missingAssets | ForEach-Object { Write-Warning "  $_" }
    Write-Host "See: $(Join-Path $projectDirectory 'MISSING_ASSETS.md')"
}
