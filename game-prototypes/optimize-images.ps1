[CmdletBinding()]
param(
    [ValidateRange(1, 8192)]
    [int]$DetailWidth = 960,

    [ValidateRange(1, 100)]
    [int]$DetailQuality = 76,

    [ValidateRange(1, 1024)]
    [int]$ThumbnailWidth = 96,

    [ValidateRange(1, 1024)]
    [int]$ThumbnailHeight = 54,

    [ValidateRange(1, 100)]
    [int]$ThumbnailQuality = 36,

    [switch]$DryRun,

    [string]$PythonPath
)

$ErrorActionPreference = 'Stop'
$implementation = Join-Path $PSScriptRoot 'optimize-images.py'

function Find-Python {
    if ($PythonPath) {
        if (-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)) {
            throw "Python was not found at: $PythonPath"
        }
        return ,@($PythonPath)
    }

    $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $bundledPython -PathType Leaf) {
        return ,@($bundledPython)
    }

    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        return ,@($pythonCommand.Source)
    }

    $launcherCommand = Get-Command py -ErrorAction SilentlyContinue
    if ($launcherCommand) {
        return ,@($launcherCommand.Source, '-3')
    }

    throw 'Python 3 was not found. Install Python with Pillow, or pass -PythonPath.'
}

$python = @(Find-Python)
$executable = $python[0]
$prefixArguments = @($python | Select-Object -Skip 1)
$scriptArguments = @(
    '--detail-width', $DetailWidth,
    '--detail-quality', $DetailQuality,
    '--thumb-width', $ThumbnailWidth,
    '--thumb-height', $ThumbnailHeight,
    '--thumb-quality', $ThumbnailQuality
)
if ($DryRun) {
    $scriptArguments += '--dry-run'
}

& $executable @prefixArguments $implementation @scriptArguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
