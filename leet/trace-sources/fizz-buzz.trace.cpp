#include "../trace-recorder.hpp"

#include <string>
#include <vector>

class Solution
{
public:
	std::vector<std::string> fizzBuzz(int N)
	{
		std::vector<std::string> Answer;
		LeetTrace::Record(27, "std::vector<std::string> Answer;", "N", N, "Answer", Answer);

		for (int Index = 1; Index <= N; Index++)
		{
			LeetTrace::Record(29, "for (int Index = 1; Index <= N; Index++)", "Index", Index, "N", N, "Answer", Answer);

			if (Index % 15 == 0)
			{
				Answer.push_back("FizzBuzz");
				LeetTrace::Record(32, "Answer.push_back(\"FizzBuzz\");", "Index", Index, "Answer", Answer);
			}
			else if (Index % 3 == 0)
			{
				Answer.push_back("Fizz");
				LeetTrace::Record(34, "Answer.push_back(\"Fizz\");", "Index", Index, "Answer", Answer);
			}
			else if (Index % 5 == 0)
			{
				Answer.push_back("Buzz");
				LeetTrace::Record(36, "Answer.push_back(\"Buzz\");", "Index", Index, "Answer", Answer);
			}
			else
			{
				Answer.push_back(NumberToString(Index));
				LeetTrace::Record(
					38,
					"Answer.push_back(NumberToString(Index));",
					"Index", Index,
					"Answer", Answer);
			}
		}

		LeetTrace::Record(41, "return Answer;", "Answer", Answer);
		return Answer;
	}

private:
	std::string NumberToString(int Number) const
	{
		char Digits[10];
		int Length = 0;
		LeetTrace::Record(48, "int Length = 0;", "Number", Number, "Length", Length);

		while (Number > 0)
		{
			LeetTrace::Record(50, "while (Number > 0)", "Number", Number, "Length", Length);
			Digits[Length] = static_cast<char>('0' + Number % 10);
			LeetTrace::Record(
				52,
				"Digits[Length] = static_cast<char>('0' + Number % 10);",
				"Digit", Digits[Length],
				"Length", Length);
			Number /= 10;
			LeetTrace::Record(53, "Number /= 10;", "Number", Number);
			Length++;
			LeetTrace::Record(54, "Length++;", "Length", Length);
		}

		std::string Result;
		LeetTrace::Record(57, "std::string Result;", "Result", Result, "Length", Length);

		while (Length > 0)
		{
			LeetTrace::Record(59, "while (Length > 0)", "Length", Length, "Result", Result);
			--Length;
			LeetTrace::Record(61, "--Length;", "Length", Length);
			Result += Digits[Length];
			LeetTrace::Record(62, "Result += Digits[Length];", "Result", Result);
		}

		LeetTrace::Record(65, "return Result;", "Result", Result);
		return Result;
	}
};
