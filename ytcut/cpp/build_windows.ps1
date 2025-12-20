[CmdletBinding()]
param(
  [ValidateSet('Debug','Release')]
  [string]$Configuration = 'Release',

  [string]$BuildDir = 'build',

  # Recommended defaults:
  # - If you have full Visual Studio installed, "Visual Studio 17 2022" works well.
  # - If you only have Build Tools, "NMake Makefiles" + vcvars is usually the most reliable.
  [string]$Generator = 'NMake Makefiles',

  [ValidateSet('x64')]
  [string]$Arch = 'x64',

  [string]$OutDir = '',

  [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-VsWhere {
  $candidates = @(
    "$env:ProgramFiles(x86)\Microsoft Visual Studio\Installer\vswhere.exe",
    "$env:ProgramFiles\Microsoft Visual Studio\Installer\vswhere.exe"
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path $p)) { return $p }
  }
  return $null
}

function Find-CMake {
  $cmd = Get-Command cmake -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "$env:ProgramFiles\CMake\bin\cmake.exe",
    "$env:ProgramFiles(x86)\CMake\bin\cmake.exe"
  )

  $candidates += (Get-ChildItem "$env:ProgramFiles\Microsoft Visual Studio\*\*\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe" -ErrorAction SilentlyContinue | ForEach-Object FullName)
  $candidates += (Get-ChildItem "$env:ProgramFiles(x86)\Microsoft Visual Studio\*\*\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe" -ErrorAction SilentlyContinue | ForEach-Object FullName)

  foreach ($p in $candidates) {
    if ($p -and (Test-Path $p)) { return $p }
  }

  return $null
}

function Find-VcVars64 {
  $vswhere = Find-VsWhere
  if (-not $vswhere) {
    $fallback = @(
      "$env:ProgramFiles\Microsoft Visual Studio\*\*\VC\Auxiliary\Build\vcvars64.bat",
      "$env:ProgramFiles(x86)\Microsoft Visual Studio\*\*\VC\Auxiliary\Build\vcvars64.bat"
    )
    foreach ($pattern in $fallback) {
      $match = Get-ChildItem $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($match -and (Test-Path $match.FullName)) { return $match.FullName }
    }
    return $null
  }

  $installPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  $installPath = ($installPath | Select-Object -First 1)
  if (-not $installPath) { return $null }

  $vcvars64 = Join-Path $installPath 'VC\Auxiliary\Build\vcvars64.bat'
  if (Test-Path $vcvars64) { return $vcvars64 }

  $vcvarsall = Join-Path $installPath 'VC\Auxiliary\Build\vcvarsall.bat'
  if (Test-Path $vcvarsall) { return $vcvarsall }

  return $null
}

function Invoke-InDevCmd([string]$batPath, [string]$cmd) {
  # Run in cmd.exe so vcvars can affect the environment for subsequent commands.
  $bat = $batPath.Replace('"','""')
  $full = "call `"$bat`" amd64 && $cmd"
  & cmd.exe /c $full
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): $cmd"
  }
}

$cmakeExe = Find-CMake
if (-not $cmakeExe) {
  throw 'cmake.exe was not found (neither on PATH nor in common install locations).'
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir
try {
  if ($Clean -and (Test-Path $BuildDir)) {
    Remove-Item -Recurse -Force $BuildDir
  }

  $genArgs = @('-S', '.', '-B', $BuildDir, '-G', $Generator)

  $isMultiConfig = $Generator -like 'Visual Studio*'
  if ($isMultiConfig) {
    $genArgs += @('-A', $Arch)
  } else {
    $genArgs += @("-DCMAKE_BUILD_TYPE=$Configuration")
  }

  function Quote-ForCmd([string]$a) {
    '"' + ($a -replace '"', '\\"') + '"'
  }

  $configure = (Quote-ForCmd $cmakeExe) + ' ' + (($genArgs | ForEach-Object { Quote-ForCmd $_ }) -join ' ')
  $build = if ($isMultiConfig) {
    (Quote-ForCmd $cmakeExe) + ' --build ' + (Quote-ForCmd $BuildDir) + ' --config ' + $Configuration
  } else {
    (Quote-ForCmd $cmakeExe) + ' --build ' + (Quote-ForCmd $BuildDir)
  }

  $needDevCmd = -not (Get-Command cl.exe -ErrorAction SilentlyContinue)
  $vcvars = if ($needDevCmd) { Find-VcVars64 } else { $null }

  if ($needDevCmd -and -not $vcvars) {
    throw "MSVC tools not found (cl.exe missing) and vswhere/vcvars not found. Install 'Visual Studio Build Tools' (Desktop development with C++) or run this from a VS Developer PowerShell." 
  }

  if ($vcvars) {
    Write-Host "Using MSVC via: $vcvars"
    Invoke-InDevCmd $vcvars $configure
    Invoke-InDevCmd $vcvars $build
  } else {
    & $cmakeExe @genArgs
    if ($LASTEXITCODE -ne 0) { throw "cmake configure failed (exit $LASTEXITCODE)" }

    if ($isMultiConfig) {
      & $cmakeExe --build $BuildDir --config $Configuration
    } else {
      & $cmakeExe --build $BuildDir
    }
    if ($LASTEXITCODE -ne 0) { throw "cmake build failed (exit $LASTEXITCODE)" }
  }

  # Find built exe
  $exe = Get-ChildItem -Path $BuildDir -Filter 'ytcut.exe' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $exe) { throw 'Build succeeded but ytcut.exe was not found in the build directory.' }

  if ($OutDir) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    Copy-Item -Force $exe.FullName (Join-Path $OutDir 'ytcut.exe')
    Write-Host "Wrote: $(Join-Path $OutDir 'ytcut.exe')"
  } else {
    Write-Host "Built: $($exe.FullName)"
  }
} finally {
  Pop-Location
}
