[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object Text.UTF8Encoding($false)

$cssSource = Join-Path $root 'core.css'
$cssOutput = Join-Path $root 'core.min.css'
$jsSource = Join-Path $root 'favicons\favicons.js'
$jsOutput = Join-Path $root 'favicons\favicons.min.js'

function Minify-Css([string]$text) {
    $text = [regex]::Replace($text, '(?s)/\*.*?\*/', '')
    $text = [regex]::Replace($text, '\s*([{}:;,>])\s*', '$1')
    $text = [regex]::Replace($text, ';}', '}')
    return ([regex]::Replace($text, '\s+', ' ')).Trim()
}

function Minify-JavaScript([string]$text) {
    $text = [regex]::Replace($text, '(?m)^\s*//.*(?:\r?\n|$)', '')
    $lines = foreach ($line in ($text -split '\r?\n')) {
        $trimmed = $line.Trim()
        if ($trimmed.Length) { $trimmed }
    }
    return ($lines -join '')
}

$css = Minify-Css (Get-Content -Raw -LiteralPath $cssSource)
$js = Minify-JavaScript (Get-Content -Raw -LiteralPath $jsSource)
[IO.File]::WriteAllText($cssOutput, $css, $utf8)
[IO.File]::WriteAllText($jsOutput, $js, $utf8)

$sourceBytes = (Get-Item $cssSource).Length + (Get-Item $jsSource).Length
$outputBytes = (Get-Item $cssOutput).Length + (Get-Item $jsOutput).Length
Write-Host ("core.min.css: {0:N0} bytes" -f (Get-Item $cssOutput).Length)
Write-Host ("favicons.min.js: {0:N0} bytes" -f (Get-Item $jsOutput).Length)
Write-Host ("Saved {0:N0} bytes across the main-page CSS and JavaScript." -f ($sourceBytes - $outputBytes))
