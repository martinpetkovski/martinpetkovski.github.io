#include "../trace-recorder.hpp"

#include <string>

class Solution
{
public:
	bool isPalindrome(std::string S)
	{
		bool bIsPalindrome = true;
		LeetTrace::Record(22, "bool bIsPalindrome = true;", "S", S, "bIsPalindrome", bIsPalindrome);
		int Left = 0;
		LeetTrace::Record(23, "int Left = 0;", "Left", Left);
		int Right = static_cast<int>(S.size()) - 1;
		LeetTrace::Record(24, "int Right = static_cast<int>(S.size()) - 1;", "Right", Right);

		while (Left < Right && bIsPalindrome)
		{
			LeetTrace::Record(
				26,
				"while (Left < Right && bIsPalindrome)",
				"Left", Left,
				"Right", Right,
				"bIsPalindrome", bIsPalindrome);

			while (Left < Right && !IsAlphanumeric(S[Left]))
			{
				Left++;
				LeetTrace::Record(29, "Left++;", "Left", Left);
			}

			while (Left < Right && !IsAlphanumeric(S[Right]))
			{
				Right--;
				LeetTrace::Record(32, "Right--;", "Right", Right);
			}

			bIsPalindrome = NormalizeCharacter(S[Left]) == NormalizeCharacter(S[Right]);
			LeetTrace::Record(
				34,
				"bIsPalindrome = NormalizeCharacter(S[Left]) == NormalizeCharacter(S[Right]);",
				"Left", Left,
				"Right", Right,
				"LeftCharacter", S[Left],
				"RightCharacter", S[Right],
				"bIsPalindrome", bIsPalindrome);
			Left++;
			LeetTrace::Record(35, "Left++;", "Left", Left);
			Right--;
			LeetTrace::Record(36, "Right--;", "Right", Right);
		}

		LeetTrace::Record(39, "return bIsPalindrome;", "bIsPalindrome", bIsPalindrome, "Left", Left, "Right", Right);
		return bIsPalindrome;
	}

private:
	bool IsAlphanumeric(char Value) const
	{
		return ('0' <= Value && Value <= '9') ||
			('a' <= Value && Value <= 'z') ||
			('A' <= Value && Value <= 'Z');
	}

	char NormalizeCharacter(char Value) const
	{
		char Result = Value;

		if ('A' <= Value && Value <= 'Z')
			Result = static_cast<char>(Value - 'A' + 'a');

		return Result;
	}
};
