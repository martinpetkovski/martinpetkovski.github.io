[CmdletBinding()]
param(
    [string]$OutputPath = "",
    [string]$TraceOutputPath = ""
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

if([string]::IsNullOrWhiteSpace($TraceOutputPath))
{
    $TraceOutputPath = Join-Path $ScriptRoot 'execution-traces.json'
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
#include <chrono>
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
    const std::string Label = "n = " + std::to_string(Input);
#ifdef LEET_TRACE
    LeetTrace::Begin("solutions/fizz-buzz.cpp", Label);
#endif
    const auto StartedAt = std::chrono::steady_clock::now();
    const std::vector<std::string> Actual = SolutionInstance.fizzBuzz(Input);
#ifdef LEET_TRACE
    LeetTrace::End();
#endif
    const auto FinishedAt = std::chrono::steady_clock::now();
    const auto DurationNs = std::chrono::duration_cast<std::chrono::nanoseconds>(FinishedAt - StartedAt).count();
    const std::string ActualText = FormatVector(Actual);
    const std::string ExpectedText = FormatVector(Expected);

    if(AreEqual(Actual, Expected))
    {
        std::cout << "PASS|solutions/fizz-buzz.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
        Passed++;
    }
    else
    {
        std::cout << "FAIL|solutions/fizz-buzz.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
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
#include <chrono>
#include <iostream>
#include <string>

#include "$IncludePath"

std::string FormatBool(bool Value)
{
    return Value ? "true" : "false";
}

void RunTest(Solution& SolutionInstance, const std::string& Input, bool Expected, int& Passed, int& Failed)
{
    const std::string Label = "s = \"" + Input + "\"";
#ifdef LEET_TRACE
    LeetTrace::Begin("solutions/valid-palindrome.cpp", Label);
#endif
    const auto StartedAt = std::chrono::steady_clock::now();
    const bool Actual = SolutionInstance.isPalindrome(Input);
#ifdef LEET_TRACE
    LeetTrace::End();
#endif
    const auto FinishedAt = std::chrono::steady_clock::now();
    const auto DurationNs = std::chrono::duration_cast<std::chrono::nanoseconds>(FinishedAt - StartedAt).count();
    const std::string ActualText = FormatBool(Actual);
    const std::string ExpectedText = FormatBool(Expected);

    if(Actual == Expected)
    {
        std::cout << "PASS|solutions/valid-palindrome.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
        Passed++;
    }
    else
    {
        std::cout << "FAIL|solutions/valid-palindrome.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
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

function Write-TwoSumHarness
{
    param([string]$HarnessPath, [string]$SolutionPath)

    $IncludePath = Convert-ToIncludePath $SolutionPath
    $Harness = @"
#include <chrono>
#include <iostream>
#include <string>
#include <vector>

#include "$IncludePath"

std::string FormatVector(const std::vector<int>& Values)
{
    std::string Output = "[";

    for(int Index = 0; Index < static_cast<int>(Values.size()); Index++)
    {
        if(Index > 0)
            Output += ",";

        Output += std::to_string(Values[Index]);
    }

    Output += "]";
    return Output;
}

bool IsValidAnswer(const std::vector<int>& Input, int Target, const std::vector<int>& Answer)
{
    if(Answer.size() != 2 || Answer[0] == Answer[1])
        return false;

    if(Answer[0] < 0 || Answer[1] < 0 ||
        Answer[0] >= static_cast<int>(Input.size()) ||
        Answer[1] >= static_cast<int>(Input.size()))
        return false;

    return Input[Answer[0]] + Input[Answer[1]] == Target;
}

void RunTest(Solution& SolutionInstance, std::vector<int> Input, int Target, const std::vector<int>& Expected, int& Passed, int& Failed)
{
    const std::string Label = "nums = " + FormatVector(Input) + ", target = " + std::to_string(Target);
#ifdef LEET_TRACE
    LeetTrace::Begin("solutions/two-sum.cpp", Label);
#endif
    const auto StartedAt = std::chrono::steady_clock::now();
    const std::vector<int> Actual = SolutionInstance.twoSum(Input, Target);
#ifdef LEET_TRACE
    LeetTrace::End();
#endif
    const auto FinishedAt = std::chrono::steady_clock::now();
    const auto DurationNs = std::chrono::duration_cast<std::chrono::nanoseconds>(FinishedAt - StartedAt).count();
    const std::string ActualText = FormatVector(Actual);
    const std::string ExpectedText = FormatVector(Expected);

    if(IsValidAnswer(Input, Target, Actual))
    {
        std::cout << "PASS|solutions/two-sum.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
        Passed++;
    }
    else
    {
        std::cout << "FAIL|solutions/two-sum.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
        Failed++;
    }
}

int main()
{
    Solution SolutionInstance;
    int Passed = 0;
    int Failed = 0;

    RunTest(SolutionInstance, { 2, 7, 11, 15 }, 9, { 0, 1 }, Passed, Failed);
    RunTest(SolutionInstance, { 3, 2, 4 }, 6, { 1, 2 }, Passed, Failed);
    RunTest(SolutionInstance, { 3, 3 }, 6, { 0, 1 }, Passed, Failed);
    RunTest(SolutionInstance, { -1, -2, -3, -4, -5 }, -8, { 2, 4 }, Passed, Failed);
    RunTest(SolutionInstance, { 0, 4, 3, 0 }, 0, { 0, 3 }, Passed, Failed);
    RunTest(SolutionInstance, { 1, 5, 3, 7 }, 8, { 0, 3 }, Passed, Failed);
    RunTest(SolutionInstance, { 10, -10, 20, -20 }, 0, { 0, 1 }, Passed, Failed);
    RunTest(SolutionInstance, { 5, 1, 5 }, 10, { 0, 2 }, Passed, Failed);
    RunTest(SolutionInstance, { 100, 200, 300, 400 }, 700, { 2, 3 }, Passed, Failed);
    RunTest(SolutionInstance, { -10, 20, 30, 40 }, 10, { 0, 1 }, Passed, Failed);

    return Failed == 0 ? 0 : 1;
}
"@

    Write-TextFile -Path $HarnessPath -Content $Harness
}

function Write-ValidParenthesesHarness
{
    param([string]$HarnessPath, [string]$SolutionPath)

    $IncludePath = Convert-ToIncludePath $SolutionPath
    $Harness = @"
#include <chrono>
#include <iostream>
#include <string>

#include "$IncludePath"

std::string FormatBool(bool Value)
{
    return Value ? "true" : "false";
}

void RunTest(Solution& SolutionInstance, const std::string& Input, bool Expected, int& Passed, int& Failed)
{
    const std::string Label = "s = \"" + Input + "\"";
#ifdef LEET_TRACE
    LeetTrace::Begin("solutions/valid-parentheses.cpp", Label);
#endif
    const auto StartedAt = std::chrono::steady_clock::now();
    const bool Actual = SolutionInstance.isValid(Input);
#ifdef LEET_TRACE
    LeetTrace::End();
#endif
    const auto FinishedAt = std::chrono::steady_clock::now();
    const auto DurationNs = std::chrono::duration_cast<std::chrono::nanoseconds>(FinishedAt - StartedAt).count();
    const std::string ActualText = FormatBool(Actual);
    const std::string ExpectedText = FormatBool(Expected);

    if(Actual == Expected)
    {
        std::cout << "PASS|solutions/valid-parentheses.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
        Passed++;
    }
    else
    {
        std::cout << "FAIL|solutions/valid-parentheses.cpp|" << Label << "|" << ActualText << "|" << ExpectedText << "|" << DurationNs << "\n";
        Failed++;
    }
}

int main()
{
    Solution SolutionInstance;
    int Passed = 0;
    int Failed = 0;

    RunTest(SolutionInstance, "()", true, Passed, Failed);
    RunTest(SolutionInstance, "()[]{}", true, Passed, Failed);
    RunTest(SolutionInstance, "(]", false, Passed, Failed);
    RunTest(SolutionInstance, "([])", true, Passed, Failed);
    RunTest(SolutionInstance, "([)]", false, Passed, Failed);
    RunTest(SolutionInstance, "{[]}", true, Passed, Failed);
    RunTest(SolutionInstance, ")", false, Passed, Failed);
    RunTest(SolutionInstance, "((", false, Passed, Failed);
    RunTest(SolutionInstance, "({[]})", true, Passed, Failed);
    RunTest(SolutionInstance, "(){}}{", false, Passed, Failed);

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
        [string]$ExecutablePath,
        [string[]]$AdditionalArguments = @()
    )

    $Arguments = @('-std=c++17') + $AdditionalArguments + @($HarnessPath, '-o', $ExecutablePath)
    $Output = & $Compiler.Source $Arguments 2>&1

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

        if($Parts.Count -lt 6)
        {
            throw "Invalid test output: $_"
        }

        [pscustomobject]@{
            Status = $Parts[0].ToLowerInvariant()
            Path = $Parts[1]
            Case = $Parts[2]
            Result = $Parts[3]
            Expected = $Parts[4]
            DurationNs = [long]$Parts[5]
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
    $TraceHarnessPath = Join-Path $TempRoot ($Name + '-trace-tests.cpp')
    $ExecutablePath = Join-Path $TempRoot ($Name + '-tests.exe')
    $TraceExecutablePath = Join-Path $TempRoot ($Name + '-trace.exe')
    $SolutionPath = Join-Path $ScriptRoot $RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $TraceSolutionPath = Join-Path $ScriptRoot ('trace-sources/' + $Name + '.trace.cpp').Replace('/', [System.IO.Path]::DirectorySeparatorChar)

    & $HarnessWriter $HarnessPath $SolutionPath
    Compile-Harness -Compiler $Compiler -HarnessPath $HarnessPath -ExecutablePath $ExecutablePath
    $Results = Convert-TestOutput -Lines (Invoke-Harness -ExecutablePath $ExecutablePath)
    & $HarnessWriter $TraceHarnessPath $TraceSolutionPath
    Compile-Harness `
        -Compiler $Compiler `
        -HarnessPath $TraceHarnessPath `
        -ExecutablePath $TraceExecutablePath `
        -AdditionalArguments @('-g', '-O2', '-DLEET_TRACE', '-D_CRT_SECURE_NO_WARNINGS')
    $null = Invoke-Harness -ExecutablePath $TraceExecutablePath
    return $Results
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
                durationNs = $_.DurationNs
            }
        })
    }

    $Document = [ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        minimumRequired = 40
        total = $Results.Count
        passed = $PassedCount
        failed = $FailedCount
        solutions = $Solutions
    }

    $Json = $Document | ConvertTo-Json -Depth 10
    Write-TextFile -Path $OutputPath -Content ($Json + [Environment]::NewLine)
}

function Apply-TraceDurations
{
    param(
        [object[]]$Results,
        [string]$TraceLinesPath
    )

    $TraceDurations = @{}
    $TraceRecords = @(Get-Content -Path $TraceLinesPath |
        Where-Object { ![string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { $_ | ConvertFrom-Json })

    $TraceRecords | Group-Object solution, case | ForEach-Object {
        $Record = $_.Group[0]
        $Key = "$($Record.solution)`0$($Record.case)"
        $TraceDurations[$Key] = [long](($_.Group | Measure-Object durationNs -Sum).Sum)
    }

    foreach($Result in $Results)
    {
        $Key = "$($Result.Path)`0$($Result.Case)"

        if(!$TraceDurations.ContainsKey($Key))
        {
            throw "No trace duration was recorded for $($Result.Path): $($Result.Case)."
        }

        $Result.DurationNs = $TraceDurations[$Key]
    }
}

function Write-ExecutionTracesJson
{
    param([string]$TraceLinesPath)

    $Solutions = [ordered]@{}
    $SourceHashes = [ordered]@{}
    $TraceLines = @(Get-Content -Path $TraceLinesPath | Where-Object { ![string]::IsNullOrWhiteSpace($_) })
    $Records = @($TraceLines | ForEach-Object { $_ | ConvertFrom-Json })

    $Records | Group-Object solution | ForEach-Object {
        $SolutionPath = Join-Path $ScriptRoot $_.Name.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $SourceLines = @(Get-Content -Path $SolutionPath)

        $_.Group | Group-Object line, statement | ForEach-Object {
            $Record = $_.Group[0]
            $LineIndex = [int]$Record.line - 1

            if($LineIndex -lt 0 -or $LineIndex -ge $SourceLines.Count)
            {
                throw "Trace line $($Record.line) is outside $($Record.solution)."
            }

            if($SourceLines[$LineIndex].Trim() -ne $Record.statement)
            {
                throw "Trace statement mismatch at $($Record.solution):$($Record.line). Expected '$($SourceLines[$LineIndex].Trim())', recorded '$($Record.statement)'."
            }
        }

        $Cases = @($_.Group | Group-Object case | ForEach-Object {
            [ordered]@{
                case = $_.Name
                steps = @($_.Group | Sort-Object step | ForEach-Object {
                    [ordered]@{
                        step = $_.step
                        line = $_.line
                        durationNs = $_.durationNs
                        heapBytes = $_.heapBytes
                        heapDeltaBytes = $_.heapDeltaBytes
                        statement = $_.statement
                        variables = $_.variables
                    }
                })
            }
        })

        $Solutions[$_.Name] = $Cases
        $SourceHashes[$_.Name] = (Get-FileHash -Path $SolutionPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    $Document = [ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        mode = 'instrumented-debug-build'
        sourceHashes = $SourceHashes
        solutions = $Solutions
    }

    $Json = $Document | ConvertTo-Json -Depth 20
    Write-TextFile -Path $TraceOutputPath -Content ($Json + [Environment]::NewLine)
}

New-Item -ItemType Directory -Path $TempRoot | Out-Null
$TraceLinesPath = Join-Path $TempRoot 'execution-traces.ndjson'
$OriginalTraceOutput = [Environment]::GetEnvironmentVariable('LEET_TRACE_OUTPUT', 'Process')
[Environment]::SetEnvironmentVariable('LEET_TRACE_OUTPUT', $TraceLinesPath, 'Process')

try
{
    $Compiler = Get-CppCompiler
    $Results = @()
    $Results += Invoke-SolutionTests -Compiler $Compiler -Name 'fizz-buzz' -RelativePath 'solutions/fizz-buzz.cpp' -HarnessWriter ${function:Write-FizzBuzzHarness}
    $Results += Invoke-SolutionTests -Compiler $Compiler -Name 'two-sum' -RelativePath 'solutions/two-sum.cpp' -HarnessWriter ${function:Write-TwoSumHarness}
    $Results += Invoke-SolutionTests -Compiler $Compiler -Name 'valid-palindrome' -RelativePath 'solutions/valid-palindrome.cpp' -HarnessWriter ${function:Write-ValidPalindromeHarness}
    $Results += Invoke-SolutionTests -Compiler $Compiler -Name 'valid-parentheses' -RelativePath 'solutions/valid-parentheses.cpp' -HarnessWriter ${function:Write-ValidParenthesesHarness}

    Apply-TraceDurations -Results $Results -TraceLinesPath $TraceLinesPath
    Write-TestResultsJson -Results $Results
    Write-ExecutionTracesJson -TraceLinesPath $TraceLinesPath

    $PassedCount = @($Results | Where-Object { $_.Status -eq 'pass' }).Count
    $Failures = @($Results | Where-Object { $_.Status -ne 'pass' })

    Write-Output "Wrote $($Results.Count) test results to $OutputPath."
    Write-Output "Wrote execution traces to $TraceOutputPath."

    if($Results.Count -lt 40)
    {
        throw "Expected at least 40 tests, but only $($Results.Count) were run."
    }

    if($PassedCount -lt 40)
    {
        throw "Expected at least 40 passing tests, but only $PassedCount passed."
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
    [Environment]::SetEnvironmentVariable('LEET_TRACE_OUTPUT', $OriginalTraceOutput, 'Process')

    if(Test-Path $TempRoot)
    {
        Remove-Item -Path $TempRoot -Recurse -Force
    }
}
