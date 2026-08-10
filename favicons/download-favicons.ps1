[CmdletBinding()]
param(
    [string[]]$Sources = @(),
    [switch]$DryRun,
    [string]$PythonPath
)

$ErrorActionPreference = 'Stop'
$implementation = Join-Path $PSScriptRoot 'download-favicons.py'

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
$scriptArguments = @()
if ($DryRun) {
    $scriptArguments += '--dry-run'
}
$scriptArguments += $Sources

& $executable @prefixArguments $implementation @scriptArguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
