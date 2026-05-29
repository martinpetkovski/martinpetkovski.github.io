[CmdletBinding()]
param(
    [string]$OutputPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('najjak-leet-' + [System.Guid]::NewGuid().ToString('N'))
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if([string]::IsNullOrWhiteSpace($OutputPath))
{
    $OutputPath = Join-Path $ScriptRoot 'test-results.json'
}

function Write-TextFile
{
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, $script:Utf8NoBom)
}

function Get-CppCompiler
{
    foreach($Name in @('g++', 'clang++'))
    {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue

        if($Command)
        {
            return $Command
        }
    }

    throw 'No C++ compiler found. Install g++ or clang++ and run this script again.'
}

function Convert-ToIncludePath
{
    param([string]$Path)
    return (Resolve-Path $Path).Path -replace '\\', '/'
}

function Write-FizzBuzzHarness
{
    param([string]$HarnessPath, [string]$SolutionPath)

    $IncludePath = Convert-ToIncludePath $SolutionPath
    $Harness = @"
#include <iostream>
#include <string>
#include <vector>

#include "$IncludePath"

std::string FormatVector(const std::vector<std::string>& Values)
{
    std::string Output = "[";

    for(int Index = 0; Index < static_cast<int>(Values.size()); Index++)
    {
        if(Index > 0)
            Output += ",";

        Output += "\"";
        Output += Values[Index];
        Output += "\"";
    }

    Output += "]";
    return Output;
}

bool AreEqual(const std::vector<std::string>& Left, const std::vector<std::string>& Right)
{
    if(Left.size() != Right.size())
        return false;

    for(int Index = 0; Index < static_cast<int>(Left.size()); Index++)
    {
        if(Left[Index] != Right[Index])
            return false;
    }

    return true;
}

void RunTest(Solution& SolutionInstance, int Input, const std::vector<std::string>& Expected, int& Passed, int& Failed)
{
    const std::vector<std::string> Actual = SolutionInstance.fizzBuzz(Input);
    const std::string Label = "n = " + std::to_string(Input);
    const std::string ActualText = FormatVector(Actual);
    const std::string ExpectedText = FormatVector(Expected);

    if(AreEqual(Actual, Expected))
    {
        std::cout << "PASS|solutions/fizz-buzz.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "\n";
        Passed++;
    }
    else
    {
        std::cout << "FAIL|solutions/fizz-buzz.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "\n";
        Failed++;
    }
}

int main()
{
    Solution SolutionInstance;
    int Passed = 0;
    int Failed = 0;

    RunTest(SolutionInstance, 1, { "1" }, Passed, Failed);
    RunTest(SolutionInstance, 2, { "1", "2" }, Passed, Failed);
    RunTest(SolutionInstance, 3, { "1", "2", "Fizz" }, Passed, Failed);
    RunTest(SolutionInstance, 4, { "1", "2", "Fizz", "4" }, Passed, Failed);
    RunTest(SolutionInstance, 5, { "1", "2", "Fizz", "4", "Buzz" }, Passed, Failed);
    RunTest(SolutionInstance, 6, { "1", "2", "Fizz", "4", "Buzz", "Fizz" }, Passed, Failed);
    RunTest(SolutionInstance, 10, { "1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz" }, Passed, Failed);
    RunTest(SolutionInstance, 11, { "1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11" }, Passed, Failed);
    RunTest(SolutionInstance, 15, { "1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz" }, Passed, Failed);
    RunTest(SolutionInstance, 16, { "1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz", "16" }, Passed, Failed);

    return Failed == 0 ? 0 : 1;
}
"@

    Write-TextFile -Path $HarnessPath -Content $Harness
}

function Write-ValidPalindromeHarness
{
    param([string]$HarnessPath, [string]$SolutionPath)

    $IncludePath = Convert-ToIncludePath $SolutionPath
    $Harness = @"
#include <iostream>
#include <string>

#include "$IncludePath"

std::string FormatBool(bool Value)
{
    return Value ? "true" : "false";
}

void RunTest(Solution& SolutionInstance, const std::string& Input, bool Expected, int& Passed, int& Failed)
{
    const bool Actual = SolutionInstance.isPalindrome(Input);
    const std::string Label = "s = \"" + Input + "\"";
    const std::string ActualText = FormatBool(Actual);
    const std::string ExpectedText = FormatBool(Expected);

    if(Actual == Expected)
    {
        std::cout << "PASS|solutions/valid-palindrome.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "\n";
        Passed++;
    }
    else
    {
        std::cout << "FAIL|solutions/valid-palindrome.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "\n";
        Failed++;
    }
}

int main()
{
    Solution SolutionInstance;
    int Passed = 0;
    int Failed = 0;

    RunTest(SolutionInstance, "A man, a plan, a canal: Panama", true, Passed, Failed);
    RunTest(SolutionInstance, "race a car", false, Passed, Failed);
    RunTest(SolutionInstance, " ", true, Passed, Failed);
    RunTest(SolutionInstance, "0P", false, Passed, Failed);
    RunTest(SolutionInstance, "No lemon, no melon", true, Passed, Failed);
    RunTest(SolutionInstance, "Madam", true, Passed, Failed);
    RunTest(SolutionInstance, "ab_a", true, Passed, Failed);
    RunTest(SolutionInstance, "abc", false, Passed, Failed);
    RunTest(SolutionInstance, "12321", true, Passed, Failed);
    RunTest(SolutionInstance, "1a2", false, Passed, Failed);

    return Failed == 0 ? 0 : 1;
}
"@

    Write-TextFile -Path $HarnessPath -Content $Harness
}

