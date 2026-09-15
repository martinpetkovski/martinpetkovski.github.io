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
    $text = [regex]::Replace($text, '(?s)<style>(.*?)</style>', {
        param($match)
        return '<style>' + (Minify-Css $match.Groups[1].Value) + '</style>'
    })
    $text = [regex]::Replace($text, 'class="([^"]+)"', {
        param($match)
        $names = foreach ($name in ($match.Groups[1].Value -split '\s+')) {
            if ($classes.Contains($name)) { $classes[$name] } else { $name }
        }
        return 'class="' + ($names -join ' ') + '"'
    })
    foreach ($sheet in @('home')) {
        $text = $text.Replace('href="' + $sheet + '.css"', 'href="' + $sheet + '.min.css"')
    }
    $text = $text.Replace('src="/favicons/favicons.js"', 'src="/favicons/favicons.min.js"')
    $text = [regex]::Replace($text, '(?s)<!--(?!\[if).*?-->', '')
    # Whitespace between two inline elements is rendered text. Deleting it (the old
    # '>\s+<' -> '><' rule) joined "Historikal" and "2025" into "Historikal2025".
    # Collapse every run to one space, then strip it only beside block-level tags.
    $block = 'html|head|body|div|main|footer|header|nav|section|article|aside|ul|ol|li|dl|dt|dd|h1|h2|h3|h4|h5|h6|p|blockquote|figure|table|thead|tbody|tr|td|th|form|style|script|meta|link|title|hr|br'
    $text = [regex]::Replace($text, '\s+', ' ')
    $text = [regex]::Replace($text, '\s+(?=</?(?:' + $block + ')\b)', '')
    $text = [regex]::Replace($text, '(</?(?:' + $block + ')\b[^>]*>)\s+', '$1')

    # HTML5 allows these end tags to be omitted in the contexts used here.
    $text = [regex]::Replace($text, '</li>(?=\s*(?:<li\b|</(?:ol|ul)>))', '')
    $text = [regex]::Replace($text, '</option>(?=\s*(?:<option\b|</select>))', '')
    $pFollower = 'address|article|aside|blockquote|div|dl|fieldset|footer|form|h[1-6]|header|hgroup|hr|main|menu|nav|ol|p|pre|section|table|ul'
    $text = [regex]::Replace($text, '</p>(?=\s*(?:<(?:' + $pFollower + ')\b|</(?:div|footer|main|section)>))', '')
    $text = [regex]::Replace($text, '</head>(?=\s*<body\b)', '')
    $text = [regex]::Replace($text, '</body>(?=\s*</html>)', '')
    $text = [regex]::Replace($text, '</html>\s*$', '')

    # Quotes are optional when an attribute contains none of HTML's forbidden
    # unquoted-value characters. Restrict this pass to tags, never script text.
    $safeAttribute = '="([^\s"''`=<>]+)"'
    $text = [regex]::Replace($text, '<[^!][^>]*>', {
        param($tag)
        return [regex]::Replace($tag.Value, $safeAttribute, '=$1')
    })
    return $text.Trim()
}

