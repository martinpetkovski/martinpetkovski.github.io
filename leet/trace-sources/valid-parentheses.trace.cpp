#include "../trace-recorder.hpp"

#include <string>

class Solution
{
public:
	bool isValid(std::string S)
	{
		bool bIsValid = S.size() % 2 == 0;
		LeetTrace::Record(23, "bool bIsValid = S.size() % 2 == 0;", "S", S, "bIsValid", bIsValid);
		int StackSize = 0;
		LeetTrace::Record(24, "int StackSize = 0;", "StackSize", StackSize);

		for (int Index = 0; Index < static_cast<int>(S.size()) && bIsValid; Index++)
		{
			LeetTrace::Record(
				26,
				"for (int Index = 0; Index < static_cast<int>(S.size()) && bIsValid; Index++)",
				"Index", Index,
				"StackSize", StackSize,
				"bIsValid", bIsValid);
			const char Character = S[Index];
			LeetTrace::Record(28, "const char Character = S[Index];", "Character", Character);

			if (Character == '(' || Character == '[' || Character == '{')
			{
				S[StackSize] = Character;
				LeetTrace::Record(32, "S[StackSize] = Character;", "StackSize", StackSize, "S", S);
				StackSize++;
				LeetTrace::Record(33, "StackSize++;", "StackSize", StackSize);
			}
			else if (StackSize == 0)
			{
				bIsValid = false;
				LeetTrace::Record(37, "bIsValid = false;", "bIsValid", bIsValid);
			}
			else
			{
				char ExpectedOpening = '(';
				LeetTrace::Record(41, "char ExpectedOpening = '(';", "ExpectedOpening", ExpectedOpening);

				if (Character == ']')
				{
					ExpectedOpening = '[';
					LeetTrace::Record(44, "ExpectedOpening = '[';", "ExpectedOpening", ExpectedOpening);
				}
				else if (Character == '}')
				{
					ExpectedOpening = '{';
					LeetTrace::Record(46, "ExpectedOpening = '{';", "ExpectedOpening", ExpectedOpening);
				}

				StackSize--;
				LeetTrace::Record(48, "StackSize--;", "StackSize", StackSize);
				bIsValid = S[StackSize] == ExpectedOpening;
				LeetTrace::Record(
					49,
					"bIsValid = S[StackSize] == ExpectedOpening;",
					"StackTop", S[StackSize],
					"ExpectedOpening", ExpectedOpening,
					"bIsValid", bIsValid);
			}
		}

		LeetTrace::Record(53, "return bIsValid && StackSize == 0;", "bIsValid", bIsValid, "StackSize", StackSize);
		return bIsValid && StackSize == 0;
	}
};
