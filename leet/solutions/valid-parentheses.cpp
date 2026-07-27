/*
 * title: Valid Parentheses
 * statement:
 * Given a string containing only parentheses, square brackets, and curly braces, determine whether it is valid.
 * Every opening bracket must be closed by the same type of bracket and in the correct order.
 *
 * leetcode: https://leetcode.com/problems/valid-parentheses/
 * difficulty: Easy
 * tags: String, Stack
 * time: O(n)
 * space: O(1)
 * note:
 * The input string is reused as an in-place stack, avoiding a separate stack container.
 */

#include <string>

class Solution
{
public:
	bool isValid(std::string S)
	{
		bool bIsValid = S.size() % 2 == 0;
		int StackSize = 0;

		for (int Index = 0; Index < static_cast<int>(S.size()) && bIsValid; Index++)
		{
			const char Character = S[Index];

			if (Character == '(' || Character == '[' || Character == '{')
			{
				S[StackSize] = Character;
				StackSize++;
			}
			else if (StackSize == 0)
			{
				bIsValid = false;
			}
			else
			{
				char ExpectedOpening = '(';

				if (Character == ']')
					ExpectedOpening = '[';
				else if (Character == '}')
					ExpectedOpening = '{';

				StackSize--;
				bIsValid = S[StackSize] == ExpectedOpening;
			}
		}

		return bIsValid && StackSize == 0;
	}
};