function ConvertTo-NativeArgument([string]$argument) {
    if ($argument.Length -gt 0 -and $argument -notmatch '[\s"]') { return $argument }
    $escaped = [regex]::Replace($argument, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Invoke-NativeCapture([string]$filePath, [string[]]$arguments) {
    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $filePath
    $startInfo.Arguments = (($arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo
    try {
        [void]$process.Start()
        $standardOutput = $process.StandardOutput.ReadToEndAsync()
        $standardError = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StdOut = $standardOutput.Result
            StdErr = $standardError.Result
        }
    } finally {
        $process.Dispose()
    }
}

$jsSource = Join-Path $root 'favicons\favicons.js'
$htmlSource = Join-Path $root 'index.src.html'
$jsOutput = Join-Path $root 'favicons\favicons.min.js'
$htmlOutput = Join-Path $root 'index.html'
$fontSource = Join-Path $root 'font.ttf'
$fontOutput = Join-Path $root 'font.min.woff2'

# Build the character set from every page and data file rendered with the site
# font. FontTools keeps compound glyphs and rewrites the OpenType tables safely.
$glyphSources = @(
    $htmlSource,
    (Join-Path $root 'header.js'),
    (Join-Path $root 'sis\index.html'),
    (Join-Path $root 'sis\navredi.json'),
    (Join-Path $root 'makedonski\index.html'),
    (Join-Path $root 'makedonski\korpus.json')
)
$glyphText = [string]::Concat(($glyphSources | ForEach-Object {
    Get-Content -Raw -Encoding UTF8 -LiteralPath $_
}))
$glyphFile = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($glyphFile, $glyphText, $utf8)
$fontTempBase = [IO.Path]::GetTempFileName()
$fontTemp = $fontTempBase + '.woff2'

$pythonCandidates = @()
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
    $pythonCandidates += [pscustomobject]@{ Exe = $pythonCommand.Source; Args = @(); Label = 'python' }
}
$pyCommand = Get-Command py -ErrorAction SilentlyContinue
if ($pyCommand) {
    $pythonCandidates += [pscustomobject]@{ Exe = $pyCommand.Source; Args = @('-3'); Label = 'py -3' }
}
$codexPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $codexPython) {
    $pythonCandidates += [pscustomobject]@{ Exe = $codexPython; Args = @(); Label = 'Codex Python' }
}

$python = $null
foreach ($candidate in $pythonCandidates) {
    try {
        $probe = Invoke-NativeCapture $candidate.Exe (@($candidate.Args) + @('-c', 'import fontTools, brotli'))
    } catch {
        continue
    }
    if ($probe.ExitCode -eq 0) {
        $python = $candidate
        break
    }
}
try {
    if ($python) {
        $subsetArguments = @($python.Args) + @(
            '-m', 'fontTools.subset', $fontSource, "--text-file=$glyphFile",
            "--output-file=$fontTemp", '--flavor=woff2', '--no-hinting', '--layout-features=*'
        )
        $subset = Invoke-NativeCapture $python.Exe $subsetArguments
        if ($subset.ExitCode -eq 0 -and (Test-Path -LiteralPath $fontTemp)) {
            [IO.File]::Copy($fontTemp, $fontOutput, $true)
        } elseif (Test-Path -LiteralPath $fontOutput) {
            Write-Warning "Font subsetting failed using $($python.Label); reusing the existing font.min.woff2. $($subset.StdErr.Trim())"
        } else {
            throw "Font subsetting failed using $($python.Label) with exit code $($subset.ExitCode).`n$($subset.StdErr.Trim())"
        }
    } elseif (Test-Path -LiteralPath $fontOutput) {
        Write-Warning 'No Python interpreter with FontTools and Brotli was found; reusing the existing font.min.woff2.'
    } else {
        throw 'No Python interpreter with FontTools and Brotli was found, and font.min.woff2 does not exist. Run: python -m pip install fonttools brotli'
    }
} finally {
    Remove-Item -LiteralPath $glyphFile -Force
    Remove-Item -LiteralPath $fontTempBase -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $fontTemp -Force -ErrorAction SilentlyContinue
}

$pairs = @()
foreach ($sheet in @('home')) {
    $cssSource = Join-Path $root ($sheet + '.css')
    $cssOutput = Join-Path $root ($sheet + '.min.css')
    [IO.File]::WriteAllText($cssOutput, (Minify-Css (Get-Content -Raw -Encoding UTF8 -LiteralPath $cssSource)), $utf8)
    $pairs += , @($cssSource, $cssOutput)
}
[IO.File]::WriteAllText($jsOutput, (Minify-JavaScript (Get-Content -Raw -Encoding UTF8 -LiteralPath $jsSource)), $utf8)
[IO.File]::WriteAllText($htmlOutput, (Minify-Html (Get-Content -Raw -Encoding UTF8 -LiteralPath $htmlSource)), $utf8)

$pairs += , @($jsSource, $jsOutput)
$pairs += , @($htmlSource, $htmlOutput)
$pairs += , @($fontSource, $fontOutput)
$sourceBytes = 0L; $outputBytes = 0L
foreach ($pair in $pairs) {
    $sourceBytes += (Get-Item -LiteralPath $pair[0]).Length
    $outputBytes += (Get-Item -LiteralPath $pair[1]).Length
    Write-Host ("{0}: {1:N0} bytes" -f (Split-Path -Leaf $pair[1]), (Get-Item -LiteralPath $pair[1]).Length)
}
Write-Host ("Saved {0:N0} bytes across the homepage assets." -f ($sourceBytes - $outputBytes))
