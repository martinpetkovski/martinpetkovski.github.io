/*
 * title: Valid Palindrome
 * statement:
 * Determine whether a string is a palindrome after converting uppercase letters to lowercase and removing
 * every character that is not a letter or number.
 *
 * leetcode: https://leetcode.com/problems/valid-palindrome/
 * difficulty: Easy
 * tags: Two Pointers, String
 * time: O(n)
 * space: O(1)
 * note:
 */

#include <string>

class Solution
{
public:
	bool isPalindrome(std::string S)
	{
		bool bIsPalindrome = true;
		int Left = 0;
		int Right = static_cast<int>(S.size()) - 1;

		while (Left < Right && bIsPalindrome)
		{
			while (Left < Right && !IsAlphanumeric(S[Left]))
				Left++;

			while (Left < Right && !IsAlphanumeric(S[Right]))
				Right--;

			bIsPalindrome = NormalizeCharacter(S[Left]) == NormalizeCharacter(S[Right]);
			Left++;
			Right--;
		}

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
