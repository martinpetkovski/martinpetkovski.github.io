[CmdletBinding()]
param([string]$OutputPath = '')

$ErrorActionPreference = 'Stop'
$resumeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteRoot = Split-Path -Parent $resumeRoot
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $siteRoot 'output\pdf\Martin-Petkovski-CV.pdf'
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LocalAppData 'Google\Chrome\Application\chrome.exe')
)
$browser = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $browser) {
    throw 'Microsoft Edge or Google Chrome was not found. Install either browser and run this script again.'
}

$htmlUrl = ([Uri](Join-Path $resumeRoot 'index.html')).AbsoluteUri
$arguments = @(
    '--headless', '--disable-gpu', '--allow-file-access-from-files',
    '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=3000', "--print-to-pdf=$OutputPath", $htmlUrl
)
$process = Start-Process -FilePath $browser -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $OutputPath)) {
    throw "PDF export failed with browser exit code $($process.ExitCode)."
}
Write-Host ("Created {0} ({1:N0} bytes)" -f $OutputPath, (Get-Item -LiteralPath $OutputPath).Length)
