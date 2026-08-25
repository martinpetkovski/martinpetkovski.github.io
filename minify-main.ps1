[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object Text.UTF8Encoding($false)

$classes = [ordered]@{
    'favicon-links' = 'a'; 'homepage' = 'b'; 'page' = 'c'; 'hdr' = 'd'
    'hdr-logo' = 'e'; 'hdr-text' = 'f'; 'sub' = 'g'; 'sub-inner' = 'h'
    'content' = 'i'; 'lang' = 'm'; 'l-bar' = 'n'; 'link-item' = 'o'
    'email' = 'p'; 'favicon-link' = 'q'; 'favicon' = 'r'
    'nav-btns' = 's'; 'nav-btn' = 't'; 'tl' = 'u'; 'tl-r' = 'v'
    'tl-e' = 'w'; 'tl-x' = 'x'; 'tl-k' = 'y'; 'tl-i' = 'z'; 'tl-c' = 'a1'
    'op' = 'a2'; 'op-v' = 'a3'; 'op-r' = 'a4'; 'op-o' = 'a5'; 'op-t' = 'a6'
}

function Minify-Css([string]$text) {
    foreach ($name in $classes.Keys) {
        $text = [regex]::Replace($text, '\.' + [regex]::Escape($name) + '(?![\w-])', '.' + $classes[$name])
    }
    $text = [regex]::Replace($text, '(?s)/\*.*?\*/', '')
    $text = [regex]::Replace($text, '\s*([{}:;,>])\s*', '$1')
    $text = [regex]::Replace($text, ';}', '}')
    return ([regex]::Replace($text, '\s+', ' ')).Trim()
}

function Minify-JavaScript([string]$text) {
    foreach ($name in $classes.Keys) {
        $short = $classes[$name]
        $text = $text.Replace("'.$name", "'.$short")
        $text = $text.Replace("'$name'", "'$short'")
    }
    $text = [regex]::Replace($text, '(?m)^\s*//.*(?:\r?\n|$)', '')
    $lines = foreach ($line in ($text -split '\r?\n')) {
        $trimmed = $line.Trim()
        if ($trimmed.Length) { $trimmed }
    }
    return ($lines -join '')
}

function Minify-Html([string]$text) {
    $text = [regex]::Replace($text, 'class="([^"]+)"', {
        param($match)
        $names = foreach ($name in ($match.Groups[1].Value -split '\s+')) {
            if ($classes.Contains($name)) { $classes[$name] } else { $name }
        }
        return 'class="' + ($names -join ' ') + '"'
    })
    foreach ($sheet in @('core', 'desktop', 'mobile')) {
        $text = $text.Replace('href="' + $sheet + '.css"', 'href="' + $sheet + '.min.css"')
    }
    $text = $text.Replace('src="/favicons/favicons.js"', 'src="/favicons/favicons.min.js"')
    $text = [regex]::Replace($text, '(?s)<!--(?!\[if).*?-->', '')
    $text = [regex]::Replace($text, '>\s+<', '><')
    $text = [regex]::Replace($text, '(?m)^\s+|\s+$', '')
    return ([regex]::Replace($text, '(\r?\n)+', '')).Trim()
}

$jsSource = Join-Path $root 'favicons\favicons.js'
$htmlSource = Join-Path $root 'index.src.html'
$jsOutput = Join-Path $root 'favicons\favicons.min.js'
$htmlOutput = Join-Path $root 'index.html'

$pairs = @()
foreach ($sheet in @('core', 'desktop', 'mobile')) {
    $cssSource = Join-Path $root ($sheet + '.css')
    $cssOutput = Join-Path $root ($sheet + '.min.css')
    [IO.File]::WriteAllText($cssOutput, (Minify-Css (Get-Content -Raw -Encoding UTF8 -LiteralPath $cssSource)), $utf8)
    $pairs += , @($cssSource, $cssOutput)
}
[IO.File]::WriteAllText($jsOutput, (Minify-JavaScript (Get-Content -Raw -Encoding UTF8 -LiteralPath $jsSource)), $utf8)
[IO.File]::WriteAllText($htmlOutput, (Minify-Html (Get-Content -Raw -Encoding UTF8 -LiteralPath $htmlSource)), $utf8)

$pairs += , @($jsSource, $jsOutput)
$pairs += , @($htmlSource, $htmlOutput)
$sourceBytes = 0L; $outputBytes = 0L
foreach ($pair in $pairs) {
    $sourceBytes += (Get-Item -LiteralPath $pair[0]).Length
    $outputBytes += (Get-Item -LiteralPath $pair[1]).Length
    Write-Host ("{0}: {1:N0} bytes" -f (Split-Path -Leaf $pair[1]), (Get-Item -LiteralPath $pair[1]).Length)
}
Write-Host ("Saved {0:N0} bytes across the homepage HTML, CSS, and JavaScript." -f ($sourceBytes - $outputBytes))