function Compile-Harness
{
    param(
        [System.Management.Automation.CommandInfo]$Compiler,
        [string]$HarnessPath,
        [string]$ExecutablePath
    )

    $Output = & $Compiler.Source -std=c++17 $HarnessPath -o $ExecutablePath 2>&1

    if($LASTEXITCODE -ne 0)
    {
        throw "Compilation failed for $HarnessPath`n$($Output -join [Environment]::NewLine)"
    }
}

function Invoke-Harness
{
    param([string]$ExecutablePath)

    $Output = & $ExecutablePath 2>&1
    $TestLines = @($Output | Where-Object { $_ -match '^(PASS|FAIL)\|' })

    if($TestLines.Count -eq 0)
    {
        throw "No test output was produced by $ExecutablePath`n$($Output -join [Environment]::NewLine)"
    }

    return $TestLines
}

function Convert-TestOutput
{
    param([string[]]$Lines)

    return $Lines | ForEach-Object {
        $Parts = $_ -split '\|'

        if($Parts.Count -lt 5)
        {
            throw "Invalid test output: $_"
        }

        [pscustomobject]@{
            Status = $Parts[0].ToLowerInvariant()
            Path = $Parts[1]
            Case = $Parts[2]
            Result = $Parts[3]
            Expected = $Parts[4]
        }
    }
}

function Invoke-SolutionTests
{
    param(
        [System.Management.Automation.CommandInfo]$Compiler,
        [string]$Name,
        [string]$RelativePath,
        [scriptblock]$HarnessWriter
    )

    $HarnessPath = Join-Path $TempRoot ($Name + '-tests.cpp')
    $ExecutablePath = Join-Path $TempRoot ($Name + '-tests.exe')
    $SolutionPath = Join-Path $ScriptRoot $RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)

    & $HarnessWriter $HarnessPath $SolutionPath
    Compile-Harness -Compiler $Compiler -HarnessPath $HarnessPath -ExecutablePath $ExecutablePath
    return Convert-TestOutput -Lines (Invoke-Harness -ExecutablePath $ExecutablePath)
}

function Write-TestResultsJson
{
    param([object[]]$Results)

    $PassedCount = @($Results | Where-Object { $_.Status -eq 'pass' }).Count
    $FailedCount = @($Results | Where-Object { $_.Status -ne 'pass' }).Count
    $Solutions = [ordered]@{}

    $Results | Group-Object Path | ForEach-Object {
        $Solutions[$_.Name] = @($_.Group | ForEach-Object {
            [ordered]@{
                status = $_.Status
                case = $_.Case
                result = $_.Result
                expected = $_.Expected
            }
        })
    }

    $Document = [ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        minimumRequired = 20
        total = $Results.Count
        passed = $PassedCount
        failed = $FailedCount
        solutions = $Solutions
    }

    $Json = $Document | ConvertTo-Json -Depth 10
    Write-TextFile -Path $OutputPath -Content ($Json + [Environment]::NewLine)
}

New-Item -ItemType Directory -Path $TempRoot | Out-Null

try
{
    $Compiler = Get-CppCompiler
    $Results = @()
    $Results += Invoke-SolutionTests -Compiler $Compiler -Name 'fizz-buzz' -RelativePath 'solutions/fizz-buzz.cpp' -HarnessWriter ${function:Write-FizzBuzzHarness}
    $Results += Invoke-SolutionTests -Compiler $Compiler -Name 'valid-palindrome' -RelativePath 'solutions/valid-palindrome.cpp' -HarnessWriter ${function:Write-ValidPalindromeHarness}

    Write-TestResultsJson -Results $Results

    $PassedCount = @($Results | Where-Object { $_.Status -eq 'pass' }).Count
    $Failures = @($Results | Where-Object { $_.Status -ne 'pass' })

    Write-Output "Wrote $($Results.Count) test results to $OutputPath."

    if($Results.Count -lt 20)
    {
        throw "Expected at least 20 tests, but only $($Results.Count) were run."
    }

    if($PassedCount -lt 20)
    {
        throw "Expected at least 20 passing tests, but only $PassedCount passed."
    }

    if($Failures.Count -gt 0)
    {
        $FailureText = $Failures | ForEach-Object { "$($_.Path): $($_.Case) expected $($_.Expected), got $($_.Result)" }
        throw "One or more test cases failed:`n$($FailureText -join [Environment]::NewLine)"
    }

    Write-Output "PASS: $PassedCount test cases passed."
}
finally
{
    if(Test-Path $TempRoot)
    {
        Remove-Item -Path $TempRoot -Recurse -Force
    }
}